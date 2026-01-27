import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface BuyAirtimeRequest {
  network: string
  phone_number: string
  amount: number
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    // Validate authorization
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

    // Verify user
    const token = authHeader.replace('Bearer ', '')
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token)
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { 
        status: 401, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      })
    }

    const userId = claimsData.claims.sub as string

    // Parse request body
    const { network, phone_number, amount }: BuyAirtimeRequest = await req.json()

    if (!network || !phone_number || !amount) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), { 
        status: 400, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      })
    }

    // Validate phone number (Nigerian format)
    const cleanPhone = phone_number.replace(/\D/g, '')
    if (cleanPhone.length !== 11 || !['070', '080', '081', '090', '091'].some(p => cleanPhone.startsWith(p))) {
      return new Response(JSON.stringify({ error: 'Invalid phone number format' }), { 
        status: 400, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      })
    }

    // Validate amount
    if (amount < 50 || amount > 50000) {
      return new Response(JSON.stringify({ error: 'Amount must be between ₦50 and ₦50,000' }), { 
        status: 400, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      })
    }

    // Get best airtime plan (highest discount = cheapest for user)
    const { data: airtimePlans, error: planError } = await supabase
      .from('airtime_plans')
      .select('*')
      .eq('network', network.toLowerCase())
      .eq('is_active', true)
      .order('discount_percent', { ascending: false })

    // Pick the plan with highest discount (best for user)
    const bestPlan = airtimePlans && airtimePlans.length > 0 ? airtimePlans[0] : null
    const discountPercent = bestPlan?.discount_percent || 0
    const selectedProvider = bestPlan?.provider || 'isquare'
    const discountAmount = (amount * discountPercent) / 100
    const chargeAmount = amount - discountAmount // User pays less due to discount

    console.log('Selected provider for airtime:', { provider: selectedProvider, discount: discountPercent })

    // Get user's wallet
    const { data: wallet, error: walletError } = await supabase
      .from('wallets')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle()

    if (walletError || !wallet) {
      console.error('Wallet lookup error:', walletError)
      return new Response(JSON.stringify({ error: 'Wallet not found' }), { 
        status: 404, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      })
    }

    // Check sufficient balance
    if (Number(wallet.balance) < chargeAmount) {
      return new Response(JSON.stringify({ error: 'Insufficient balance' }), { 
        status: 400, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      })
    }

    // Generate unique reference
    const reference = `AIR-${Date.now()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`

    // Create pending transaction
    const { data: transaction, error: txError } = await supabase
      .from('transactions')
      .insert({
        user_id: userId,
        type: 'debit',
        amount: chargeAmount,
        status: 'pending',
        category: 'airtime',
        description: `₦${amount} ${network.toUpperCase()} Airtime to ${cleanPhone}`,
        reference,
        metadata: {
          network: network.toLowerCase(),
          phone_number: cleanPhone,
          airtime_amount: amount,
          charge_amount: chargeAmount,
          discount_percent: discountPercent,
          discount_amount: discountAmount,
          provider: selectedProvider
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

    // Call the appropriate airtime API based on best provider
    let apiResponse
    if (selectedProvider === 'rgc') {
      apiResponse = await callRgcAirtimeAPI(network.toLowerCase(), cleanPhone, amount, reference)
    } else if (selectedProvider === 'albarka') {
      apiResponse = await callAlbarkaAirtimeAPI(network.toLowerCase(), cleanPhone, amount, reference)
    } else {
      apiResponse = await callIsquareAirtimeAPI(network.toLowerCase(), cleanPhone, amount, reference)
    }

    if (apiResponse?.error) {
      console.error('API error:', apiResponse.error)

      // Update transaction as failed
      await supabase
        .from('transactions')
        .update({ 
          status: 'failed',
          metadata: {
            ...transaction.metadata,
            api_error: apiResponse.error,
            api_response: apiResponse
          }
        })
        .eq('id', transaction.id)

      // Create failure notification
      await supabase.from('notifications').insert({
        user_id: userId,
        title: 'Airtime Purchase Failed',
        message: `Failed to recharge ${cleanPhone} with ₦${amount}. ${apiResponse.error}`,
        type: 'error'
      })

      return new Response(JSON.stringify({ 
        error: 'Airtime purchase failed', 
        details: apiResponse.error 
      }), { 
        status: 400, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      })
    }

    // Debit wallet
    const newBalance = Number(wallet.balance) - chargeAmount
    const { error: debitError } = await supabase
      .from('wallets')
      .update({ balance: newBalance })
      .eq('user_id', userId)

    if (debitError) {
      console.error('Wallet debit error:', debitError)
    }

    // Update transaction
    const finalStatus = apiResponse?.status === 'success' ? 'success' : 'pending'
    await supabase
      .from('transactions')
      .update({ 
        status: finalStatus,
        metadata: {
          ...transaction.metadata,
          api_response: apiResponse
        }
      })
      .eq('id', transaction.id)

    // Create notification
    if (finalStatus === 'success') {
      await supabase.from('notifications').insert({
        user_id: userId,
        title: 'Airtime Purchase Successful',
        message: `₦${amount} airtime sent to ${cleanPhone}${discountAmount > 0 ? `. You saved ₦${discountAmount}!` : ''}`,
        type: 'success'
      })
    } else {
      await supabase.from('notifications').insert({
        user_id: userId,
        title: 'Airtime Purchase Processing',
        message: `Your ₦${amount} airtime recharge for ${cleanPhone} is being processed`,
        type: 'info'
      })
    }

    console.log('Airtime purchase completed:', { reference, status: finalStatus, amount })

    return new Response(JSON.stringify({ 
      success: true,
      reference,
      status: finalStatus,
      message: finalStatus === 'success' 
        ? `₦${amount} airtime sent to ${cleanPhone}` 
        : 'Your airtime purchase is being processed',
      discount: discountAmount > 0 ? `You saved ₦${discountAmount}` : null
    }), { 
      status: 200, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    })

  } catch (error) {
    console.error('Buy airtime error:', error)
    return new Response(JSON.stringify({ error: 'Internal server error' }), { 
      status: 500, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    })
  }
})

