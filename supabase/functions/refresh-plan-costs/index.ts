import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Fetch live iSquare costs keyed by `${service_id}:${plan_id}`
async function fetchIsquareCosts(): Promise<Map<string, number>> {
  const costs = new Map<string, number>()
  const username = Deno.env.get('ISQUARE_USERNAME')
  const password = Deno.env.get('ISQUARE_PASSWORD')
  if (!username || !password) {
    console.warn('iSquare credentials missing, skipping')
    return costs
  }
  const credentials = btoa(`${username}:${password}`)
  const serviceIds = [1, 2, 3, 4, 5, 6, 8]

  for (const serviceId of serviceIds) {
    try {
      const res = await fetch(`https://isquaredata.com/api/data/plans/?service=${serviceId}`, {
        headers: { Authorization: `Basic ${credentials}`, 'Content-Type': 'application/json' },
      })
      if (!res.ok) {
        console.warn(`iSquare service ${serviceId} -> ${res.status}`)
        continue
      }
      const data = await res.json()
      const plans = Array.isArray(data) ? data : (data.plans || data.data || [])
      for (const plan of plans) {
        const planId = plan.plan_id ?? plan.id
        const price = parseFloat(plan.api_amount ?? plan.reseller_amount ?? plan.price ?? plan.amount ?? 0)
        if (planId != null && Number.isFinite(price) && price > 0) {
          costs.set(`${serviceId}:${planId}`, price)
        }
      }
    } catch (e) {
      console.error(`iSquare service ${serviceId} fetch failed:`, e)
    }
  }
  return costs
}

// Fetch live RGC costs keyed by product_id
async function fetchRgcCosts(): Promise<Map<string, number>> {
  const costs = new Map<string, number>()
  const apiKey = Deno.env.get('RGC_API_KEY')
  if (!apiKey) {
    console.warn('RGC API key missing, skipping')
    return costs
  }
  try {
    const res = await fetch('https://api.rgcdata.com.ng/api/v2/services/data', {
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    })
    if (!res.ok) {
      console.warn(`RGC plans -> ${res.status}`)
      return costs
    }
    const data = await res.json()
    if (!data?.success || !Array.isArray(data.data)) return costs
    for (const plan of data.data) {
      const price = parseFloat(plan.amount ?? 0)
      if (plan.id != null && Number.isFinite(price) && price > 0) {
        costs.set(String(plan.id), price)
      }
    }
  } catch (e) {
    console.error('RGC fetch failed:', e)
  }
  return costs
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  try {
    // Manual runs from the admin UI must be authenticated as an admin.
    // The cron job calls this with the service role key (no user token).
    const authHeader = req.headers.get('Authorization') || ''
    const token = authHeader.replace('Bearer ', '').trim()

    // The scheduled job authenticates with a private token stored in app_config
    const providedCronSecret = req.headers.get('x-cron-secret')
    let isCron = false
    if (providedCronSecret) {
      const { data: cfg } = await supabase
        .from('app_config')
        .select('value')
        .eq('key', 'cron_secret')
        .maybeSingle()
      isCron = !!cfg?.value && cfg.value === providedCronSecret
    }

    const isServiceRole = isCron || token === Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')



    if (!isServiceRole) {
      if (!token) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
      const { data: { user }, error: userError } = await supabase.auth.getUser(token)
      if (userError || !user) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
      const { data: roleData } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .eq('role', 'admin')
        .maybeSingle()
      if (!roleData) {
        return new Response(JSON.stringify({ error: 'Admin access required' }), {
          status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
    }

    const [isquareCosts, rgcCosts] = await Promise.all([fetchIsquareCosts(), fetchRgcCosts()])

    const { data: plans, error: plansError } = await supabase
      .from('data_plans')
      .select('id, provider, network, display_name, service_id, plan_id, product_id, api_price, selling_price')
      .in('provider', ['isquare', 'rgc'])

    if (plansError) throw plansError

    const changes: any[] = []
    const historyRows: any[] = []
    let checked = 0

    for (const plan of plans || []) {
      let liveCost: number | undefined

      if (plan.provider === 'isquare' && plan.service_id != null && plan.plan_id != null) {
        liveCost = isquareCosts.get(`${plan.service_id}:${plan.plan_id}`)
      } else if (plan.provider === 'rgc' && plan.product_id) {
        liveCost = rgcCosts.get(String(plan.product_id))
      }

      if (liveCost == null) continue
      checked++

      const oldCost = Number(plan.api_price)
      if (Math.abs(liveCost - oldCost) < 0.01) continue

      const sellingPrice = Number(plan.selling_price)
      const margin = sellingPrice - liveCost

      const { error: updateError } = await supabase
        .from('data_plans')
        .update({ api_price: liveCost, updated_at: new Date().toISOString() })
        .eq('id', plan.id)

      if (updateError) {
        console.error('Failed to update plan cost:', plan.id, updateError)
        continue
      }

      historyRows.push({
        plan_id: plan.id,
        provider: plan.provider,
        network: plan.network,
        display_name: plan.display_name,
        old_api_price: oldCost,
        new_api_price: liveCost,
        selling_price: sellingPrice,
        margin,
      })

      changes.push({
        id: plan.id,
        display_name: plan.display_name,
        provider: plan.provider,
        old_api_price: oldCost,
        new_api_price: liveCost,
        selling_price: sellingPrice,
        margin,
        loss: margin <= 0,
      })
    }

    if (historyRows.length) {
      const { error: histError } = await supabase.from('plan_price_history').insert(historyRows)
      if (histError) console.error('Failed to log price history:', histError)
    }

    // Warn the admins when a provider price increase wiped out the margin
    const losers = changes.filter((c) => c.loss)
    if (losers.length) {
      const { data: admins } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('role', 'admin')

      if (admins?.length) {
        const message = `${losers.length} data plan(s) now cost as much or more than your selling price: ${losers
          .slice(0, 5)
          .map((c) => `${c.display_name} (cost ₦${c.new_api_price}, selling ₦${c.selling_price})`)
          .join('; ')}`

        await supabase.from('notifications').insert(
          admins.map((a: any) => ({
            user_id: a.user_id,
            title: 'Data plan cost increased',
            message,
            type: 'warning',
          }))
        )
      }
    }

    console.log('Cost refresh done:', { checked, changed: changes.length, losers: losers.length })

    return new Response(JSON.stringify({
      success: true,
      checked,
      changed: changes.length,
      negative_margin: losers.length,
      changes,
    }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

  } catch (error) {
    console.error('refresh-plan-costs error:', error)
    return new Response(JSON.stringify({ error: 'Internal server error', details: String(error) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
