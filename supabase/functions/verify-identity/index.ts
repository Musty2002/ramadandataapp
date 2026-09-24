import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) return json({ error: 'Unauthorized' }, 401)

    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
    const { data: { user }, error: authError } = await admin.auth.getUser(authHeader.replace('Bearer ', ''))
    if (authError || !user) return json({ error: 'Unauthorized' }, 401)
    const userId = user.id

    const { data: profile } = await admin.from('profiles').select('is_blocked').eq('user_id', userId).maybeSingle()
    if (profile?.is_blocked) return json({ error: 'Your account has been suspended. Please contact support.' }, 403)

    const body = await req.json().catch(() => ({}))
    const idType = String(body.id_type || '').toLowerCase()
    const idNumber = String(body.id_number || '').replace(/\D/g, '')
    if (!['bvn', 'nin'].includes(idType)) return json({ error: 'Invalid verification type' }, 400)
    if (idNumber.length !== 11) return json({ error: `${idType.toUpperCase()} must be exactly 11 digits` }, 400)

    const { data: price } = await admin.from('verification_prices').select('*').eq('id_type', idType).maybeSingle()
    if (!price || !price.is_active) return json({ error: `${idType.toUpperCase()} verification is currently unavailable` }, 400)
    const charge = Number(price.selling_price)

    // Atomic wallet deduction before API call
    const { data: newBalance, error: deductError } = await admin.rpc('deduct_wallet_balance', { p_user_id: userId, p_amount: charge })
    if (deductError) {
      const msg = deductError.message || ''
      if (msg.includes('INSUFFICIENT_BALANCE')) return json({ error: 'Insufficient balance' }, 400)
      if (msg.includes('WALLET_NOT_FOUND')) return json({ error: 'Wallet not found' }, 404)
      return json({ error: 'Failed to process payment' }, 500)
    }

    const reference = `KYC-${Date.now()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`
    const masked = `${idNumber.slice(0, 3)}*****${idNumber.slice(-3)}`
    const { data: tx } = await admin.from('transactions').insert({
      user_id: userId, type: 'debit', category: 'verification', amount: charge, status: 'pending',
      description: `${idType.toUpperCase()} Verification (${masked})`, reference,
      metadata: { id_type: idType, id_number_masked: masked, api_price: price.api_price, provider: 'paymentpoint' },
    }).select().single()

    const refund = async (reason: string) => {
      const { data: w } = await admin.from('wallets').select('balance').eq('user_id', userId).single()
      await admin.from('wallets').update({ balance: Number(w?.balance || 0) + charge }).eq('user_id', userId)
      if (tx) await admin.from('transactions').update({ status: 'failed', metadata: { ...(tx.metadata as object), api_error: reason } }).eq('id', tx.id)
    }

    let res: Response, data: any
    try {
      const controller = new AbortController()
      const t = setTimeout(() => controller.abort(), 90000)
      res = await fetch('https://api.paymentpoint.co/api/identity/verify', {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'Authorization': `Bearer ${Deno.env.get('PAYMENTPOINT_API_SECRET')}`,
          'api-key': Deno.env.get('PAYMENTPOINT_API_KEY')!,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ id_type: idType, id_number: idNumber, businessId: Deno.env.get('PAYMENTPOINT_BUSINESS_ID') }),
      })
      clearTimeout(t)
      data = await res.json().catch(() => ({}))
    } catch (e) {
      await refund(e instanceof Error ? e.message : 'Network error')
      return json({ error: 'Verification service is unavailable. You have been refunded.' }, 503)
    }

    if (!res.ok || data?.status !== 'success') {
      const providerMsg = String(data?.message || 'Verification failed')
      console.error('PaymentPoint verify error:', res.status, providerMsg)
      await refund(providerMsg)
      let userMsg = 'Verification failed. You have been refunded.'
      if (res.status === 404 && /record/i.test(providerMsg)) userMsg = `No record found for this ${idType.toUpperCase()}. You have been refunded.`
      else if (res.status === 422) userMsg = `Invalid ${idType.toUpperCase()} number. You have been refunded.`
      else if (res.status === 503) userMsg = 'Verification service is temporarily unavailable. Please try again shortly. You have been refunded.'
      return json({ error: userMsg }, 400)
    }

    const d = data.data || {}
    const personal = d.personal_details || {}
    const contact = d.contact_details || {}
    // Never persist the biometric photo
    if (tx) {
      await admin.from('transactions').update({
        status: 'completed',
        metadata: {
          ...(tx.metadata as object),
          full_name: personal.full_name ?? null,
          request_id: d.verification_metadata?.request_id ?? null,
          cost_charged: d.verification_metadata?.cost_charged ?? null,
        },
      }).eq('id', tx.id)
    }
    await admin.from('notifications').insert({
      user_id: userId, title: `${idType.toUpperCase()} Verified`,
      message: `${idType.toUpperCase()} ${masked} verified successfully.`, type: 'success',
    })

    return json({
      success: true, reference, balance: newBalance,
      result: {
        verification_type: idType,
        identity_number: idNumber,
        personal_details: personal,
        contact_details: contact,
        photo: d.biometric_data?.photo_available ? d.biometric_data.photo : null,
      },
    })
  } catch (error) {
    console.error('verify-identity error:', error)
    return json({ error: 'Internal server error' }, 500)
  }
})
