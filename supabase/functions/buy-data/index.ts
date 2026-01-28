import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface BuyDataRequest {
  plan_id: string
  phone_number: string
}

function asObject(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

function isIsquarePlanInactiveError(message: string) {
  return /plan\s+is\s+either\s+currently\s+inactive\s+or\s+does\s+not\s+exist/i.test(message)
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

    const baseTxMetadata = asObject(transaction.metadata)

    // Create admin client for status updates (RLS blocks user updates on transactions)
    const adminSupabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // Call the API based on provider
    let apiResponse: any = null
    let apiError: string | null = null
    let planUsed: any = plan

    if (plan.provider === 'isquare') {
      apiResponse = await callIsquareDataAPI(plan, cleanPhone, reference)

      // If iSquare rejects the plan as inactive/non-existent, try a same-price fallback plan (RGC)
      if (apiResponse?.error && isIsquarePlanInactiveError(String(apiResponse.error))) {
        const { data: fallbackPlan } = await supabase
          .from('data_plans')
          .select('*')
          .eq('network', plan.network)
          .eq('category', plan.category)
          .eq('data_amount', plan.data_amount)
          .eq('provider', 'rgc')
          .eq('is_active', true)
          .not('product_id', 'is', null)
          .eq('selling_price', sellingPrice)
          .order('selling_price', { ascending: true })
          .limit(1)
          .maybeSingle()

        if (fallbackPlan) {
          const fallbackResp = await callRgcDataAPI(fallbackPlan, cleanPhone, reference)
          if (!fallbackResp?.error) {
            planUsed = fallbackPlan
            apiResponse = {
              ...fallbackResp,
              fallback: {
                from_provider: 'isquare',
                from_plan_id: plan.id,
                to_provider: 'rgc',
                to_plan_id: fallbackPlan.id,
              },
            }
          }
        } else {
          // Mark this plan inactive so it won't be shown again.
          // We use a service-role client here because end-users cannot update plans.
          try {
            const adminSupabase = createClient(
              Deno.env.get('SUPABASE_URL')!,
              Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
            )
            await adminSupabase
              .from('data_plans')
              .update({ is_active: false, updated_at: new Date().toISOString() })
              .eq('id', plan.id)
            console.log('Auto-disabled unavailable iSquare plan:', { id: plan.id, service_id: plan.service_id, plan_id: plan.plan_id })
          } catch (e) {
            console.error('Failed to auto-disable plan:', e)
          }

          // Give a user-actionable error instead of a vague provider error.
          apiResponse = {
            error: 'Selected bundle is currently unavailable. Please choose another plan.',
            raw: apiResponse?.raw,
          }
        }
      }
  } else if (plan.provider === 'rgc') {
      apiResponse = await callRgcDataAPI(plan, cleanPhone, reference)
    } else if (plan.provider === 'albarka') {
      apiResponse = await callAlbarkaDataAPI(plan, cleanPhone, reference)
    }

    if (apiResponse?.error) {
      apiError = apiResponse.error
      console.error('API error:', apiError)

      // Update transaction as failed using admin client
      const { error: updateError } = await adminSupabase
        .from('transactions')
        .update({ 
          status: 'failed',
          metadata: {
            ...baseTxMetadata,
            api_error: apiError,
            api_response: apiResponse
          }
        })
        .eq('id', transaction.id)

      if (updateError) {
        console.error('Failed to update transaction status:', updateError)
      }

      // Create failure notification
      await adminSupabase.from('notifications').insert({
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

    // Update transaction with API response using admin client
    const finalStatus = apiResponse?.status === 'success' ? 'completed' : 'pending'
    const { error: updateError } = await adminSupabase
      .from('transactions')
      .update({ 
        status: finalStatus,
        metadata: {
          ...baseTxMetadata,
          provider_used: planUsed?.provider ?? plan.provider,
          plan_used_id: planUsed?.id ?? plan.id,
          api_response: apiResponse
        }
      })
      .eq('id', transaction.id)

    if (updateError) {
      console.error('Failed to update transaction status:', updateError)
    }

    // Create notification using admin client
    if (finalStatus === 'completed') {
      await adminSupabase.from('notifications').insert({
        user_id: userId,
        title: 'Data Purchase Successful',
        message: `${planUsed.display_name} has been sent to ${cleanPhone}`,
        type: 'success'
      })
    } else {
      await adminSupabase.from('notifications').insert({
        user_id: userId,
        title: 'Data Purchase Processing',
        message: `Your ${planUsed.display_name} purchase for ${cleanPhone} is being processed`,
        type: 'info'
      })
    }

    console.log('Data purchase completed:', { reference, status: finalStatus, plan: planUsed.display_name })

    return new Response(JSON.stringify({ 
      success: true,
      reference,
      status: finalStatus,
      message: finalStatus === 'completed' 
        ? `${planUsed.display_name} sent to ${cleanPhone}` 
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

    if (plan.service_id == null || plan.plan_id == null) {
      return { error: 'Plan mapping missing (service_id/plan_id). Please choose another plan.' }
    }

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

    const data = await (async () => {
      try {
        return await response.json()
      } catch {
        const text = await response.text().catch(() => '')
        return { message: text || 'Invalid JSON from provider' }
      }
    })()
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

    // iSquare returns various success indicators
    const isSuccess = data.status === 'success' || data.status === 'completed' || 
                      data.message?.toLowerCase().includes('success') ||
                      (response.ok && !data.error && data.transaction_id);
    
    return {
      status: isSuccess ? 'success' : 'pending',
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

    console.log('Calling RGC API:', { plan: plan.product_id, mobile_number: phoneNumber })

    if (!plan.product_id) {
      return { error: 'Plan mapping missing (product_id). Please choose another plan.' }
    }

    // RGC API expects 'plan' as integer (product_id) and 'mobile_number' fields
    // The documentation shows: { "plan": 6, "mobile_number": "08012345678" }
    const planId = parseInt(plan.product_id, 10)
    
    console.log('RGC request body:', { plan: planId, mobile_number: phoneNumber })
    
    const response = await fetch('https://api.rgcdata.com.ng/api/v2/purchase/data', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        plan: planId,
        mobile_number: phoneNumber
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
    console.log('RGC API response:', data)

    if (!response.ok || data.error || data.status === 'error') {
      return { 
        error: data.message || data.error || 'RGC API error',
        raw: data
      }
    }

    // RGC returns various success indicators
    const isSuccess = data.status === 'success' || data.status === 'completed' || 
                      data.message?.toLowerCase().includes('success') ||
                      (response.ok && !data.error && (data.transaction_id || data.id));
    
    return {
      status: isSuccess ? 'success' : 'pending',
      transaction_id: data.transaction_id || data.id,
      raw: data
    }
  } catch (error: unknown) {
    console.error('RGC API call error:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return { error: `API call failed: ${message}` }
  }
}

async function callAlbarkaDataAPI(plan: any, phoneNumber: string, reference: string) {
  try {
    const username = Deno.env.get('ALBARKA_USERNAME')
    const password = Deno.env.get('ALBARKA_PASSWORD')

    if (!username || !password) {
      return { error: 'Albarka API credentials not configured' }
    }

    console.log('Calling Albarka API:', { plan_id: plan.plan_id, phone: phoneNumber, network: plan.network })

    if (!plan.plan_id) {
      return { error: 'Plan mapping missing (plan_id). Please choose another plan.' }
    }

    // Map network names to Albarka network IDs
    const networkMap: Record<string, number> = {
      'mtn': 1,
      'airtel': 2,
      'glo': 3,
      '9mobile': 4
    }

    const networkId = networkMap[plan.network.toLowerCase()]
    if (!networkId) {
      return { error: 'Invalid network for Albarka' }
    }

    // Albarka uses base64-encoded username:password as the Token
    const authToken = btoa(`${username}:${password}`)
    console.log('Albarka request payload:', { network: networkId, phone: phoneNumber, data_plan: plan.plan_id, bypass: false, 'request-id': reference })

    const response = await fetch('https://albarkasub.com/api/data/', {
      method: 'POST',
      headers: {
        'Authorization': `Token ${authToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        network: networkId,
        phone: phoneNumber,
        data_plan: plan.plan_id,
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
    console.log('Albarka API response:', data)

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
    console.error('Albarka API call error:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return { error: `API call failed: ${message}` }
  }
}
