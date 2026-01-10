import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface BankAccount {
  // PaymentPoint can return either snake_case or camelCase keys depending on version
  bank_name?: string
  bank_code?: string
  account_number?: string
  account_name?: string

  bankName?: string
  bankCode?: string
  accountNumber?: string
  accountName?: string
}

interface PaymentPointResponse {
  status: string
  message: string
  customer?: {
    customer_id: string
    customer_name: string
    customer_email: string
    customer_phone_number: string
  }
  bankAccounts?: BankAccount[]
  errors?: string[]
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

    console.log('Creating virtual account for user:', user.id)

    // Create virtual account via Payment Point API
    // Try both Opay (20897) and PalmPay (20946) for better success rate
    const response = await fetch('https://api.paymentpoint.co/api/v1/createVirtualAccount', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiSecret}`,
        'api-key': apiKey,
      },
      body: JSON.stringify({
        email: profile.email || `user${user.id.substring(0, 8)}@ramadandata.app`,
        name: profile.full_name,
        phoneNumber: profile.phone,
        bankCode: ['20946', '20897'], // Try both PalmPay and Opay
        businessId: businessId,
      }),
    })

    // Log raw response for debugging
    const responseText = await response.text()
    console.log('Payment Point raw response:', responseText)
    console.log('Response status:', response.status)

    // Try to parse as JSON
    let result: PaymentPointResponse
    try {
      result = JSON.parse(responseText)
    } catch (parseError) {
      console.error('Failed to parse Payment Point response as JSON:', parseError)
      console.error('Raw response was:', responseText.substring(0, 500))
      return new Response(
        JSON.stringify({ error: 'Invalid response from payment provider' }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('Payment Point parsed response:', JSON.stringify(result))

    // Check if status is success (it's a string, not boolean)
    if (result.status !== 'success') {
      console.error('Payment Point error:', result.message)
      return new Response(
        JSON.stringify({ error: result.message || 'Failed to create virtual account' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Check if any bank accounts were created
    if (!result.bankAccounts || result.bankAccounts.length === 0) {
      console.error('No bank accounts created. Errors:', result.errors)
      return new Response(
        JSON.stringify({ 
          error: result.errors?.[0] || 'No virtual account could be created. Please try again later.',
          details: result.errors 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get the first successful bank account
    const bankAccount = result.bankAccounts[0]
    console.log('Bank account created:', JSON.stringify(bankAccount))

    // Normalize bank account fields (handle snake_case + camelCase)
    const accountNumber = (bankAccount as any).account_number ?? (bankAccount as any).accountNumber ?? null
    const bankName = (bankAccount as any).bank_name ?? (bankAccount as any).bankName ?? null
    const accountName = (bankAccount as any).account_name ?? (bankAccount as any).accountName ?? null

    if (!accountNumber || !bankName || !accountName) {
      console.error('Payment Point returned incomplete bank account details:', JSON.stringify(bankAccount))
      return new Response(
        JSON.stringify({ error: 'Payment provider returned incomplete bank account details' }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Update profile with virtual account details
    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        virtual_account_number: accountNumber,
        virtual_account_bank: bankName,
        virtual_account_name: accountName,
        virtual_account_reference: result.customer?.customer_id || user.id,
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
          account_number: accountNumber,
          account_name: accountName,
          bank_name: bankName,
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
