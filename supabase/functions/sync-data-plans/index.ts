import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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

// RGC category mappings - derived from API response categories
// Categories from API: "MTN SME", "MTN SME II", "MTN CG", "MTN DATA SHARE", "GLO", "AIRTEL CG", "9mobile"
const RGC_CATEGORY_MAP: Record<string, string[]> = {
  sme: ['SME', 'SME II'],
  corporate: ['CG', 'DATA SHARE'],
  gifting: [''], // Direct network name like "GLO", "9mobile"
}

let currentNetwork = 'mtn'

// iSquare functions
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
        product_id: null,
        name: planName,
        display_name: `${currentNetwork.toUpperCase()} ${dataAmount} ${validity}`.trim(),
        data_amount: dataAmount,
        validity: validity,
        api_price: parseFloat(plan.api_amount || plan.reseller_amount || plan.price || plan.amount || 0)
      }
    })
  } catch (error) {
    console.error(`Error fetching iSquare plans:`, error)
    return []
  }
}

// RGC functions - fetch categories dynamically from API
async function fetchRgcCategories(): Promise<{ id: string; name: string; service_id?: number }[]> {
  const apiKey = Deno.env.get('RGC_API_KEY')
  if (!apiKey) {
    throw new Error('RGC API key not configured')
  }

  try {
    const response = await fetch(`https://api.rgcdata.com.ng/api/v2/services/data`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      }
    })

    if (!response.ok) {
      console.error(`Failed to fetch RGC categories: ${response.status}`)
      return []
    }

    const data = await response.json()
    
    if (!data.success || !Array.isArray(data.data)) {
      return []
    }

    // Extract unique categories for the current network
    const networkUpper = currentNetwork.toUpperCase()
    const networkCategories = new Map<string, string>()
    
    for (const plan of data.data) {
      const category = plan.category || ''
      // Check if category belongs to current network
      if (category.toUpperCase().includes(networkUpper) || 
          (currentNetwork === '9mobile' && category.toLowerCase().includes('9mobile'))) {
        // Extract category type (SME, CG, etc.)
        let categoryId = 'gifting'
        let categoryName = 'Gifting'
        
        if (category.toUpperCase().includes('SME II')) {
          categoryId = 'sme2'
          categoryName = 'SME II'
        } else if (category.toUpperCase().includes('SME')) {
          categoryId = 'sme'
          categoryName = 'SME'
        } else if (category.toUpperCase().includes('CG')) {
          categoryId = 'corporate'
          categoryName = 'Corporate'
        } else if (category.toUpperCase().includes('DATA SHARE')) {
          categoryId = 'datashare'
          categoryName = 'Data Share'
        }
        
        if (!networkCategories.has(categoryId)) {
          networkCategories.set(categoryId, categoryName)
        }
      }
    }

    return Array.from(networkCategories.entries()).map(([id, name]) => ({
      id,
      name,
    }))
  } catch (error) {
    console.error('Error fetching RGC categories:', error)
    return []
  }
}

