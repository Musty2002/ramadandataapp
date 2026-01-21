import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Provider configurations - extensible for future providers
const PROVIDERS: Record<string, {
  name: string;
  fetchCategories: () => Promise<{ id: string; name: string; service_id?: number }[]>;
  fetchPlans: (categoryId: string) => Promise<any[]>;
}> = {
  isquare: {
    name: 'iSquare',
    fetchCategories: fetchIsquareCategories,
    fetchPlans: fetchIsquarePlans,
  },
  // RGC provider can be added here later
  // rgc: {
  //   name: 'RGC',
  //   fetchCategories: fetchRGCCategories,
  //   fetchPlans: fetchRGCPlans,
  // },
}

// iSquare service mappings per network
const ISQUARE_SERVICES: Record<string, { id: number; name: string; category: string }[]> = {
  mtn: [
    { id: 1, name: 'SME', category: 'sme' },
    { id: 2, name: 'Gifting', category: 'gifting' },
    { id: 6, name: 'Coupon', category: 'coupon' },
  ],
  airtel: [
    { id: 3, name: 'Gifting', category: 'gifting' },
    { id: 8, name: 'SME', category: 'sme' },
  ],
  glo: [
    { id: 4, name: 'Gifting', category: 'gifting' },
  ],
  '9mobile': [
    { id: 5, name: 'Gifting', category: 'gifting' },
  ],
}

let currentNetwork = 'mtn'

async function fetchIsquareCategories(): Promise<{ id: string; name: string; service_id?: number }[]> {
  const services = ISQUARE_SERVICES[currentNetwork] || []
  return services.map(s => ({
    id: s.category,
    name: s.name,
    service_id: s.id,
  }))
}

async function fetchIsquarePlans(categoryId: string): Promise<any[]> {
  const username = Deno.env.get('ISQUARE_USERNAME')
  const password = Deno.env.get('ISQUARE_PASSWORD')

  if (!username || !password) {
    throw new Error('iSquare credentials not configured')
  }

  const services = ISQUARE_SERVICES[currentNetwork] || []
  const service = services.find(s => s.category === categoryId)
  
  if (!service) {
    return []
  }

  const credentials = btoa(`${username}:${password}`)
  
  try {
    console.log(`Fetching iSquare service ${service.id} for ${currentNetwork} ${categoryId}...`)
    
    const response = await fetch(`https://isquaredata.com/api/data/plans/?service=${service.id}`, {
      method: 'GET',
      headers: {
        'Authorization': `Basic ${credentials}`,
        'Content-Type': 'application/json'
      }
    })

    if (!response.ok) {
      console.error(`Failed to fetch service ${service.id}: ${response.status}`)
      return []
    }

    const data = await response.json()
    console.log(`Service ${service.id} response:`, JSON.stringify(data).slice(0, 500))

    // Handle different response formats
    const plans = Array.isArray(data) ? data : (data.plans || data.data || [])

    return plans.map((plan: any) => {
      const planName = plan.plan_name || plan.name || plan.plan || ''
      const dataAmount = extractDataAmount(planName)
      const validity = extractValidity(planName)
      
      return {
        provider: 'isquare',
        network: currentNetwork,
        category: categoryId,
        service_id: service.id,
        plan_id: plan.plan_id || plan.id,
        name: planName,
        display_name: `${currentNetwork.toUpperCase()} ${dataAmount} ${validity}`.trim(),
        data_amount: dataAmount,
        validity: validity,
        api_price: parseFloat(plan.price || plan.amount || 0)
      }
    })
  } catch (error) {
    console.error(`Error fetching iSquare plans:`, error)
    return []
  }
}

function extractDataAmount(planName: string): string {
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

    // Verify admin role
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: userError } = await supabase.auth.getUser(token)
    
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { 
        status: 401, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
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
        status: 403, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      })
    }

    const body = await req.json()
    const { action, provider, network, category } = body

    // List available providers
    if (action === 'list-providers') {
      const providers = Object.entries(PROVIDERS).map(([id, p]) => ({
        id,
        name: p.name,
      }))
      return new Response(JSON.stringify({ success: true, providers }), { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      })
    }

    // Fetch categories for a provider/network
    if (action === 'fetch-categories') {
      if (!provider || !network) {
        return new Response(JSON.stringify({ error: 'Provider and network required' }), { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        })
      }

      const providerConfig = PROVIDERS[provider]
      if (!providerConfig) {
        return new Response(JSON.stringify({ error: 'Unknown provider' }), { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        })
      }

      currentNetwork = network
      const categories = await providerConfig.fetchCategories()
      
      return new Response(JSON.stringify({ success: true, categories }), { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      })
    }

    // Fetch plans for a category
    if (action === 'fetch-plans') {
      if (!provider || !network || !category) {
        return new Response(JSON.stringify({ error: 'Provider, network, and category required' }), { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        })
      }

      const providerConfig = PROVIDERS[provider]
      if (!providerConfig) {
        return new Response(JSON.stringify({ error: 'Unknown provider' }), { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        })
      }

      currentNetwork = network
      const apiPlans = await providerConfig.fetchPlans(category)

      // Get existing plans from DB for this provider/network/category
      const { data: existingPlans } = await supabase
        .from('data_plans')
        .select('*')
        .eq('provider', provider)
        .eq('network', network)
        .eq('category', category)

      // Merge API plans with DB data (app prices, active status)
      const mergedPlans = apiPlans.map((apiPlan: any) => {
        const existing = existingPlans?.find(
          (p: any) => p.service_id === apiPlan.service_id && p.plan_id === apiPlan.plan_id
        )
        
        return {
          ...apiPlan,
          db_id: existing?.id || null,
          selling_price: existing?.selling_price || Math.ceil(apiPlan.api_price * 1.1),
          is_active: existing?.is_active ?? false, // Default to inactive for new plans
          in_database: !!existing,
        }
      })

      return new Response(JSON.stringify({ success: true, plans: mergedPlans }), { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      })
    }

    // Save/update a single plan
    if (action === 'save-plan') {
      const { plan } = body
      if (!plan) {
        return new Response(JSON.stringify({ error: 'Plan data required' }), { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        })
      }

      if (plan.db_id) {
        // Update existing
        const { error } = await supabase
          .from('data_plans')
          .update({
            selling_price: plan.selling_price,
            is_active: plan.is_active,
            api_price: plan.api_price,
            name: plan.name,
            display_name: plan.display_name,
            data_amount: plan.data_amount,
            validity: plan.validity,
            updated_at: new Date().toISOString(),
          })
          .eq('id', plan.db_id)

        if (error) throw error

        return new Response(JSON.stringify({ 
          success: true, 
          message: 'Plan updated',
          plan_id: plan.db_id
        }), { 
          status: 200, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        })
      } else {
        // Insert new
        const { data, error } = await supabase
          .from('data_plans')
          .insert({
            provider: plan.provider,
            network: plan.network,
            category: plan.category,
            service_id: plan.service_id,
            plan_id: plan.plan_id,
            name: plan.name,
            display_name: plan.display_name,
            data_amount: plan.data_amount,
            validity: plan.validity,
            api_price: plan.api_price,
            selling_price: plan.selling_price,
            is_active: plan.is_active,
          })
          .select('id')
          .single()

        if (error) throw error

        return new Response(JSON.stringify({ 
          success: true, 
          message: 'Plan created',
          plan_id: data.id
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
    return new Response(JSON.stringify({ error: 'Internal server error', details: String(error) }), { 
      status: 500, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    })
  }
})
