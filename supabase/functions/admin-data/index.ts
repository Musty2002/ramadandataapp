import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    // Verify admin authorization
    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const token = authHeader.replace('Bearer ', '')
    
    // Create user client to verify the token and check admin role
    const supabaseUser = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: `Bearer ${token}` } } }
    )

    const { data: { user }, error: authError } = await supabaseUser.auth.getUser()
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Invalid token' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Create admin client with service role to bypass RLS
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // Check if user has admin role
    const { data: roleData, error: roleError } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .maybeSingle()

    if (roleError || !roleData) {
      return new Response(JSON.stringify({ error: 'Admin access required' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Parse URL to get the action - support both query param and body
    const url = new URL(req.url)
    let action = url.searchParams.get('action')
    
    // For POST requests, also check body for action
    let body: any = {}
    if (req.method === 'POST') {
      try {
        body = await req.json()
        if (!action && body.action) {
          action = body.action
        }
      } catch {
        // Body might be empty for some requests
      }
    }

    // Handle different admin actions
    switch (action) {
      case 'users': {
        // Get all profiles with wallet balances
        const { data: profiles, error: profilesError } = await supabaseAdmin
          .from('profiles')
          .select('*')
          .order('created_at', { ascending: false })

        if (profilesError) throw profilesError

        // Fetch wallet balances for each user
        const usersWithWallets = await Promise.all(
          (profiles || []).map(async (profile) => {
            const { data: wallet } = await supabaseAdmin
              .from('wallets')
              .select('balance')
              .eq('user_id', profile.user_id)
              .maybeSingle()

            return {
              ...profile,
              wallet_balance: wallet?.balance || 0,
            }
          })
        )

        return new Response(JSON.stringify({ data: usersWithWallets }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      case 'transactions': {
        const statusFilter = url.searchParams.get('status')
        
        let query = supabaseAdmin
          .from('transactions')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(500)

        if (statusFilter && statusFilter !== 'all') {
          query = query.eq('status', statusFilter)
        }

        const { data: transactions, error: txError } = await query

        if (txError) throw txError

        // Fetch user info for each transaction
        const transactionsWithUsers = await Promise.all(
          (transactions || []).map(async (tx) => {
            const { data: profile } = await supabaseAdmin
              .from('profiles')
              .select('full_name, email')
              .eq('user_id', tx.user_id)
              .maybeSingle()

            return {
              ...tx,
              user_name: profile?.full_name || 'Unknown',
              user_email: profile?.email || '',
            }
          })
        )

        return new Response(JSON.stringify({ data: transactionsWithUsers }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      case 'fund-user': {
        if (req.method !== 'POST') {
          return new Response(JSON.stringify({ error: 'Method not allowed' }), {
            status: 405,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          })
        }

        const { user_id, amount, description } = body

        if (!user_id || !amount || amount <= 0) {
          return new Response(JSON.stringify({ error: 'Invalid request' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          })
        }

        // Get current wallet balance
        const { data: wallet, error: walletError } = await supabaseAdmin
          .from('wallets')
          .select('balance')
          .eq('user_id', user_id)
          .single()

        if (walletError) throw walletError

        const newBalance = Number(wallet.balance) + Number(amount)

        // Update wallet balance
        const { error: updateError } = await supabaseAdmin
          .from('wallets')
          .update({ balance: newBalance })
          .eq('user_id', user_id)

        if (updateError) throw updateError

        // Create transaction record
        const { error: txError } = await supabaseAdmin
          .from('transactions')
          .insert({
            user_id,
            type: 'credit',
            category: 'deposit',
            amount,
            description: description || 'Manual funding by admin',
            status: 'completed',
            reference: `ADMIN-FUND-${Date.now()}`,
          })

        if (txError) throw txError

        return new Response(JSON.stringify({ success: true, new_balance: newBalance }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      case 'refund': {
        if (req.method !== 'POST') {
          return new Response(JSON.stringify({ error: 'Method not allowed' }), {
            status: 405,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          })
        }

        const { transaction_id, user_id, amount, description, reference } = body

        if (!user_id || !amount || amount <= 0) {
          return new Response(JSON.stringify({ error: 'Invalid request' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          })
        }

        // Get current wallet balance
        const { data: wallet, error: walletError } = await supabaseAdmin
          .from('wallets')
          .select('balance')
          .eq('user_id', user_id)
          .single()

        if (walletError) throw walletError

        const newBalance = Number(wallet.balance) + Number(amount)

        // Update wallet balance
        const { error: updateError } = await supabaseAdmin
          .from('wallets')
          .update({ balance: newBalance })
          .eq('user_id', user_id)

        if (updateError) throw updateError

        // Create refund transaction record
        const { error: txError } = await supabaseAdmin
          .from('transactions')
          .insert({
            user_id,
            type: 'credit',
            category: 'deposit',
            amount,
            description: `Refund for: ${description}`,
            status: 'completed',
            reference: `REFUND-${reference || transaction_id}`,
          })

        if (txError) throw txError

        return new Response(JSON.stringify({ success: true, new_balance: newBalance }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      case 'dashboard': {
        // Get dashboard stats
        const { count: userCount } = await supabaseAdmin
          .from('profiles')
          .select('*', { count: 'exact', head: true })

        const { data: totalWallets } = await supabaseAdmin
          .from('wallets')
          .select('balance')

        const totalBalance = (totalWallets || []).reduce(
          (sum, w) => sum + Number(w.balance || 0),
          0
        )

        const today = new Date()
        today.setHours(0, 0, 0, 0)

        const { count: todayTransactions } = await supabaseAdmin
          .from('transactions')
          .select('*', { count: 'exact', head: true })
          .gte('created_at', today.toISOString())

        const { data: recentTransactions } = await supabaseAdmin
          .from('transactions')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(10)

        // Fetch user info for recent transactions
        const recentWithUsers = await Promise.all(
          (recentTransactions || []).map(async (tx) => {
            const { data: profile } = await supabaseAdmin
              .from('profiles')
              .select('full_name, email')
              .eq('user_id', tx.user_id)
              .maybeSingle()

            return {
              ...tx,
              user_name: profile?.full_name || 'Unknown',
              user_email: profile?.email || '',
            }
          })
        )

        return new Response(JSON.stringify({
          data: {
            userCount: userCount || 0,
            totalBalance,
            todayTransactions: todayTransactions || 0,
            recentTransactions: recentWithUsers,
          }
        }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      case 'get_referrals': {
        // Get all referrals with referrer and referee info
        const { data: referrals, error: refError } = await supabaseAdmin
          .from('referrals')
          .select('*')
          .order('created_at', { ascending: false })

        if (refError) throw refError

        // Fetch profile info for referrers and referees
        const enrichedReferrals = await Promise.all(
          (referrals || []).map(async (ref) => {
            const [referrerRes, refereeRes] = await Promise.all([
              supabaseAdmin
                .from('profiles')
                .select('full_name, email')
                .eq('id', ref.referrer_id)
                .maybeSingle(),
              supabaseAdmin
                .from('profiles')
                .select('full_name, email')
                .eq('id', ref.referee_id)
                .maybeSingle()
            ])

            return {
              ...ref,
              referrer: referrerRes.data,
              referee: refereeRes.data,
            }
          })
        )

        return new Response(JSON.stringify({ referrals: enrichedReferrals }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      case 'approve_referral': {
        const { referral_id } = body

        if (!referral_id) {
          return new Response(JSON.stringify({ error: 'Missing referral_id' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          })
        }

        // Get referral details
        const { data: referral, error: refError } = await supabaseAdmin
          .from('referrals')
          .select('*, referrer:referrer_id(user_id, full_name)')
          .eq('id', referral_id)
          .single()

        if (refError || !referral) {
          return new Response(JSON.stringify({ error: 'Referral not found' }), {
            status: 404,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          })
        }

        // Get referral settings for bonus amount
        const { data: settings } = await supabaseAdmin
          .from('referral_settings')
          .select('referrer_bonus')
          .limit(1)
          .single()

        const bonusAmount = settings?.referrer_bonus || referral.referrer_bonus || 50

        // Get referrer's user_id from profiles
        const { data: referrerProfile } = await supabaseAdmin
          .from('profiles')
          .select('user_id')
          .eq('id', referral.referrer_id)
          .single()

        if (!referrerProfile) {
          return new Response(JSON.stringify({ error: 'Referrer not found' }), {
            status: 404,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          })
        }

        // Credit the referrer's wallet
        const { data: wallet } = await supabaseAdmin
          .from('wallets')
          .select('balance')
          .eq('user_id', referrerProfile.user_id)
          .single()

        const newBalance = Number(wallet?.balance || 0) + Number(bonusAmount)

        await supabaseAdmin
          .from('wallets')
          .update({ balance: newBalance })
          .eq('user_id', referrerProfile.user_id)

        // Create transaction for the bonus
        await supabaseAdmin
          .from('transactions')
          .insert({
            user_id: referrerProfile.user_id,
            type: 'credit',
            category: 'referral_bonus',
            amount: bonusAmount,
            description: 'Referral bonus',
            status: 'completed',
            reference: `REF-BONUS-${referral_id}`,
          })

        // Update referral status
        await supabaseAdmin
          .from('referrals')
          .update({
            status: 'bonus_paid',
            approved_by: user.id,
            approved_at: new Date().toISOString(),
            bonus_paid_at: new Date().toISOString(),
            referrer_bonus: bonusAmount,
          })
          .eq('id', referral_id)

        // Create notification for the referrer
        await supabaseAdmin
          .from('notifications')
          .insert({
            user_id: referrerProfile.user_id,
            title: 'Referral Bonus Received! 🎉',
            message: `You've earned ₦${bonusAmount} from your referral!`,
            type: 'success',
          })

        return new Response(JSON.stringify({ success: true }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      case 'reject_referral': {
        const { referral_id } = body

        if (!referral_id) {
          return new Response(JSON.stringify({ error: 'Missing referral_id' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          })
        }

        // Reset the referral to pending state
        await supabaseAdmin
          .from('referrals')
          .update({
            status: 'pending',
            funding_amount: null,
            funding_triggered_at: null,
          })
          .eq('id', referral_id)

        return new Response(JSON.stringify({ success: true }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      default:
        return new Response(JSON.stringify({ error: 'Invalid action' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
    }
  } catch (error: any) {
    console.error('Admin data error:', error)
    return new Response(JSON.stringify({ error: error?.message || 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
