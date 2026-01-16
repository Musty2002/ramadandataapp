import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface BuyExamPinRequest {
  exam_code: string
  quantity?: number
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

    const { exam_code, quantity = 1 }: BuyExamPinRequest = await req.json()

    if (!exam_code) {
      return new Response(JSON.stringify({ error: 'Missing exam code' }), { 
        status: 400, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      })
    }

    if (quantity < 1 || quantity > 10) {
      return new Response(JSON.stringify({ error: 'Quantity must be between 1 and 10' }), { 
        status: 400, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      })
    }

    // Get exam pin from database
    const { data: examPin, error: examError } = await supabase
      .from('exam_pins')
      .select('*')
      .eq('code', exam_code)
      .eq('is_active', true)
      .maybeSingle()

    if (examError || !examPin) {
      return new Response(JSON.stringify({ error: 'Exam pin not found' }), { 
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

    const totalPrice = Number(examPin.price) * quantity
    if (Number(wallet.balance) < totalPrice) {
      return new Response(JSON.stringify({ error: 'Insufficient balance' }), { 
        status: 400, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      })
    }

    const reference = `EXAM-${Date.now()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`

    // Create pending transaction
    const { data: transaction, error: txError } = await supabase
      .from('transactions')
      .insert({
        user_id: userId,
        type: 'debit',
        amount: totalPrice,
        status: 'pending',
        category: 'exam',
        description: `${examPin.name} x${quantity}`,
        reference,
        metadata: {
          exam_code,
          exam_name: examPin.name,
          quantity,
          unit_price: examPin.price,
          service_id: examPin.service_id
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
        await updateTransactionFailed(supabase, transaction.id, userId, 'API credentials not configured', examPin.name)
        return new Response(JSON.stringify({ error: 'API credentials not configured' }), { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        })
      }

      const credentials = btoa(`${username}:${password}`)
      const pins: any[] = []

      // Buy pins one by one (or batch if API supports)
      for (let i = 0; i < quantity; i++) {
        console.log('Buying exam pin:', { service_id: examPin.service_id, iteration: i + 1 })

        const response = await fetch('https://isquaredata.com/api/education/buy/', {
          method: 'POST',
          headers: {
            'Authorization': `Basic ${credentials}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            service_id: examPin.service_id,
            reference: `${reference}-${i + 1}`
          })
        })

        const data = await response.json()
        console.log('Purchase response:', data)

        if (!response.ok || data.error || data.status === 'error') {
          if (pins.length === 0) {
            const errorMsg = data.message || data.error || 'Purchase failed'
            await updateTransactionFailed(supabase, transaction.id, userId, errorMsg, examPin.name)
            return new Response(JSON.stringify({ error: errorMsg }), { 
              status: 400, 
              headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
            })
          }
          break // Partial success
        }

        pins.push({
          pin: data.pin || data.token || data.serial,
          serial: data.serial || data.serial_number
        })
      }

      // Debit wallet for successful pins
      const actualCost = Number(examPin.price) * pins.length
      const newBalance = Number(wallet.balance) - actualCost
      await supabase.from('wallets').update({ balance: newBalance }).eq('user_id', userId)

      // Update transaction with actual amount and pins
      await supabase
        .from('transactions')
        .update({ 
          status: 'success',
          amount: actualCost,
          metadata: {
            ...transaction.metadata,
            pins,
            actual_quantity: pins.length
          }
        })
        .eq('id', transaction.id)

      // Send notification
      await supabase.from('notifications').insert({
        user_id: userId,
        title: 'Exam Pin Purchase Successful',
        message: `${pins.length}x ${examPin.name} purchased. Check transaction history for PIN(s).`,
        type: 'success'
      })

      return new Response(JSON.stringify({
        success: true,
        reference,
        pins,
        message: `${pins.length}x ${examPin.name} purchased successfully`
      }), { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      })

    } catch (error) {
      console.error('Exam pin purchase error:', error)
      const errorMsg = error instanceof Error ? error.message : 'Purchase failed'
      await updateTransactionFailed(supabase, transaction.id, userId, errorMsg, examPin.name)
      return new Response(JSON.stringify({ error: 'Exam pin purchase failed' }), { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      })
    }

  } catch (error) {
    console.error('Buy exam pin error:', error)
    return new Response(JSON.stringify({ error: 'Internal server error' }), { 
      status: 500, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    })
  }
})

async function updateTransactionFailed(supabase: any, txId: string, userId: string, error: string, examName: string) {
  await supabase
    .from('transactions')
    .update({ status: 'failed', metadata: { api_error: error } })
    .eq('id', txId)

  await supabase.from('notifications').insert({
    user_id: userId,
    title: 'Exam Pin Purchase Failed',
    message: `Failed to purchase ${examName}. ${error}`,
    type: 'error'
  })
}
