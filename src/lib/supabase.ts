// lib/supabase.ts
// Supabase client configuration for Mission Control Dashboard

import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { createClient } from '@supabase/supabase-js'
import { Database } from '@/types/supabase'

// Client-side Supabase client
export const createSupabaseClient = () => {
  return createClientComponentClient<Database>()
}

// Simple service client for server operations
export const createSupabaseServiceClient = () => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
  
  return createClient<Database>(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  })
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

// Real-time subscription for system status
export const subscribeToSystemStatus = (callback: (payload: any) => void) => {
  const supabase = createSupabaseClient()
  
  return supabase
    .channel('system_status')
    .on('postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'system_status'
      },
      callback
    )
    .subscribe()
}

// Helper functions for common operations
export const workOrderOperations = {
  async getAll() {
    const supabase = createSupabaseClient()
    const { data, error } = await supabase
      .from('work_orders')
      .select(`
        *,
        proposer_configs(name, provider),
        pattern_confidence_scores(confidence_score)
      `)
      .order('created_at', { ascending: false })
      .limit(50)
    
    if (error) throw error
    return data
  },

  async create(workOrder: Partial<Database['public']['Tables']['work_orders']['Insert']>) {
    const supabase = createSupabaseClient()
    const { data, error } = await supabase
      .from('work_orders')
      .insert([workOrder])
      .select()
      .single()
    
    if (error) throw error
    return data
  },

  async updateStatus(id: string, status: string, metadata?: any) {
    const supabase = createSupabaseClient()
    const { data, error } = await supabase
      .from('work_orders')
      .update({ 
        status,
        metadata: { ...metadata },
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single()
    
    if (error) throw error
    return data
  },

  async escalate(id: string, reason: string, escalation_data?: any) {
    const supabase = createSupabaseClient()
    const { data, error } = await supabase
      .from('escalations')
      .insert([{
        work_order_id: id,
        reason,
        escalation_data,
        status: 'open',
        created_at: new Date().toISOString()
      }])
      .select()
      .single()
    
    if (error) throw error
    
    // Update work order status
    await this.updateStatus(id, 'escalated', { escalation_reason: reason })
    
    return data
  }
}

export const systemStatusOperations = {
  async getAll() {
    const supabase = createSupabaseClient()
    const { data, error } = await supabase
      .from('system_status')
      .select('*')
      .order('component_name')
    
    if (error) throw error
    return data
  },

  async updateHeartbeat(component: string, status: 'online' | 'offline' | 'degraded', responseTime?: number) {
    const supabase = createSupabaseServiceClient()
    const { data, error } = await supabase
      .from('system_status')
      .upsert([{
        component_name: component,
        status,
        last_heartbeat: new Date().toISOString(),
        response_time_ms: responseTime || 0,
        metadata: { timestamp: Date.now() }
      }])
      .select()
      .single()
    
    if (error) throw error
    return data
  }
}

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
    
    // Calculate totals
    const monthlySpend = data.reduce((sum, record) => sum + (record.cost || 0), 0)
    const dailySpend = data
      .filter(record => {
        const recordDate = new Date(record.created_at).toDateString()
        const today = new Date().toDateString()
        return recordDate === today
      })
      .reduce((sum, record) => sum + (record.cost || 0), 0)
    
    // Group by service
    const costByService = data.reduce((acc, record) => {
      const service = record.service_name || 'unknown'
      acc[service] = (acc[service] || 0) + (record.cost || 0)
      return acc
    }, {} as Record<string, number>)
    
    return {
      monthlySpend,
      dailySpend,
      costByService: Object.entries(costByService).map(([service, cost]) => ({ service, cost }))
    }
  },

  async recordCost(service: string, cost: number, metadata?: any) {
    const supabase = createSupabaseServiceClient()
    const { data, error } = await supabase
      .from('cost_tracking')
      .insert([{
        service_name: service,
        cost,
        metadata,
        created_at: new Date().toISOString()
      }])
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
    
    const totalPatterns = patterns.length
    const highConfidencePatterns = patterns.filter(p => p.confidence_score > 0.9).length
    const successRate = outcomes.length > 0 
      ? outcomes.filter(o => o.success).length / outcomes.length 
      : 0
    
    // Calculate learning rate (new patterns per day)
    const last24Hours = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    const recentPatterns = patterns.filter(p => p.updated_at > last24Hours).length
    
    return {
      totalPatterns,
      highConfidencePatterns,
      successRate,
      learningRate: recentPatterns
    }
  }
}