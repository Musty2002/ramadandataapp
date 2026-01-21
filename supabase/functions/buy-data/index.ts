import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface BuyDataRequest {
  plan_id: string
  phone_number: string
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
    const { plan_id, phone_number }: BuyDataRequest = await req.json()

    if (!plan_id || !phone_number) {
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

    // Get the data plan
    const { data: plan, error: planError } = await supabase
      .from('data_plans')
      .select('*')
      .eq('id', plan_id)
      .eq('is_active', true)
      .maybeSingle()

    if (planError || !plan) {
      console.error('Plan lookup error:', planError)
      return new Response(JSON.stringify({ error: 'Data plan not found or inactive' }), { 
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
      console.error('Wallet lookup error:', walletError)
      return new Response(JSON.stringify({ error: 'Wallet not found' }), { 
        status: 404, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      })
    }

    // Check sufficient balance
    const sellingPrice = Number(plan.selling_price)
    if (Number(wallet.balance) < sellingPrice) {
      return new Response(JSON.stringify({ error: 'Insufficient balance' }), { 
        status: 400, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      })
    }

    // Generate unique reference
    const reference = `DATA-${Date.now()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`

    // Create pending transaction first
    const { data: transaction, error: txError } = await supabase
      .from('transactions')
      .insert({
        user_id: userId,
        type: 'debit',
        amount: sellingPrice,
        status: 'pending',
        category: 'data',
        description: `${plan.display_name} for ${cleanPhone}`,
        reference,
        metadata: {
          plan_id: plan.id,
          plan_name: plan.display_name,
          phone_number: cleanPhone,
          network: plan.network,
          provider: plan.provider,
          api_price: plan.api_price
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

    // Call the API based on provider
    let apiResponse: any = null
    let apiError: string | null = null

    if (plan.provider === 'isquare') {
      apiResponse = await callIsquareDataAPI(plan, cleanPhone, reference)
    } else if (plan.provider === 'rgc') {
      apiResponse = await callRgcDataAPI(plan, cleanPhone, reference)
    }

    if (apiResponse?.error) {
      apiError = apiResponse.error
      console.error('API error:', apiError)

      // Update transaction as failed
      await supabase
        .from('transactions')
        .update({ 
          status: 'failed',
          metadata: {
            ...transaction.metadata,
            api_error: apiError,
            api_response: apiResponse
          }
        })
        .eq('id', transaction.id)

      // Create failure notification
      await supabase.from('notifications').insert({
        user_id: userId,
        title: 'Data Purchase Failed',
        message: `Failed to purchase ${plan.display_name} for ${cleanPhone}. ${apiError}`,
        type: 'error'
      })

      return new Response(JSON.stringify({ 
        error: 'Data purchase failed', 
        details: apiError 
      }), { 
        status: 400, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      })
    }

    // Debit wallet
    const newBalance = Number(wallet.balance) - sellingPrice
    const { error: debitError } = await supabase
      .from('wallets')
      .update({ balance: newBalance })
      .eq('user_id', userId)

    if (debitError) {
      console.error('Wallet debit error:', debitError)
      // Transaction stays pending, will be handled by webhook
    }

    // Update transaction with API response
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
        title: 'Data Purchase Successful',
        message: `${plan.display_name} has been sent to ${cleanPhone}`,
        type: 'success'
      })
    } else {
      await supabase.from('notifications').insert({
        user_id: userId,
        title: 'Data Purchase Processing',
        message: `Your ${plan.display_name} purchase for ${cleanPhone} is being processed`,
        type: 'info'
      })
    }

    console.log('Data purchase completed:', { reference, status: finalStatus, plan: plan.display_name })

    return new Response(JSON.stringify({ 
      success: true,
      reference,
      status: finalStatus,
      message: finalStatus === 'success' 
        ? `${plan.display_name} sent to ${cleanPhone}` 
        : 'Your data purchase is being processed'
    }), { 
      status: 200, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    })

  } catch (error) {
    console.error('Buy data error:', error)
    return new Response(JSON.stringify({ error: 'Internal server error' }), { 
      status: 500, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    })
  }
})

async function callIsquareDataAPI(plan: any, phoneNumber: string, reference: string) {
  try {
    const username = Deno.env.get('ISQUARE_USERNAME')
    const password = Deno.env.get('ISQUARE_PASSWORD')

    if (!username || !password) {
      return { error: 'API credentials not configured' }
    }

    const credentials = btoa(`${username}:${password}`)
    const webhookUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/data-webhook`

    console.log('Calling iSquare API:', { service_id: plan.service_id, plan_id: plan.plan_id, phone: phoneNumber })

    const response = await fetch('https://isquaredata.com/api/data/buy/', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${credentials}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        service_id: plan.service_id,
        // iSquare expects `plan` in some versions, but other endpoints use `plan_id`.
        // Send both to avoid mismatches across iSquare deployments.
        plan: plan.plan_id,
        plan_id: plan.plan_id,
        phone_number: phoneNumber,
        reference: reference,
        webhook_url: webhookUrl
      })
    })

    const data = await response.json()
    console.log('iSquare API response:', data)

    const validationPlanError = Array.isArray((data as any)?.plan)
      ? (data as any).plan.join(', ')
      : undefined

    if (!response.ok || data.error || data.status === 'error' || validationPlanError) {
      return { 
        error: data.message || data.error || validationPlanError || 'iSquare API error',
        raw: data
      }
    }

    return {
      status: data.status === 'success' ? 'success' : 'pending',
      transaction_id: data.transaction_id || data.id,
      raw: data
    }
  } catch (error: unknown) {
    console.error('iSquare API call error:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return { error: `API call failed: ${message}` }
  }
}

async function callRgcDataAPI(plan: any, phoneNumber: string, reference: string) {
  try {
    const apiKey = Deno.env.get('RGC_API_KEY')

    if (!apiKey) {
      return { error: 'RGC API key not configured' }
    }

    console.log('Calling RGC API:', { product_id: plan.product_id, phone: phoneNumber })

    const response = await fetch('https://api.rgcdata.com.ng/api/v2/purchase/data', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        id: plan.product_id,
        number: phoneNumber,
        reference: reference
      })
    })

    const data = await response.json()
    console.log('RGC API response:', data)

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
    console.error('RGC API call error:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return { error: `API call failed: ${message}` }
  }
}
