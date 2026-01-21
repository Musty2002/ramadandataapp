import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface IsquarePlan {
  plan_name: string
  plan_id: number
  price: number
}

interface IsquareService {
  service_id: number
  service_name: string
  network: string
  category: string
  plans: IsquarePlan[]
}

// Service ID to network/category mapping from iSquare documentation
const serviceMapping: Record<number, { network: string; category: string }> = {
  1: { network: 'mtn', category: 'sme' },       // MTN DATASHARE
  2: { network: 'mtn', category: 'gifting' },   // MTN NORMAL DATA
  3: { network: 'airtel', category: 'gifting' }, // AIRTEL NORMAL DATA
  4: { network: 'glo', category: 'gifting' },   // GLO NORMAL DATA
  5: { network: '9mobile', category: 'gifting' }, // 9MOBILE NORMAL DATA
  6: { network: 'mtn', category: 'coupon' },    // MTN COUPON
  8: { network: 'airtel', category: 'sme' },    // AIRTEL SME
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
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // Verify admin role using service role client
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: userError } = await supabase.auth.getUser(token)
    
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { 
        status: 401, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      })
    }

    // Check admin role
    const { data: roleData } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .maybeSingle()

    if (!roleData) {
      return new Response(JSON.stringify({ error: 'Admin access required' }), { 
        status: 403, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      })
    }

    const body = await req.json()
    const { action } = body

    if (action === 'fetch') {
      // Fetch plans from iSquare API
      const plans = await fetchIsquarePlans()
      return new Response(JSON.stringify({ success: true, plans }), { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      })
    }

    if (action === 'sync') {
      const { plans } = body
      if (!Array.isArray(plans)) {
        return new Response(JSON.stringify({ error: 'Invalid plans data' }), { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        })
      }

      // Upsert plans to database
      let updated = 0
      let inserted = 0

      for (const plan of plans) {
        // Check if plan exists
        const { data: existing } = await supabase
          .from('data_plans')
          .select('id')
          .eq('provider', 'isquare')
          .eq('service_id', plan.service_id)
          .eq('plan_id', plan.plan_id)
          .maybeSingle()

        if (existing) {
          // Update existing plan
          await supabase
            .from('data_plans')
            .update({
              name: plan.name,
              display_name: plan.display_name,
              api_price: plan.api_price,
              data_amount: plan.data_amount,
              validity: plan.validity,
              is_active: true,
              updated_at: new Date().toISOString()
            })
            .eq('id', existing.id)
          updated++
        } else {
          // Insert new plan
          await supabase
            .from('data_plans')
            .insert({
              provider: 'isquare',
              network: plan.network,
              category: plan.category,
              service_id: plan.service_id,
              plan_id: plan.plan_id,
              name: plan.name,
              display_name: plan.display_name,
              data_amount: plan.data_amount,
              validity: plan.validity,
              api_price: plan.api_price,
              selling_price: plan.selling_price || Math.ceil(plan.api_price * 1.1), // 10% markup default
              is_active: true
            })
          inserted++
        }
      }

      return new Response(JSON.stringify({ 
        success: true, 
        message: `Synced ${updated} updated, ${inserted} inserted` 
      }), { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      })
    }

    if (action === 'deactivate-missing') {
      const { validPlanKeys } = body
      if (!Array.isArray(validPlanKeys)) {
        return new Response(JSON.stringify({ error: 'Invalid plan keys' }), { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        })
      }

      // Get all iSquare plans
      const { data: allPlans } = await supabase
        .from('data_plans')
        .select('id, service_id, plan_id')
        .eq('provider', 'isquare')

      if (allPlans) {
        const toDeactivate = allPlans.filter(p => {
          const key = `${p.service_id}-${p.plan_id}`
          return !validPlanKeys.includes(key)
        })

        for (const plan of toDeactivate) {
          await supabase
            .from('data_plans')
            .update({ is_active: false, updated_at: new Date().toISOString() })
            .eq('id', plan.id)
        }

        return new Response(JSON.stringify({ 
          success: true, 
          deactivated: toDeactivate.length 
        }), { 
          status: 200, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        })
      }
    }

    return new Response(JSON.stringify({ error: 'Invalid action' }), { 
      status: 400, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    })

  } catch (error) {
    console.error('Sync error:', error)
    return new Response(JSON.stringify({ error: 'Internal server error' }), { 
      status: 500, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    })
  }
})

async function fetchIsquarePlans(): Promise<any[]> {
  const username = Deno.env.get('ISQUARE_USERNAME')
  const password = Deno.env.get('ISQUARE_PASSWORD')

  if (!username || !password) {
    throw new Error('iSquare credentials not configured')
  }

  const credentials = btoa(`${username}:${password}`)
  const allPlans: any[] = []

  // Fetch plans for each service
  for (const [serviceId, mapping] of Object.entries(serviceMapping)) {
    try {
      console.log(`Fetching service ${serviceId}...`)
      
      const response = await fetch(`https://isquaredata.com/api/data/plans/?service=${serviceId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Basic ${credentials}`,
          'Content-Type': 'application/json'
        }
      })

      if (!response.ok) {
        console.error(`Failed to fetch service ${serviceId}: ${response.status}`)
        continue
      }

      const data = await response.json()
      console.log(`Service ${serviceId} response:`, JSON.stringify(data).slice(0, 200))

      // Handle different response formats
      const plans = Array.isArray(data) ? data : (data.plans || data.data || [])

      for (const plan of plans) {
        const planName = plan.plan_name || plan.name || plan.plan || ''
        const dataAmount = extractDataAmount(planName)
        const validity = extractValidity(planName)
        
        allPlans.push({
          provider: 'isquare',
          network: mapping.network,
          category: mapping.category,
          service_id: parseInt(serviceId),
          plan_id: plan.plan_id || plan.id,
          name: planName,
          display_name: `${mapping.network.toUpperCase()} ${dataAmount} ${validity}`.trim(),
          data_amount: dataAmount,
          validity: validity,
          api_price: parseFloat(plan.price || plan.amount || 0)
        })
      }
    } catch (error) {
      console.error(`Error fetching service ${serviceId}:`, error)
    }
  }

  return allPlans
}

function extractDataAmount(planName: string): string {
  // Match patterns like "500MB", "1GB", "1.5GB", "1TB"
  const match = planName.match(/(\d+(?:\.\d+)?)\s*(MB|GB|TB)/i)
  if (match) {
    return `${match[1]}${match[2].toUpperCase()}`
  }
  return planName
}

function extractValidity(planName: string): string {
  const name = planName.toLowerCase()
  
  if (name.includes('yearly') || name.includes('year') || name.includes('12-month')) {
    return 'Yearly'
  }
  if (name.includes('3-month') || name.includes('3 month') || name.includes('quarterly')) {
    return '3 Months'
  }
  if (name.includes('2-month') || name.includes('2 month')) {
    return '2 Months'
  }
  if (name.includes('monthly') || name.includes('month') || name.includes('30 day') || name.includes('30-day')) {
    return 'Monthly'
  }
  if (name.includes('weekly') || name.includes('week') || name.includes('7 day') || name.includes('7-day')) {
    return 'Weekly'
  }
  if (name.includes('2-day') || name.includes('2 day')) {
    return '2 Days'
  }
  if (name.includes('daily') || name.includes('day') || name.includes('1-day') || name.includes('24hr')) {
    return 'Daily'
  }
  
  return 'Monthly'
}
