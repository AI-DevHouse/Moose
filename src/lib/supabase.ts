// lib/supabase.ts
// Supabase client configuration for Mission Control Dashboard

import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { Database } from '@/types/supabase'

// Type the client properly for modern versions
type TypedSupabaseClient = SupabaseClient<Database>

// Client-side Supabase client
export const createSupabaseClient = (): TypedSupabaseClient => {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

// Server-side service client  
export const createSupabaseServiceClient = (): TypedSupabaseClient => {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    }
  )
}

// Real-time subscription helper
export const subscribeToWorkOrders = (callback: (payload: any) => void) => {
  const supabase = createSupabaseClient()
  
  return supabase
    .channel('work_orders')
    .on('postgres_changes', 
      { 
        event: '*', 
        schema: 'public', 
        table: 'work_orders' 
      }, 
      callback
    )
    .subscribe()
}

// Commented out - system_status table doesn't exist in database
// export const subscribeToSystemStatus = (callback: (payload: any) => void) => {
//   const supabase = createSupabaseClient()
//
//   return supabase
//     .channel('system_status')
//     .on('postgres_changes',
//       {
//         event: '*',
//         schema: 'public',
//         table: 'system_status'
//       },
//       callback
//     )
//     .subscribe()
// }

// Helper functions for common operations
export const workOrderOperations = {
  async getAll() {
    const supabase = createSupabaseClient()
    const { data, error } = await supabase
      .from('work_orders')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50)
    
    if (error) throw error
    return data
  },

  async create(workOrder: Database['public']['Tables']['work_orders']['Insert']) {
    const supabase = createSupabaseClient()
    const { data, error } = await supabase
      .from('work_orders')
      .insert(workOrder)
      .select()
      .single()
    
    if (error) throw error
    return data
  },

  async updateStatus(id: string, status: string, metadata?: any) {
    const supabase = createSupabaseClient()
    const updateData: Database['public']['Tables']['work_orders']['Update'] = { 
      status: status,
      metadata: { ...metadata },
      updated_at: new Date().toISOString()
    }
    
    const { data, error } = await supabase
      .from('work_orders')
      .update(updateData)
      .eq('id', id)
      .select()
      .single()
    
    if (error) throw error
    return data
  },

  async escalate(id: string, trigger_type: string, context?: any) {
    const supabase = createSupabaseClient()
    const escalationData: Database['public']['Tables']['escalations']['Insert'] = {
      work_order_id: id,
      trigger_type,
      context,
      status: 'open',
      created_at: new Date().toISOString()
    }

    const { data, error } = await supabase
      .from('escalations')
      .insert(escalationData)
      .select()
      .single()

    if (error) throw error

    // Update work order status
    await this.updateStatus(id, 'escalated', { escalation_trigger: trigger_type })

    return data
  }
}

// Commented out - system_status table doesn't exist in database
// export const systemStatusOperations = {
//   async getAll() {
//     const supabase = createSupabaseClient()
//     const { data, error } = await supabase
//       .from('system_status')
//       .select('*')
//       .order('component_name')
//
//     if (error) throw error
//     return data
//   },

//   async updateHeartbeat(component: string, status: 'online' | 'offline' | 'degraded', responseTime?: number) {
//     const supabase = createSupabaseServiceClient()
//     const upsertData: Database['public']['Tables']['system_status']['Insert'] = {
//       component_name: component,
//       status,
//       last_heartbeat: new Date().toISOString(),
//       response_time_ms: responseTime || 0,
//       metadata: { timestamp: Date.now() }
//     }
//
//     const { data, error } = await supabase
//       .from('system_status')
//       .upsert(upsertData)
//       .select()
//       .single()
//
//     if (error) throw error
//     return data
//   }
// }

export const budgetOperations = {
  async getCurrentSpend() {
    const supabase = createSupabaseClient()
    const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()
    
    const { data, error } = await supabase
      .from('cost_tracking')
      .select('*')
      .gte('created_at', startOfMonth)
      .order('created_at', { ascending: false })
    
    if (error) throw error
    
    if (!data) return { monthlySpend: 0, dailySpend: 0, costByService: [] }
    
    // Calculate totals with proper typing
    const monthlySpend = data.reduce((sum: number, record) => sum + (record.cost || 0), 0)
    const dailySpend = data
      .filter(record => {
        if (!record.created_at) return false
        const recordDate = new Date(record.created_at).toDateString()
        const today = new Date().toDateString()
        return recordDate === today
      })
      .reduce((sum: number, record) => sum + (record.cost || 0), 0)
    
    // Group by service with proper typing
    const costByService = data.reduce((acc: Record<string, number>, record) => {
      const service = record.service_name || 'unknown'
      acc[service] = (acc[service] || 0) + (record.cost || 0)
      return acc
    }, {})
    
    return {
      monthlySpend,
      dailySpend,
      costByService: Object.entries(costByService).map(([service, cost]) => ({ service, cost }))
    }
  },

  async recordCost(service: string, cost: number, metadata?: any) {
    const supabase = createSupabaseServiceClient()
    const costData: Database['public']['Tables']['cost_tracking']['Insert'] = {
      service_name: service,
      cost,
      metadata,
      created_at: new Date().toISOString()
    }
    
    const { data, error } = await supabase
      .from('cost_tracking')
      .insert(costData)
      .select()
      .single()
    
    if (error) throw error
    return data
  }
}

export const patternOperations = {
  async getMetrics() {
    const supabase = createSupabaseClient()
    
    // Get pattern confidence scores
    const { data: patterns, error: patternsError } = await supabase
      .from('pattern_confidence_scores')
      .select('*')
    
    if (patternsError) throw patternsError
    
    // Get outcome vectors for success rate calculation
    const { data: outcomes, error: outcomesError } = await supabase
      .from('outcome_vectors')
      .select('success, created_at')
      .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()) // Last 7 days
    
    if (outcomesError) throw outcomesError
    
    const totalPatterns = patterns?.length || 0
    const highConfidencePatterns = patterns?.filter(p => (p.confidence_score || 0) > 0.9).length || 0
    const successRate = outcomes && outcomes.length > 0 
      ? outcomes.filter(o => o.success).length / outcomes.length 
      : 0
    
    // Calculate learning rate (new patterns per day)
    const last24Hours = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    const recentPatterns = patterns?.filter(p => (p.last_updated || '') > last24Hours).length || 0
    
    return {
      totalPatterns,
      highConfidencePatterns,
      successRate,
      learningRate: recentPatterns
    }
  }
}