import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

type LegacyWebhookPayload = {
  event?: string
  data?: {
    reference?: string
    amount?: number
    customer_name?: string
    account_number?: string
    bank_name?: string
    transaction_reference?: string
    status?: string
  }
}

type NewWebhookPayload = {
  notification_status?: string
  transaction_id?: string
  amount_paid?: number
  settlement_amount?: number
  settlement_fee?: number
  transaction_status?: string
  sender?: { name?: string; account_number?: string; bank?: string }
  receiver?: { name?: string; account_number?: string; bank?: string }
  customer?: { name?: string; email?: string; phone?: string | null; customer_id?: string }
  description?: string
  timestamp?: string
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  // Only accept POST requests
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const body = (await req.json()) as LegacyWebhookPayload & NewWebhookPayload
    console.log('Webhook received:', JSON.stringify(body))

    // Support BOTH payload formats (legacy {event,data} and new flattened payload)
    const isLegacy = typeof body.event === 'string' && !!body.data

    const customerReference = isLegacy
      ? body.data?.reference
      : body.customer?.customer_id

    const receiverAccountNumber = isLegacy ? body.data?.account_number : body.receiver?.account_number

    const transactionReference = isLegacy ? body.data?.transaction_reference : body.transaction_id

    // Use settlement_amount (after fees) instead of amount_paid for accurate balance
    const amount = isLegacy ? body.data?.amount : (body.settlement_amount ?? body.amount_paid)

    const statusOk = isLegacy
      ? body.event === 'virtual_account.payment' && body.data?.status === 'successful'
      : body.notification_status === 'payment_successful' && body.transaction_status === 'success'

    if (!statusOk) {
      console.log('Ignoring non-successful webhook payload')
      return new Response(JSON.stringify({ success: true, message: 'Event ignored' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (!transactionReference || !amount) {
      console.error('Missing required fields:', { transactionReference, amount })
      return new Response(JSON.stringify({ error: 'Invalid payload: missing fields' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Find user by virtual account reference first (customer_id), then fallback to receiver account number.
    let profile:
      | { id: string; user_id: string; full_name: string }
      | null = null

    if (customerReference) {
      const { data } = await supabase
        .from('profiles')
        .select('id, user_id, full_name')
        .eq('virtual_account_reference', customerReference)
        .maybeSingle()
      profile = (data as any) ?? null
    }

    if (!profile && receiverAccountNumber) {
      const { data } = await supabase
        .from('profiles')
        .select('id, user_id, full_name')
        .eq('virtual_account_number', receiverAccountNumber)
        .maybeSingle()
      profile = (data as any) ?? null
    }

    if (!profile) {
      console.error('Profile not found for webhook:', { customerReference, receiverAccountNumber })
      return new Response(JSON.stringify({ error: 'User not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Idempotency: prevent double-credit for same transaction
    const { data: existingTx } = await supabase
      .from('transactions')
      .select('id')
      .eq('reference', transactionReference)
      .maybeSingle()

    if (existingTx) {
      console.log('Transaction already processed:', transactionReference)
      return new Response(JSON.stringify({ success: true, message: 'Transaction already processed' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Create transaction record
    const { error: txError } = await supabase.from('transactions').insert({
      user_id: profile.user_id,
      type: 'credit',
      category: 'deposit',
      amount,
      description: 'Deposit via virtual account',
      reference: transactionReference,
      status: 'completed',
      metadata: {
        source: 'paymentpoint',
        customer_reference: customerReference ?? null,
        receiver_account_number: receiverAccountNumber ?? null,
        raw: body,
      },
    })

    if (txError) {
      console.error('Transaction insert error:', txError)
      return new Response(JSON.stringify({ error: 'Failed to create transaction' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Update wallet balance
    const { data: wallet, error: walletFetchError } = await supabase
      .from('wallets')
      .select('balance')
      .eq('user_id', profile.user_id)
      .maybeSingle()

    if (walletFetchError || !wallet) {
      console.error('Wallet fetch error:', walletFetchError)
      return new Response(JSON.stringify({ error: 'Wallet not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const currentBalance = Number((wallet as any).balance) || 0
    const newBalance = currentBalance + Number(amount)

    const { error: walletUpdateError } = await supabase
      .from('wallets')
      .update({ balance: newBalance, updated_at: new Date().toISOString() })
      .eq('user_id', profile.user_id)

    if (walletUpdateError) {
      console.error('Wallet update error:', walletUpdateError)
      return new Response(JSON.stringify({ error: 'Failed to update wallet' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Create notification
    await supabase.from('notifications').insert({
      user_id: profile.user_id,
      title: 'Deposit Successful',
      message: `Your wallet has been credited with ₦${Number(amount).toLocaleString()}`,
      type: 'success',
    })

    console.log('Payment processed successfully:', {
      user_id: profile.user_id,
      amount,
      new_balance: newBalance,
      transaction_reference: transactionReference,
    })

    return new Response(JSON.stringify({ success: true, message: 'Payment processed successfully' }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('Webhook error:', error)
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
