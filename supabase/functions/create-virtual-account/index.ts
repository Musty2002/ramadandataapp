import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface PaymentPointResponse {
  status: boolean
  message: string
  data?: {
    account_number: string
    account_name: string
    bank_name: string
    reference: string
  }
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const apiKey = Deno.env.get('PAYMENTPOINT_API_KEY')!
    const apiSecret = Deno.env.get('PAYMENTPOINT_API_SECRET')!
    const businessId = Deno.env.get('PAYMENTPOINT_BUSINESS_ID')!

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Get user from auth header
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'No authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)

    if (authError || !user) {
      console.error('Auth error:', authError)
      return new Response(
        JSON.stringify({ error: 'Invalid token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get user profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', user.id)
      .single()

    if (profileError || !profile) {
      console.error('Profile error:', profileError)
      return new Response(
        JSON.stringify({ error: 'Profile not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Check if user already has a virtual account
    if (profile.virtual_account_number) {
      return new Response(
        JSON.stringify({
          success: true,
          message: 'Virtual account already exists',
          data: {
            account_number: profile.virtual_account_number,
            account_name: profile.virtual_account_name,
            bank_name: profile.virtual_account_bank,
          }
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Generate unique reference
    const reference = `VA_${user.id.replace(/-/g, '').substring(0, 16)}_${Date.now()}`

    console.log('Creating virtual account for user:', user.id, 'with reference:', reference)

    // Create virtual account via Payment Point API (Opay only)
    const response = await fetch('https://paymentpoint.co/api/v1/virtual-account/create', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Api-Key': apiKey,
        'Api-Secret': apiSecret,
      },
      body: JSON.stringify({
        business_id: businessId,
        customer_name: profile.full_name,
        customer_email: profile.email || `${user.id}@ramadandata.app`,
        customer_phone: profile.phone,
        reference: reference,
        bank: 'opay', // Opay only as per user preference
      }),
    })

    const result: PaymentPointResponse = await response.json()
    console.log('Payment Point response:', JSON.stringify(result))

    if (!result.status || !result.data) {
      console.error('Payment Point error:', result.message)
      return new Response(
        JSON.stringify({ error: result.message || 'Failed to create virtual account' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Update profile with virtual account details
    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        virtual_account_number: result.data.account_number,
        virtual_account_bank: result.data.bank_name,
        virtual_account_name: result.data.account_name,
        virtual_account_reference: reference,
      })
      .eq('user_id', user.id)

    if (updateError) {
      console.error('Update error:', updateError)
      return new Response(
        JSON.stringify({ error: 'Failed to save virtual account' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('Virtual account created successfully for user:', user.id)

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Virtual account created successfully',
        data: {
          account_number: result.data.account_number,
          account_name: result.data.account_name,
          bank_name: result.data.bank_name,
        }
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Unexpected error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
