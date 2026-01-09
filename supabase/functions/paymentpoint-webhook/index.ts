import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface WebhookPayload {
  event: string
  data: {
    reference: string
    amount: number
    customer_name: string
    account_number: string
    bank_name: string
    transaction_reference: string
    status: string
  }
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  // Only accept POST requests
  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const businessId = Deno.env.get('PAYMENTPOINT_BUSINESS_ID')!

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const payload: WebhookPayload = await req.json()
    console.log('Webhook received:', JSON.stringify(payload))

    // Validate the webhook event
    if (payload.event !== 'virtual_account.payment') {
      console.log('Ignoring non-payment event:', payload.event)
      return new Response(
        JSON.stringify({ success: true, message: 'Event ignored' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Validate payment status
    if (payload.data.status !== 'successful') {
      console.log('Ignoring unsuccessful payment:', payload.data.status)
      return new Response(
        JSON.stringify({ success: true, message: 'Non-successful payment ignored' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const { reference, amount, transaction_reference } = payload.data

    console.log('Processing payment:', { reference, amount, transaction_reference })

    // Find user by virtual account reference
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, user_id, full_name')
      .eq('virtual_account_reference', reference)
      .single()

    if (profileError || !profile) {
      console.error('Profile not found for reference:', reference, profileError)
      return new Response(
        JSON.stringify({ error: 'User not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('Found user:', profile.user_id, 'for reference:', reference)

    // Check if this transaction was already processed (idempotency)
    const { data: existingTx } = await supabase
      .from('transactions')
      .select('id')
      .eq('reference', transaction_reference)
      .single()

    if (existingTx) {
      console.log('Transaction already processed:', transaction_reference)
      return new Response(
        JSON.stringify({ success: true, message: 'Transaction already processed' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Start transaction: Create transaction record and update wallet
    const { error: txError } = await supabase
      .from('transactions')
      .insert({
        user_id: profile.user_id,
        type: 'credit',
        category: 'deposit',
        amount: amount,
        description: `Deposit via virtual account`,
        reference: transaction_reference,
        status: 'completed',
        metadata: {
          source: 'paymentpoint',
          virtual_account_reference: reference,
        }
      })

    if (txError) {
      console.error('Transaction insert error:', txError)
      return new Response(
        JSON.stringify({ error: 'Failed to create transaction' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Update wallet balance
    const { data: wallet, error: walletFetchError } = await supabase
      .from('wallets')
      .select('balance')
      .eq('user_id', profile.user_id)
      .single()

    if (walletFetchError || !wallet) {
      console.error('Wallet fetch error:', walletFetchError)
      return new Response(
        JSON.stringify({ error: 'Wallet not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const newBalance = Number(wallet.balance) + Number(amount)

    const { error: walletUpdateError } = await supabase
      .from('wallets')
      .update({ balance: newBalance, updated_at: new Date().toISOString() })
      .eq('user_id', profile.user_id)

    if (walletUpdateError) {
      console.error('Wallet update error:', walletUpdateError)
      return new Response(
        JSON.stringify({ error: 'Failed to update wallet' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Create notification for user
    await supabase
      .from('notifications')
      .insert({
        user_id: profile.user_id,
        title: 'Deposit Successful',
        message: `Your wallet has been credited with ₦${amount.toLocaleString()}`,
        type: 'success',
      })

    console.log('Payment processed successfully:', {
      user_id: profile.user_id,
      amount,
      new_balance: newBalance,
      transaction_reference,
    })

    return new Response(
      JSON.stringify({ success: true, message: 'Payment processed successfully' }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Webhook error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
