import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    // Create admin client for webhook processing
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const body = await req.json()
    console.log('Data webhook received:', JSON.stringify(body, null, 2))

    // Extract reference and status from webhook payload
    // iSquare format: { reference, status, message, ... }
    // RGC format: { reference, status, ... }
    const reference = body.reference || body.transaction_reference
    const status = body.status?.toLowerCase()
    const message = body.message || body.description || ''

    if (!reference) {
      console.error('Missing reference in webhook payload')
      return new Response(JSON.stringify({ error: 'Missing reference' }), { 
        status: 400, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      })
    }

    console.log('Processing webhook:', { reference, status, message })

    // Find the transaction by reference
    const { data: transaction, error: txError } = await supabase
      .from('transactions')
      .select('*')
      .eq('reference', reference)
      .maybeSingle()

    if (txError || !transaction) {
      console.error('Transaction not found:', reference, txError)
      return new Response(JSON.stringify({ error: 'Transaction not found' }), { 
        status: 404, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      })
    }

    // Already processed?
    if (transaction.status !== 'pending') {
      console.log('Transaction already processed:', transaction.status)
      return new Response(JSON.stringify({ message: 'Already processed' }), { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      })
    }

    const isSuccess = status === 'success' || status === 'successful' || status === 'completed'
    const isFailed = status === 'failed' || status === 'error' || status === 'unsuccessful'

    if (isSuccess) {
      // Update transaction as success
      await supabase
        .from('transactions')
        .update({ 
          status: 'success',
          metadata: {
            ...transaction.metadata,
            webhook_data: body,
            completed_at: new Date().toISOString()
          }
        })
        .eq('id', transaction.id)

      // Send success notification
      const category = transaction.category === 'data' ? 'Data' : 'Airtime'
      await supabase.from('notifications').insert({
        user_id: transaction.user_id,
        title: `${category} Purchase Successful`,
        message: transaction.description,
        type: 'success'
      })

      console.log('Transaction marked as success:', reference)

    } else if (isFailed) {
      // Update transaction as failed
      await supabase
        .from('transactions')
        .update({ 
          status: 'failed',
          metadata: {
            ...transaction.metadata,
            webhook_data: body,
            failure_reason: message,
            failed_at: new Date().toISOString()
          }
        })
        .eq('id', transaction.id)

      // Refund the user's wallet
      const { data: wallet, error: walletError } = await supabase
        .from('wallets')
        .select('balance')
        .eq('user_id', transaction.user_id)
        .maybeSingle()

      if (wallet) {
        const newBalance = Number(wallet.balance) + Number(transaction.amount)
        await supabase
          .from('wallets')
          .update({ balance: newBalance })
          .eq('user_id', transaction.user_id)

        console.log('Wallet refunded:', { userId: transaction.user_id, amount: transaction.amount, newBalance })
      }

      // Send failure notification with refund info
      const category = transaction.category === 'data' ? 'Data' : 'Airtime'
      await supabase.from('notifications').insert({
        user_id: transaction.user_id,
        title: `${category} Purchase Failed`,
        message: `${transaction.description} failed. ₦${Number(transaction.amount).toLocaleString()} has been refunded to your wallet.`,
        type: 'error'
      })

      console.log('Transaction marked as failed and refunded:', reference)
    } else {
      console.log('Unknown status, keeping as pending:', status)
    }

    return new Response(JSON.stringify({ success: true }), { 
      status: 200, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    })

  } catch (error) {
    console.error('Data webhook error:', error)
    return new Response(JSON.stringify({ error: 'Internal server error' }), { 
      status: 500, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    })
  }
})
