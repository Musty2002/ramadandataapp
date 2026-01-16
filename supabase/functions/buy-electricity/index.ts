import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface VerifyMeterRequest {
  provider_code: string
  meter_number: string
  meter_type: 'prepaid' | 'postpaid'
}

interface BuyElectricityRequest {
  provider_code: string
  meter_number: string
  meter_type: 'prepaid' | 'postpaid'
  amount: number
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
      return await handleVerifyMeter(req, supabase)
    }

    return await handlePurchaseElectricity(req, supabase, userId)

  } catch (error) {
    console.error('Electricity error:', error)
    return new Response(JSON.stringify({ error: 'Internal server error' }), { 
      status: 500, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    })
  }
})

async function handleVerifyMeter(req: Request, supabase: any) {
  const { provider_code, meter_number, meter_type }: VerifyMeterRequest = await req.json()

  if (!provider_code || !meter_number || !meter_type) {
    return new Response(JSON.stringify({ error: 'Missing required fields' }), { 
      status: 400, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    })
  }

  // Validate meter number format (10-13 digits)
  const cleanMeter = meter_number.replace(/\D/g, '')
  if (cleanMeter.length < 10 || cleanMeter.length > 13) {
    return new Response(JSON.stringify({ error: 'Invalid meter number format' }), { 
      status: 400, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    })
  }

  // Get provider from database
  const { data: provider, error: providerError } = await supabase
    .from('electricity_providers')
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

    console.log('Verifying meter:', { service_id: provider.service_id, meter: cleanMeter, type: meter_type })

    const response = await fetch('https://isquaredata.com/api/electricity/verify/', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${credentials}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        service_id: provider.service_id,
        meter_number: cleanMeter,
        meter_type: meter_type
      })
    })

    const data = await response.json()
    console.log('Verify response:', data)

    if (!response.ok || data.error || data.status === 'error') {
      return new Response(JSON.stringify({ 
        error: data.message || data.error || 'Meter verification failed',
        verified: false
      }), { 
        status: 400, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      })
    }

    return new Response(JSON.stringify({
      verified: true,
      customer_name: data.customer_name || data.name || 'Customer',
      customer_address: data.address || data.customer_address || '',
      meter_number: cleanMeter,
      provider: provider.name
    }), { 
      status: 200, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    })

  } catch (error) {
    console.error('Meter verification error:', error)
    return new Response(JSON.stringify({ error: 'Verification failed', verified: false }), { 
      status: 500, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    })
  }
}

async function handlePurchaseElectricity(req: Request, supabase: any, userId: string) {
  const { provider_code, meter_number, meter_type, amount, customer_name }: BuyElectricityRequest = await req.json()

  if (!provider_code || !meter_number || !meter_type || !amount) {
    return new Response(JSON.stringify({ error: 'Missing required fields' }), { 
      status: 400, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    })
  }

  // Validate amount
  if (amount < 500 || amount > 500000) {
    return new Response(JSON.stringify({ error: 'Amount must be between ₦500 and ₦500,000' }), { 
      status: 400, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    })
  }

  const cleanMeter = meter_number.replace(/\D/g, '')

  // Get provider
  const { data: provider, error: providerError } = await supabase
    .from('electricity_providers')
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

  // Check balance
  if (Number(wallet.balance) < amount) {
    return new Response(JSON.stringify({ error: 'Insufficient balance' }), { 
      status: 400, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    })
  }

  const reference = `ELEC-${Date.now()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`

  // Create pending transaction
  const { data: transaction, error: txError } = await supabase
    .from('transactions')
    .insert({
      user_id: userId,
      type: 'debit',
      amount: amount,
      status: 'pending',
      category: 'electricity',
      description: `${provider.name} - ${cleanMeter} (${meter_type})`,
      reference,
      metadata: {
        provider_code,
        provider_name: provider.name,
        meter_number: cleanMeter,
        meter_type,
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
      await updateTransactionFailed(supabase, transaction.id, userId, 'API credentials not configured', provider.name, cleanMeter)
      return new Response(JSON.stringify({ error: 'API credentials not configured' }), { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      })
    }

    const credentials = btoa(`${username}:${password}`)

    console.log('Buying electricity:', { service_id: provider.service_id, meter: cleanMeter, amount })

    const response = await fetch('https://isquaredata.com/api/electricity/buy/', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${credentials}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        service_id: provider.service_id,
        meter_number: cleanMeter,
        meter_type: meter_type,
        amount: amount,
        reference: reference
      })
    })

    const data = await response.json()
    console.log('Purchase response:', data)

    if (!response.ok || data.error || data.status === 'error') {
      const errorMsg = data.message || data.error || 'Purchase failed'
      await updateTransactionFailed(supabase, transaction.id, userId, errorMsg, provider.name, cleanMeter)
      return new Response(JSON.stringify({ error: errorMsg }), { 
        status: 400, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      })
    }

    // Debit wallet
    const newBalance = Number(wallet.balance) - amount
    await supabase.from('wallets').update({ balance: newBalance }).eq('user_id', userId)

    // Update transaction success
    await supabase
      .from('transactions')
      .update({ 
        status: 'success',
        metadata: {
          ...transaction.metadata,
          token: data.token || data.electricity_token,
          units: data.units,
          api_response: data
        }
      })
      .eq('id', transaction.id)

    // Send notification
    await supabase.from('notifications').insert({
      user_id: userId,
      title: 'Electricity Purchase Successful',
      message: `Token: ${data.token || data.electricity_token || 'Check your meter'}. ₦${amount} for ${provider.name}`,
      type: 'success'
    })

    return new Response(JSON.stringify({
      success: true,
      reference,
      token: data.token || data.electricity_token,
      units: data.units,
      message: `Electricity token generated for ${provider.name}`
    }), { 
      status: 200, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    })

  } catch (error) {
    console.error('Electricity purchase error:', error)
    const errorMsg = error instanceof Error ? error.message : 'Purchase failed'
    await updateTransactionFailed(supabase, transaction.id, userId, errorMsg, provider.name, cleanMeter)
    return new Response(JSON.stringify({ error: 'Electricity purchase failed' }), { 
      status: 500, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    })
  }
}

async function updateTransactionFailed(supabase: any, txId: string, userId: string, error: string, providerName: string, meterNumber: string) {
  await supabase
    .from('transactions')
    .update({ status: 'failed', metadata: { api_error: error } })
    .eq('id', txId)

  await supabase.from('notifications').insert({
    user_id: userId,
    title: 'Electricity Purchase Failed',
    message: `Failed to purchase electricity for ${providerName} - ${meterNumber}. ${error}`,
    type: 'error'
  })
}
