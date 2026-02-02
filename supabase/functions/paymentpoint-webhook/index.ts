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

    // Create notification with fee breakdown
    const amountPaid = isLegacy ? body.data?.amount : body.amount_paid
    const settlementFee = isLegacy ? 0 : (body.settlement_fee ?? 0)
    const feeMessage = settlementFee > 0 
      ? ` (₦${Number(amountPaid).toLocaleString()} received, ₦${Number(settlementFee).toLocaleString()} fee)`
      : ''
    
    await supabase.from('notifications').insert({
      user_id: profile.user_id,
      title: 'Deposit Successful',
      message: `Your wallet has been credited with ₦${Number(amount).toLocaleString()}${feeMessage}`,
      type: 'success',
    })

    // Send push notification for credit alert
    const pushTitle = '💰 Credit Alert!'
    const pushBody = `₦${Number(amount).toLocaleString()} has been credited to your wallet.${feeMessage ? ` ${feeMessage}` : ''} New balance: ₦${newBalance.toLocaleString()}`
    
    // Fetch user's push tokens
    const { data: pushTokens } = await supabase
      .from('push_subscriptions')
      .select('endpoint')
      .eq('user_id', profile.user_id)
    
    if (pushTokens && pushTokens.length > 0) {
      console.log(`Sending push notifications to ${pushTokens.length} device(s)`)
      
      // Send push to all user's devices
      for (const tokenRecord of pushTokens) {
        try {
          const pushResponse = await fetch(`${supabaseUrl}/functions/v1/send-push-notification`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${supabaseServiceKey}`,
            },
            body: JSON.stringify({
              token: tokenRecord.endpoint,
              title: pushTitle,
              body: pushBody,
              data: {
                type: 'credit',
                amount: String(amount),
                new_balance: String(newBalance),
                transaction_reference: transactionReference,
              },
            }),
          })
          
          const pushResult = await pushResponse.json()
          console.log('Push notification result:', pushResult)
          
          // Clean up unregistered tokens
          if (pushResult.errorCode === 'UNREGISTERED') {
            console.log('Removing unregistered token:', tokenRecord.endpoint)
            await supabase
              .from('push_subscriptions')
              .delete()
              .eq('endpoint', tokenRecord.endpoint)
          }
        } catch (pushError) {
          console.error('Push notification error:', pushError)
        }
      }
    } else {
      console.log('No push tokens found for user:', profile.user_id)
    }

    // === REFERRAL BONUS TRIGGER ===
    // Check if this user was referred and if this deposit meets the threshold
    try {
      // Get referral settings
      const { data: refSettings } = await supabase
        .from('referral_settings')
        .select('min_funding_amount, referrer_bonus, is_enabled, requires_approval')
        .limit(1)
        .single()

      if (refSettings?.is_enabled) {
        // Find the user's profile ID
        const { data: userProfile } = await supabase
          .from('profiles')
          .select('id, referred_by')
          .eq('user_id', profile.user_id)
          .single()

        if (userProfile?.referred_by) {
          // Check if referral exists and hasn't been triggered yet
          const { data: existingReferral } = await supabase
            .from('referrals')
            .select('id, funding_triggered_at, status')
            .eq('referee_id', userProfile.id)
            .maybeSingle()

          // Only trigger if not already triggered and amount meets threshold
          if (existingReferral && !existingReferral.funding_triggered_at && Number(amount) >= Number(refSettings.min_funding_amount)) {
            console.log('Triggering referral bonus for:', existingReferral.id)

            // Update referral with funding info
            await supabase
              .from('referrals')
              .update({
                funding_amount: amount,
                funding_triggered_at: new Date().toISOString(),
                status: 'completed',
                referrer_bonus: refSettings.referrer_bonus,
              })
              .eq('id', existingReferral.id)

            // If auto-approval is enabled (requires_approval = false), pay immediately
            if (!refSettings.requires_approval) {
              // Get referrer's user_id
              const { data: referrerProfile } = await supabase
                .from('profiles')
                .select('user_id')
                .eq('id', userProfile.referred_by)
                .single()

              if (referrerProfile) {
                // Credit the referrer's wallet
                const { data: referrerWallet } = await supabase
                  .from('wallets')
                  .select('balance')
                  .eq('user_id', referrerProfile.user_id)
                  .single()

                const newReferrerBalance = Number(referrerWallet?.balance || 0) + Number(refSettings.referrer_bonus)

                await supabase
                  .from('wallets')
                  .update({ balance: newReferrerBalance })
                  .eq('user_id', referrerProfile.user_id)

                // Create transaction
                await supabase
                  .from('transactions')
                  .insert({
                    user_id: referrerProfile.user_id,
                    type: 'credit',
                    category: 'referral_bonus',
                    amount: refSettings.referrer_bonus,
                    description: 'Referral bonus',
                    status: 'completed',
                    reference: `REF-BONUS-${existingReferral.id}`,
                  })

                // Update referral to paid
                await supabase
                  .from('referrals')
                  .update({
                    status: 'bonus_paid',
                    bonus_paid_at: new Date().toISOString(),
                  })
                  .eq('id', existingReferral.id)

                // Notify referrer
                await supabase
                  .from('notifications')
                  .insert({
                    user_id: referrerProfile.user_id,
                    title: 'Referral Bonus Received! 🎉',
                    message: `You've earned ₦${refSettings.referrer_bonus} from your referral!`,
                    type: 'success',
                  })

                console.log('Auto-approved referral bonus paid:', existingReferral.id)
              }
            } else {
              console.log('Referral marked for admin approval:', existingReferral.id)
            }
          }
        }
      }
    } catch (refError) {
      // Don't fail the webhook for referral errors - just log
      console.error('Referral processing error (non-fatal):', refError)
    }

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
