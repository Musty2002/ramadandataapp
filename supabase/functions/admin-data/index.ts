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

    // Parse URL to get the action
    const url = new URL(req.url)
    const action = url.searchParams.get('action')

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

        const body = await req.json()
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

        const body = await req.json()
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