async function fetchRgcPlans(categoryId: string): Promise<any[]> {
  const apiKey = Deno.env.get('RGC_API_KEY')

  if (!apiKey) {
    throw new Error('RGC API key not configured')
  }
  
  try {
    console.log(`Fetching RGC plans for network ${currentNetwork}, category ${categoryId}...`)
    
    const response = await fetch(`https://api.rgcdata.com.ng/api/v2/services/data`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      }
    })

    if (!response.ok) {
      console.error(`Failed to fetch RGC plans: ${response.status}`)
      const errorText = await response.text()
      console.error('RGC error response:', errorText)
      return []
    }

    const data = await response.json()
    console.log(`RGC plans response:`, JSON.stringify(data).slice(0, 1000))

    if (!data.success || !Array.isArray(data.data)) {
      return []
    }

    const networkUpper = currentNetwork.toUpperCase()
    
    // Filter plans by network and category
    const filteredPlans = data.data.filter((plan: any) => {
      const planCategory = (plan.category || '').toUpperCase()
      
      // Check network match
      const networkMatch = planCategory.includes(networkUpper) || 
                          (currentNetwork === '9mobile' && planCategory.toLowerCase().includes('9mobile'))
      
      if (!networkMatch) return false
      
      // Check category match
      if (categoryId === 'sme2') {
        return planCategory.includes('SME II')
      } else if (categoryId === 'sme') {
        return planCategory.includes('SME') && !planCategory.includes('SME II')
      } else if (categoryId === 'corporate') {
        return planCategory.includes('CG')
      } else if (categoryId === 'datashare') {
        return planCategory.includes('DATA SHARE')
      } else if (categoryId === 'gifting') {
        // Gifting = direct network name without SME/CG/DATA SHARE
        return !planCategory.includes('SME') && !planCategory.includes('CG') && !planCategory.includes('DATA SHARE')
      }
      
      return false
    })

    console.log(`Filtered ${filteredPlans.length} RGC plans for ${currentNetwork}/${categoryId}`)

    return filteredPlans.map((plan: any) => {
      const planName = plan.name || ''
      const dataAmount = planName.trim()
      const price = parseFloat(plan.amount || 0)
      // RGC API uses 'id' as the plan identifier for purchases, not 'product_id'
      const planId = plan.id
      
      console.log(`Mapping RGC plan: id=${planId}, name=${planName}, category=${plan.category}`)
      
      return {
        provider: 'rgc',
        network: currentNetwork,
        category: categoryId,
        service_id: null,
        plan_id: null,
        product_id: String(planId),
        name: `${plan.category} - ${planName}`,
        display_name: `${currentNetwork.toUpperCase()} ${dataAmount}`.trim(),
        data_amount: dataAmount,
        validity: 'Monthly',
        api_price: price
      }
    })
  } catch (error) {
    console.error(`Error fetching RGC plans:`, error)
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

// Albarka network ID mapping
const ALBARKA_NETWORK_IDS: Record<string, number> = {
  mtn: 1,
  airtel: 2,
  glo: 3,
  '9mobile': 4,
}

// Hardcoded Albarka plans from their documentation (no dynamic list API available)
// Full plan list from user-provided CSV
const ALBARKA_STATIC_PLANS: Record<string, any[]> = {
  mtn: [
    { plan_id: 1, plan_type: 'SME', plan_name: '500MB', amount: 365, validity: '7 days' },
    { plan_id: 2, plan_type: 'SME', plan_name: '1GB', amount: 400, validity: '7 days' },
    { plan_id: 3, plan_type: 'SME', plan_name: '2GB', amount: 800, validity: '7 days' },
    { plan_id: 4, plan_type: 'SME', plan_name: '3GB', amount: 1320, validity: '7 days' },
    { plan_id: 5, plan_type: 'SME', plan_name: '5GB', amount: 2245, validity: '7 days' },
    { plan_id: 120, plan_type: 'SME', plan_name: '1GB', amount: 700, validity: '7 days' },
    { plan_id: 19, plan_type: 'COOPERATE GIFTING', plan_name: '500MB', amount: 400, validity: '30 days' },
    { plan_id: 20, plan_type: 'COOPERATE GIFTING', plan_name: '1GB', amount: 520, validity: '30 days' },
    { plan_id: 21, plan_type: 'COOPERATE GIFTING', plan_name: '2GB', amount: 1040, validity: '30 days' },
    { plan_id: 22, plan_type: 'COOPERATE GIFTING', plan_name: '3GB', amount: 1560, validity: '30 days' },
    { plan_id: 23, plan_type: 'COOPERATE GIFTING', plan_name: '5GB', amount: 2600, validity: '30 days' },
    { plan_id: 24, plan_type: 'COOPERATE GIFTING', plan_name: '10GB', amount: 9000, validity: '30 days' },
    { plan_id: 84, plan_type: 'GIFTING', plan_name: '1GB', amount: 200, validity: '1 day' },
    { plan_id: 85, plan_type: 'GIFTING', plan_name: '2.5GB', amount: 500, validity: 'Daily' },
    { plan_id: 86, plan_type: 'GIFTING', plan_name: '500MB', amount: 485, validity: '7 days' },
    { plan_id: 87, plan_type: 'GIFTING', plan_name: '1.2GB', amount: 437, validity: '1 month' },
    { plan_id: 88, plan_type: 'GIFTING', plan_name: '6GB', amount: 2425, validity: '7 days' },
    { plan_id: 89, plan_type: 'GIFTING', plan_name: '2GB', amount: 1550, validity: '30 days' },
    { plan_id: 90, plan_type: 'GIFTING', plan_name: '750MB', amount: 445, validity: '3 days' },
    { plan_id: 91, plan_type: 'GIFTING', plan_name: '1.8GB', amount: 1475, validity: '30 days + airtime' },
    { plan_id: 92, plan_type: 'GIFTING', plan_name: '40GB', amount: 8780, validity: '30 days' },
    { plan_id: 93, plan_type: 'GIFTING', plan_name: '35GB', amount: 6975, validity: '1 month' },
    { plan_id: 94, plan_type: 'GIFTING', plan_name: '14.5GB', amount: 4875, validity: '1 month' },
    { plan_id: 95, plan_type: 'GIFTING', plan_name: '12.5GB', amount: 5495, validity: '30 days' },
    { plan_id: 96, plan_type: 'GIFTING', plan_name: '7GB', amount: 3485, validity: '30 days' },
    { plan_id: 97, plan_type: 'GIFTING', plan_name: '2.7GB', amount: 1995, validity: '30 days' },
    { plan_id: 98, plan_type: 'GIFTING', plan_name: '2GB', amount: 1445, validity: '30 days' },
    { plan_id: 99, plan_type: 'GIFTING', plan_name: '6.75GB', amount: 2940, validity: '30 days' },
    { plan_id: 100, plan_type: 'GIFTING', plan_name: '2GB', amount: 736, validity: '2 days' },
    { plan_id: 101, plan_type: 'GIFTING', plan_name: '2.5GB', amount: 895, validity: '2 days' },
    { plan_id: 102, plan_type: 'GIFTING', plan_name: '1.5GB', amount: 595, validity: '2 days' },
    { plan_id: 103, plan_type: 'GIFTING', plan_name: '250MB', amount: 500, validity: '7 days' },
    { plan_id: 104, plan_type: 'GIFTING', plan_name: '200MB', amount: 197, validity: '1 day' },
    { plan_id: 106, plan_type: 'GIFTING', plan_name: '75MB', amount: 85, validity: '1 day' },
    { plan_id: 112, plan_type: 'GIFTING', plan_name: '1GB', amount: 778, validity: '7 days' },
    { plan_id: 113, plan_type: 'GIFTING', plan_name: '25GB', amount: 9550, validity: '1 month' },
    { plan_id: 114, plan_type: 'GIFTING', plan_name: '11GB', amount: 3695, validity: '7 days' },
    { plan_id: 116, plan_type: 'GIFTING', plan_name: '3.5GB', amount: 1525, validity: '7 days' },
    { plan_id: 118, plan_type: 'GIFTING', plan_name: '5.5GB', amount: 3150, validity: '1 month' },
    { plan_id: 119, plan_type: 'GIFTING', plan_name: '3.5GB', amount: 2625, validity: '1 month' },
    { plan_id: 129, plan_type: 'GIFTING', plan_name: '10GB', amount: 4765, validity: '30 days' },
    { plan_id: 130, plan_type: 'GIFTING', plan_name: '16.5GB', amount: 6905, validity: '30 days' },
  ],
  airtel: [
    { plan_id: 7, plan_type: 'COOPERATE GIFTING', plan_name: '500MB', amount: 485, validity: '7 days' },
    { plan_id: 8, plan_type: 'COOPERATE GIFTING', plan_name: '1GB', amount: 780, validity: '7 days' },
    { plan_id: 9, plan_type: 'COOPERATE GIFTING', plan_name: '2GB', amount: 1455, validity: '1 month' },
    { plan_id: 10, plan_type: 'COOPERATE GIFTING', plan_name: '3GB', amount: 1960, validity: '1 month' },
    { plan_id: 11, plan_type: 'COOPERATE GIFTING', plan_name: '4GB', amount: 2940, validity: '1 month' },
    { plan_id: 12, plan_type: 'COOPERATE GIFTING', plan_name: '5GB', amount: 1470, validity: '7 days' },
    { plan_id: 13, plan_type: 'COOPERATE GIFTING', plan_name: '7GB', amount: 1960, validity: '7 days' },
    { plan_id: 14, plan_type: 'COOPERATE GIFTING', plan_name: '10GB', amount: 3920, validity: '30 days' },
    { plan_id: 26, plan_type: 'COOPERATE GIFTING', plan_name: '10GB', amount: 5920, validity: '1 month' },
    { plan_id: 50, plan_type: 'COOPERATE GIFTING', plan_name: '100MB', amount: 200, validity: '30 days' },
    { plan_id: 51, plan_type: 'COOPERATE GIFTING', plan_name: '300MB', amount: 220, validity: '30 days' },
    { plan_id: 137, plan_type: 'COOPERATE GIFTING', plan_name: '250MB', amount: 55, validity: '1 day' },
    { plan_id: 138, plan_type: 'COOPERATE GIFTING', plan_name: '75MB', amount: 75, validity: '1 day' },
    { plan_id: 139, plan_type: 'COOPERATE GIFTING', plan_name: '200MB', amount: 99, validity: '2 days' },
    { plan_id: 140, plan_type: 'COOPERATE GIFTING', plan_name: '1GB', amount: 310, validity: '3 days' },
    { plan_id: 141, plan_type: 'COOPERATE GIFTING', plan_name: '1.5GB', amount: 628, validity: '1 day' },
    { plan_id: 142, plan_type: 'COOPERATE GIFTING', plan_name: '2GB', amount: 757, validity: '2 days' },
    { plan_id: 143, plan_type: 'COOPERATE GIFTING', plan_name: '3.2GB', amount: 980, validity: '2 days' },
    { plan_id: 154, plan_type: 'COOPERATE GIFTING', plan_name: '5GB', amount: 1465, validity: '7 days' },
    { plan_id: 64, plan_type: 'SME', plan_name: '500MB', amount: 370, validity: '3 days' },
    { plan_id: 65, plan_type: 'SME', plan_name: '300MB', amount: 120, validity: '2 days' },
    { plan_id: 66, plan_type: 'SME', plan_name: '1GB', amount: 310, validity: '3 days' },
    { plan_id: 67, plan_type: 'SME', plan_name: '2GB', amount: 600, validity: '1 day' },
    { plan_id: 68, plan_type: 'SME', plan_name: '3GB', amount: 1150, validity: '2 days' },
    { plan_id: 69, plan_type: 'SME', plan_name: '3.2GB', amount: 1100, validity: '2 days' },
    { plan_id: 70, plan_type: 'SME', plan_name: '10GB', amount: 3035, validity: '30 days' },
    { plan_id: 71, plan_type: 'SME', plan_name: '600MB', amount: 210, validity: '2 days' },
    { plan_id: 131, plan_type: 'SME', plan_name: '8GB', amount: 3035, validity: '30 days' },
    { plan_id: 132, plan_type: 'SME', plan_name: '13GB', amount: 5500, validity: '30 days' },
    { plan_id: 133, plan_type: 'SME', plan_name: '3.5GB', amount: 1550, validity: '7 days' },
    { plan_id: 134, plan_type: 'SME', plan_name: '100MB', amount: 110, validity: '1 day' },
    { plan_id: 135, plan_type: 'SME', plan_name: '200MB', amount: 150, validity: '2 days' },
    { plan_id: 136, plan_type: 'SME', plan_name: '100GB', amount: 20000, validity: '30 days' },
    { plan_id: 147, plan_type: 'GIFTING', plan_name: '1GB', amount: 350, validity: '3 days' },
    { plan_id: 148, plan_type: 'GIFTING', plan_name: '1GB', amount: 815, validity: '7 days' },
    { plan_id: 149, plan_type: 'GIFTING', plan_name: '1.5GB', amount: 485, validity: '1 day' },
    { plan_id: 150, plan_type: 'GIFTING', plan_name: '2GB', amount: 776, validity: '2 days' },
    { plan_id: 151, plan_type: 'GIFTING', plan_name: '1.5GB', amount: 585, validity: '2 days' },
    { plan_id: 152, plan_type: 'GIFTING', plan_name: '1GB', amount: 785, validity: '7 days' },
    { plan_id: 153, plan_type: 'GIFTING', plan_name: '3.2GB', amount: 975, validity: '2 days' },
    { plan_id: 155, plan_type: 'GIFTING', plan_name: '4GB', amount: 2450, validity: '30 days' },
    { plan_id: 156, plan_type: 'GIFTING', plan_name: '5GB', amount: 1455, validity: '2 days' },
    { plan_id: 157, plan_type: 'GIFTING', plan_name: '6GB', amount: 2450, validity: '7 days' },
    { plan_id: 158, plan_type: 'GIFTING', plan_name: '10GB', amount: 3050, validity: '7 days' },
    { plan_id: 159, plan_type: 'GIFTING', plan_name: '13GB', amount: 5200, validity: '30 days' },
    { plan_id: 160, plan_type: 'GIFTING', plan_name: '18GB', amount: 6250, validity: '30 days' },
    { plan_id: 161, plan_type: 'GIFTING', plan_name: '25GB', amount: 8200, validity: '30 days' },
    { plan_id: 162, plan_type: 'GIFTING', plan_name: '35GB', amount: 10500, validity: '30 days' },
    { plan_id: 163, plan_type: 'GIFTING', plan_name: '60GB', amount: 15500, validity: '30 days' },
    { plan_id: 164, plan_type: 'GIFTING', plan_name: '100GB', amount: 21000, validity: '30 days' },
    { plan_id: 165, plan_type: 'GIFTING', plan_name: '110MB', amount: 110, validity: '1 day' },
    { plan_id: 166, plan_type: 'GIFTING', plan_name: '230MB', amount: 220, validity: '1 day' },
    { plan_id: 167, plan_type: 'GIFTING', plan_name: '300MB', amount: 320, validity: '2 days' },
    { plan_id: 168, plan_type: 'GIFTING', plan_name: '500MB', amount: 380, validity: '3 days' },
  ],
  glo: [
    { plan_id: 29, plan_type: 'COOPERATE GIFTING', plan_name: '200MB', amount: 100, validity: '30 days' },
    { plan_id: 30, plan_type: 'COOPERATE GIFTING', plan_name: '500MB', amount: 210, validity: '30 days' },
    { plan_id: 31, plan_type: 'COOPERATE GIFTING', plan_name: '1GB', amount: 420, validity: '30 days' },
    { plan_id: 32, plan_type: 'COOPERATE GIFTING', plan_name: '2GB', amount: 840, validity: '30 days' },
    { plan_id: 33, plan_type: 'COOPERATE GIFTING', plan_name: '3GB', amount: 1260, validity: '30 days' },
    { plan_id: 34, plan_type: 'COOPERATE GIFTING', plan_name: '5GB', amount: 2100, validity: '30 days' },
    { plan_id: 35, plan_type: 'COOPERATE GIFTING', plan_name: '10GB', amount: 4200, validity: '30 days' },
    { plan_id: 169, plan_type: 'GIFTING', plan_name: '1GB', amount: 360, validity: '1 day' },
    { plan_id: 170, plan_type: 'GIFTING', plan_name: '1GB', amount: 360, validity: '1 day' },
    { plan_id: 171, plan_type: 'GIFTING', plan_name: '1GB', amount: 320, validity: '1 day' },
    { plan_id: 172, plan_type: 'GIFTING', plan_name: '1.5GB', amount: 350, validity: '1 day' },
    { plan_id: 173, plan_type: 'GIFTING', plan_name: '1.5GB', amount: 550, validity: '7 days' },
    { plan_id: 174, plan_type: 'GIFTING', plan_name: '1.5GB', amount: 550, validity: '7 days' },
    { plan_id: 175, plan_type: 'GIFTING', plan_name: '2GB', amount: 550, validity: '1 day' },
    { plan_id: 176, plan_type: 'GIFTING', plan_name: '2GB', amount: 550, validity: '7 days' },
    { plan_id: 177, plan_type: 'GIFTING', plan_name: '2.5GB', amount: 560, validity: '2 days' },
    { plan_id: 178, plan_type: 'GIFTING', plan_name: '2.5GB', amount: 560, validity: '7 days' },
    { plan_id: 179, plan_type: 'GIFTING', plan_name: '2.6GB', amount: 1100, validity: '30 days' },
    { plan_id: 180, plan_type: 'GIFTING', plan_name: '5GB', amount: 1700, validity: '30 days' },
    { plan_id: 181, plan_type: 'GIFTING', plan_name: '6.15GB', amount: 2200, validity: '30 days' },
    { plan_id: 182, plan_type: 'GIFTING', plan_name: '7.25GB', amount: 2700, validity: '30 days' },
    { plan_id: 183, plan_type: 'GIFTING', plan_name: '10GB', amount: 2200, validity: '7 days' },
    { plan_id: 184, plan_type: 'GIFTING', plan_name: '10GB', amount: 3200, validity: '30 days' },
    { plan_id: 185, plan_type: 'GIFTING', plan_name: '12.5GB', amount: 4200, validity: '30 days' },
    { plan_id: 186, plan_type: 'GIFTING', plan_name: '16GB', amount: 5500, validity: '30 days' },
    { plan_id: 187, plan_type: 'GIFTING', plan_name: '20.5GB', amount: 6500, validity: '30 days' },
    { plan_id: 188, plan_type: 'GIFTING', plan_name: '28GB', amount: 8500, validity: '30 days' },
    { plan_id: 189, plan_type: 'GIFTING', plan_name: '38GB', amount: 10500, validity: '30 days' },
    { plan_id: 190, plan_type: 'GIFTING', plan_name: '64GB', amount: 16000, validity: '30 days' },
    { plan_id: 191, plan_type: 'GIFTING', plan_name: '107GB', amount: 22000, validity: '30 days' },
    { plan_id: 192, plan_type: 'GIFTING', plan_name: '350MB', amount: 70, validity: '1 day' },
    { plan_id: 193, plan_type: 'GIFTING', plan_name: '750MB', amount: 130, validity: '1 day' },
    { plan_id: 194, plan_type: 'GIFTING', plan_name: '1GB', amount: 350, validity: '3 days' },
    { plan_id: 195, plan_type: 'GIFTING', plan_name: '1.5GB', amount: 550, validity: '7 days' },
    { plan_id: 196, plan_type: 'SME', plan_name: '500MB', amount: 195, validity: '3 days' },
    { plan_id: 198, plan_type: 'SME', plan_name: '1GB', amount: 290, validity: '10 days' },
    { plan_id: 199, plan_type: 'SME', plan_name: '2GB', amount: 450, validity: '7 days' },
    { plan_id: 200, plan_type: 'SME', plan_name: '2.5GB', amount: 600, validity: '2 days' },
    { plan_id: 201, plan_type: 'SME', plan_name: '5GB', amount: 1500, validity: '30 days' },
    { plan_id: 202, plan_type: 'SME', plan_name: '10GB', amount: 3100, validity: '30 days' },
    { plan_id: 203, plan_type: 'SME', plan_name: '10GB', amount: 2200, validity: '7 days' },
  ],
  '9mobile': [
    { plan_id: 25, plan_type: 'SME', plan_name: '1.5GB', amount: 410, validity: 'Monthly' },
    { plan_id: 27, plan_type: 'GIFTING', plan_name: '1.5GB', amount: 890, validity: '30 days' },
    { plan_id: 28, plan_type: 'GIFTING', plan_name: '500MB', amount: 445, validity: '30 days' },
    { plan_id: 42, plan_type: 'COOPERATE GIFTING', plan_name: '500MB', amount: 80, validity: '30 days' },
    { plan_id: 43, plan_type: 'COOPERATE GIFTING', plan_name: '1GB', amount: 135, validity: '30 days' },
    { plan_id: 44, plan_type: 'COOPERATE GIFTING', plan_name: '2GB', amount: 280, validity: '30 days' },
    { plan_id: 45, plan_type: 'COOPERATE GIFTING', plan_name: '3GB', amount: 420, validity: '30 days' },
    { plan_id: 46, plan_type: 'COOPERATE GIFTING', plan_name: '4GB', amount: 560, validity: '30 days' },
    { plan_id: 47, plan_type: 'COOPERATE GIFTING', plan_name: '5GB', amount: 700, validity: '30 days' },
  ],
}

// Albarka functions
function albarkaSlug(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

async function fetchAlbarkaCategories(): Promise<{ id: string; name: string; service_id?: number }[]> {
  const plans = ALBARKA_STATIC_PLANS[currentNetwork] || []
  
  // Derive categories from static plans
  const types = new Map<string, string>()
  for (const plan of plans) {
    const rawType = String(plan.plan_type || '').trim()
    if (!rawType) continue
    types.set(albarkaSlug(rawType), rawType)
  }

  if (types.size === 0) {
    // Return a message category if no plans configured
    return [{ id: 'none', name: 'No plans configured' }]
  }

  return Array.from(types.entries()).map(([id, name]) => ({ id, name }))
}

async function fetchAlbarkaPlans(categoryId: string): Promise<any[]> {
  console.log(`Fetching Albarka plans for network ${currentNetwork}, category ${categoryId}...`)

  // Use static plans from documentation (Albarka has no dynamic list API)
  const allPlans = ALBARKA_STATIC_PLANS[currentNetwork] || []

  const filteredPlans = allPlans.filter((plan: any) => {
    if (!categoryId || categoryId === 'all' || categoryId === 'none') return true
    const rawType = String(plan.plan_type || '').trim()
    if (!rawType) return true
    return albarkaSlug(rawType) === categoryId
  })

  console.log(`Filtered ${filteredPlans.length} Albarka plans for ${currentNetwork}/${categoryId}`)

  return filteredPlans.map((plan: any) => {
    const planName = plan.plan_name || plan.plan || plan.name || ''
    const dataAmount = extractDataAmount(planName) || planName
    // Use explicit validity from static data, fallback to extraction
    const validity = plan.validity || extractValidity(planName)
    const price = parseFloat(plan.amount || plan.plan_amount || plan.price || 0)
    const planId = plan.plan_id || plan.id
    const rawType = String(plan.plan_type || '').trim()

    console.log(`Mapping Albarka plan: id=${planId}, name=${planName}, price=${price}`)

    return {
      provider: 'albarka',
      network: currentNetwork,
      category: categoryId !== 'none' ? categoryId : albarkaSlug(rawType),
      service_id: null,
      plan_id: String(planId),
      product_id: String(planId),
      name: rawType ? `${rawType} - ${planName}` : planName,
      display_name: `${currentNetwork.toUpperCase()} ${dataAmount} (${validity})`.trim(),
      data_amount: dataAmount,
      validity: validity,
      api_price: price,
    }
  })
}

// Provider configurations
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
  rgc: {
    name: 'RGC Data',
    fetchCategories: fetchRgcCategories,
    fetchPlans: fetchRgcPlans,
  },
  albarka: {
    name: 'Albarka',
    fetchCategories: fetchAlbarkaCategories,
    fetchPlans: fetchAlbarkaPlans,
  },
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
        // For iSquare, match by service_id + plan_id; for RGC, match by product_id
        const existing = existingPlans?.find((p: any) => {
          if (provider === 'isquare') {
            return p.service_id === apiPlan.service_id && p.plan_id === apiPlan.plan_id
          } else if (provider === 'rgc') {
            return p.product_id === apiPlan.product_id
          }
          return false
        })
        
        return {
          ...apiPlan,
          db_id: existing?.id || null,
          selling_price: existing?.selling_price || Math.ceil(apiPlan.api_price * 1.1),
          is_active: existing?.is_active ?? false,
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
            product_id: plan.product_id,
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
            product_id: plan.product_id,
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
