import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface VerifySmartcardRequest {
  provider_code: string
  smartcard_number: string
}

interface BuyCableRequest {
  provider_code: string
  smartcard_number: string
  bouquet_id: string
  customer_name?: string
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { 
        status: 401, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      })
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    )

    const token = authHeader.replace('Bearer ', '')
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token)
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { 
        status: 401, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      })
    }

    const userId = claimsData.claims.sub as string
    const url = new URL(req.url)
    const action = url.searchParams.get('action') || 'purchase'

    if (action === 'verify') {
      return await handleVerifySmartcard(req, supabase)
    }

    return await handlePurchaseCable(req, supabase, userId)

  } catch (error) {
    console.error('Cable error:', error)
    return new Response(JSON.stringify({ error: 'Internal server error' }), { 
      status: 500, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    })
  }
})

async function handleVerifySmartcard(req: Request, supabase: any) {
  const { provider_code, smartcard_number }: VerifySmartcardRequest = await req.json()

  if (!provider_code || !smartcard_number) {
    return new Response(JSON.stringify({ error: 'Missing required fields' }), { 
      status: 400, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    })
  }

  // Validate smartcard number format (10-12 digits)
  const cleanCard = smartcard_number.replace(/\D/g, '')
  if (cleanCard.length < 10 || cleanCard.length > 12) {
    return new Response(JSON.stringify({ error: 'Invalid smartcard number format' }), { 
      status: 400, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    })
  }

  // Get provider from database
  const { data: provider, error: providerError } = await supabase
    .from('cable_providers')
    .select('*')
    .eq('code', provider_code)
    .eq('is_active', true)
    .maybeSingle()

  if (providerError || !provider) {
    return new Response(JSON.stringify({ error: 'Provider not found' }), { 
      status: 404, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    })
  }

  // Call iSquare verify API
  try {
    const username = Deno.env.get('ISQUARE_USERNAME')
    const password = Deno.env.get('ISQUARE_PASSWORD')

    if (!username || !password) {
      return new Response(JSON.stringify({ error: 'API credentials not configured' }), { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      })
    }

    const credentials = btoa(`${username}:${password}`)

    console.log('Verifying smartcard:', { service_id: provider.service_id, card: cleanCard })

    const response = await fetch('https://isquaredata.com/api/cable/verify/', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${credentials}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        service_id: provider.service_id,
        iuc_number: cleanCard
      })
    })

    const data = await response.json()
    console.log('Verify response:', data)

    if (!response.ok || data.error || data.status === 'error') {
      return new Response(JSON.stringify({ 
        error: data.message || data.error || 'Smartcard verification failed',
        verified: false
      }), { 
        status: 400, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      })
    }

    return new Response(JSON.stringify({
      verified: true,
      customer_name: data.customer_name || data.name || 'Customer',
      current_bouquet: data.current_bouquet || data.bouquet || '',
      due_date: data.due_date || data.expiry_date || '',
      smartcard_number: cleanCard,
      provider: provider.name
    }), { 
      status: 200, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    })

  } catch (error) {
    console.error('Smartcard verification error:', error)
    return new Response(JSON.stringify({ error: 'Verification failed', verified: false }), { 
      status: 500, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    })
  }
}