async function callIsquareAirtimeAPI(network: string, phoneNumber: string, amount: number, reference: string) {
  try {
    const username = Deno.env.get('ISQUARE_USERNAME')
    const password = Deno.env.get('ISQUARE_PASSWORD')

    if (!username || !password) {
      return { error: 'API credentials not configured' }
    }

    // Map network to iSquare network ID
    const networkMap: Record<string, number> = {
      'mtn': 1,
      'airtel': 2,
      'glo': 3,
      '9mobile': 4
    }

    const networkId = networkMap[network]
    if (!networkId) {
      return { error: 'Invalid network' }
    }

    const credentials = btoa(`${username}:${password}`)
    const webhookUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/data-webhook`

    console.log('Calling iSquare Airtime API:', { network, networkId, phone: phoneNumber, amount })

    const response = await fetch('https://isquaredata.com/api/airtime/buy/', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${credentials}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        network: networkId,
        amount: amount,
        phone_number: phoneNumber,
        reference: reference,
        webhook_url: webhookUrl
      })
    })

    const data = await response.json()
    console.log('iSquare Airtime API response:', data)

    if (!response.ok || data.error || data.status === 'error') {
      return { 
        error: data.message || data.error || 'iSquare API error',
        raw: data
      }
    }

    return {
      status: data.status === 'success' ? 'success' : 'pending',
      transaction_id: data.transaction_id || data.id,
      raw: data
    }
  } catch (error: unknown) {
    console.error('iSquare Airtime API call error:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return { error: `API call failed: ${message}` }
  }
}

async function callRgcAirtimeAPI(network: string, phoneNumber: string, amount: number, reference: string) {
  try {
    const apiKey = Deno.env.get('RGC_API_KEY')

    if (!apiKey) {
      return { error: 'RGC API key not configured' }
    }

    // Map network to RGC network code
    const networkMap: Record<string, string> = {
      'mtn': 'mtn',
      'airtel': 'airtel',
      'glo': 'glo',
      '9mobile': '9mobile'
    }

    const networkCode = networkMap[network]
    if (!networkCode) {
      return { error: 'Invalid network' }
    }

    console.log('Calling RGC Airtime API:', { network: networkCode, phone: phoneNumber, amount })

    const response = await fetch('https://rgc.ng/api/airtime/buy', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        network: networkCode,
        amount: amount,
        phone: phoneNumber,
        reference: reference
      })
    })

    const data = await response.json()
    console.log('RGC Airtime API response:', data)

    if (!response.ok || data.error || data.status === 'error') {
      return { 
        error: data.message || data.error || 'RGC API error',
        raw: data
      }
    }

    return {
      status: data.status === 'success' ? 'success' : 'pending',
      transaction_id: data.transaction_id || data.id,
      raw: data
    }
  } catch (error: unknown) {
    console.error('RGC Airtime API call error:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return { error: `API call failed: ${message}` }
  }
}

async function callAlbarkaAirtimeAPI(network: string, phoneNumber: string, amount: number, reference: string) {
  try {
    const apiToken = Deno.env.get('ALBARKA_API_TOKEN')

    if (!apiToken) {
      return { error: 'Albarka API token not configured' }
    }

    // Map network to Albarka network ID
    const networkMap: Record<string, number> = {
      'mtn': 1,
      'airtel': 2,
      'glo': 3,
      '9mobile': 4
    }

    const networkId = networkMap[network]
    if (!networkId) {
      return { error: 'Invalid network' }
    }

    console.log('Calling Albarka Airtime API:', { network: networkId, phone: phoneNumber, amount })

    const response = await fetch('https://app.albarkasub.com/api/topup/', {
      method: 'POST',
      headers: {
        'Authorization': `Token ${apiToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        network: networkId,
        phone: phoneNumber,
        amount: amount,
        bypass: false,
        'request-id': reference
      })
    })

    const data = await (async () => {
      try {
        return await response.json()
      } catch {
        const text = await response.text().catch(() => '')
        return { message: text || 'Invalid JSON from provider' }
      }
    })()
    console.log('Albarka Airtime API response:', data)

    if (!response.ok || data.error || data.Status === 'failed') {
      return { 
        error: data.api_response || data.message || data.error || 'Albarka API error',
        raw: data
      }
    }

    // Albarka returns Status: 'successful' on success
    const isSuccess = data.Status === 'successful' || data.status === 'success' || 
                      data.message?.toLowerCase().includes('success') ||
                      (response.ok && !data.error && data.ident);

    return {
      status: isSuccess ? 'success' : 'pending',
      transaction_id: data.ident || data.id,
      raw: data
    }
  } catch (error: unknown) {
    console.error('Albarka Airtime API call error:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return { error: `API call failed: ${message}` }
  }
}