async function handlePurchaseCable(req: Request, supabase: any, userId: string) {
  const { provider_code, smartcard_number, bouquet_id, customer_name }: BuyCableRequest = await req.json()

  if (!provider_code || !smartcard_number || !bouquet_id) {
    return new Response(JSON.stringify({ error: 'Missing required fields' }), { 
      status: 400, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    })
  }

  const cleanCard = smartcard_number.replace(/\D/g, '')

  // Get provider
  const { data: provider, error: providerError } = await supabase
    .from('cable_providers')
    .select('*')
    .eq('code', provider_code)
    .eq('is_active', true)
    .maybeSingle()

  if (providerError || !provider) {
    return new Response(JSON.stringify({ error: 'Provider not found' }), { 
      status: 404, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    })
  }

  // Get bouquet
  const { data: bouquet, error: bouquetError } = await supabase
    .from('cable_bouquets')
    .select('*')
    .eq('id', bouquet_id)
    .eq('is_active', true)
    .maybeSingle()

  if (bouquetError || !bouquet) {
    return new Response(JSON.stringify({ error: 'Bouquet not found' }), { 
      status: 404, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    })
  }

  // Get user's wallet
  const { data: wallet, error: walletError } = await supabase
    .from('wallets')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle()

  if (walletError || !wallet) {
    return new Response(JSON.stringify({ error: 'Wallet not found' }), { 
      status: 404, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    })
  }

  const price = Number(bouquet.price)
  if (Number(wallet.balance) < price) {
    return new Response(JSON.stringify({ error: 'Insufficient balance' }), { 
      status: 400, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    })
  }

  const reference = `CABLE-${Date.now()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`

  // Create pending transaction
  const { data: transaction, error: txError } = await supabase
    .from('transactions')
    .insert({
      user_id: userId,
      type: 'debit',
      amount: price,
      status: 'pending',
      category: 'cable',
      description: `${provider.name} - ${bouquet.name} for ${cleanCard}`,
      reference,
      metadata: {
        provider_code,
        provider_name: provider.name,
        bouquet_name: bouquet.name,
        plan_id: bouquet.plan_id,
        smartcard_number: cleanCard,
        customer_name,
        service_id: provider.service_id
      }
    })
    .select()
    .single()

  if (txError) {
    console.error('Transaction creation error:', txError)
    return new Response(JSON.stringify({ error: 'Failed to create transaction' }), { 
      status: 500, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    })
  }

  // Call iSquare API
  try {
    const username = Deno.env.get('ISQUARE_USERNAME')
    const password = Deno.env.get('ISQUARE_PASSWORD')

    if (!username || !password) {
      await updateTransactionFailed(supabase, transaction.id, userId, 'API credentials not configured', provider.name, cleanCard)
      return new Response(JSON.stringify({ error: 'API credentials not configured' }), { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      })
    }

    const credentials = btoa(`${username}:${password}`)

    console.log('Buying cable:', { service_id: provider.service_id, plan_id: bouquet.plan_id, card: cleanCard })

    const response = await fetch('https://isquaredata.com/api/cable/buy/', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${credentials}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        service_id: provider.service_id,
        plan_id: bouquet.plan_id,
        iuc_number: cleanCard,
        reference: reference
      })
    })

    const data = await response.json()
    console.log('Purchase response:', data)

    if (!response.ok || data.error || data.status === 'error') {
      const errorMsg = data.message || data.error || 'Purchase failed'
      await updateTransactionFailed(supabase, transaction.id, userId, errorMsg, provider.name, cleanCard)
      return new Response(JSON.stringify({ error: errorMsg }), { 
        status: 400, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      })
    }

    // Debit wallet
    const newBalance = Number(wallet.balance) - price
    await supabase.from('wallets').update({ balance: newBalance }).eq('user_id', userId)

    // Update transaction success
    await supabase
      .from('transactions')
      .update({ 
        status: 'success',
        metadata: {
          ...transaction.metadata,
          api_response: data
        }
      })
      .eq('id', transaction.id)

    // Send notification
    await supabase.from('notifications').insert({
      user_id: userId,
      title: 'Cable Subscription Successful',
      message: `${bouquet.name} subscription activated for ${provider.name} - ${cleanCard}`,
      type: 'success'
    })

    return new Response(JSON.stringify({
      success: true,
      reference,
      message: `${bouquet.name} subscription activated for ${provider.name}`
    }), { 
      status: 200, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    })

  } catch (error) {
    console.error('Cable purchase error:', error)
    const errorMsg = error instanceof Error ? error.message : 'Purchase failed'
    await updateTransactionFailed(supabase, transaction.id, userId, errorMsg, provider.name, cleanCard)
    return new Response(JSON.stringify({ error: 'Cable subscription failed' }), { 
      status: 500, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    })
  }
}

async function updateTransactionFailed(supabase: any, txId: string, userId: string, error: string, providerName: string, cardNumber: string) {
  await supabase
    .from('transactions')
    .update({ status: 'failed', metadata: { api_error: error } })
    .eq('id', txId)

  await supabase.from('notifications').insert({
    user_id: userId,
    title: 'Cable Subscription Failed',
    message: `Failed to subscribe ${providerName} for ${cardNumber}. ${error}`,
    type: 'error'
  })
}
