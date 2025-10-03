import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServiceClient } from '@/lib/supabase'
import { Database, Tables, TablesInsert, TablesUpdate } from '@/types/supabase'

// Core API Client Class
export class ApiClient {
  private supabase = createSupabaseServiceClient()

  // Work Orders
  async getWorkOrders(): Promise<Tables<'work_orders'>[]> {
    const { data, error } = await this.supabase
      .from('work_orders')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) throw error
    return data || []
  }

  async getWorkOrderById(id: string): Promise<Tables<'work_orders'>> {
    const { data, error } = await this.supabase
      .from('work_orders')
      .select('*')
      .eq('id', id)
      .single()

    if (error) throw error
    return data
  }

  async createWorkOrder(workOrder: {
    title: string
    description: string
    risk_level?: string
    acceptance_criteria?: string[]
    files_in_scope?: string[]
    context_budget_estimate?: number
  }): Promise<Tables<'work_orders'>> {
    const insertData: TablesInsert<'work_orders'> = {
      title: workOrder.title,
      description: workOrder.description,
      risk_level: workOrder.risk_level || 'low',
      status: 'pending',
      proposer_id: 'a40c5caf-b0fb-4a8b-a544-ca82bb2ab939',
      estimated_cost: 0,
      pattern_confidence: 0.5,
      acceptance_criteria: workOrder.acceptance_criteria || [],
      files_in_scope: workOrder.files_in_scope || [],
      context_budget_estimate: workOrder.context_budget_estimate || 2000,
      created_at: new Date().toISOString(),
    }

    const { data, error } = await this.supabase
      .from('work_orders')
      .insert(insertData)
      .select()
      .single()
    
    if (error) throw error
    return data
  }

  async updateWorkOrder(id: string, updates: TablesUpdate<'work_orders'>): Promise<Tables<'work_orders'>> {
    const { data, error } = await this.supabase
      .from('work_orders')
      .update(updates)
      .eq('id', id)
      .select()
      .single()
    
    if (error) throw error
    return data
  }

  // System Status
  async getSystemStatus(): Promise<Tables<'system_status'>[]> {
    const { data, error } = await this.supabase
      .from('system_status')
      .select('*')
      .order('component_name')
    
    if (error) throw error
    return data || []
  }

  async updateSystemStatus(id: string, status: 'online' | 'offline' | 'degraded'): Promise<Tables<'system_status'>> {
    const updateData: TablesUpdate<'system_status'> = { 
      status,
      last_heartbeat: new Date().toISOString(),
    }

    const { data, error } = await this.supabase
      .from('system_status')
      .update(updateData)
      .eq('id', id)
      .select()
      .single()
    
    if (error) throw error
    return data
  }

  // Escalations
  async getEscalations(): Promise<any[]> {
    const { data, error } = await this.supabase
      .from('escalations')
      .select(`
        *,
        work_orders (
          title,
          description,
          risk_level
        )
      `)
      .in('status', ['open', 'in_progress'])
      .order('created_at', { ascending: false })
    
    if (error) throw error
    return data || []
  }

  async resolveEscalation(id: string, resolution: string): Promise<Tables<'escalations'>> {
    const updateData: TablesUpdate<'escalations'> = {
      status: 'resolved',
      resolution_notes: resolution,
      resolved_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }

    const { data, error } = await this.supabase
      .from('escalations')
      .update(updateData)
      .eq('id', id)
      .select()
      .single()
    
    if (error) throw error
    return data
  }

  // Decision Logs
  async getDecisionLogs(): Promise<any[]> {
    const { data, error } = await this.supabase
      .from('decision_logs')
      .select(`
        *,
        work_orders (
          title,
          status
        )
      `)
      .order('created_at', { ascending: false })
      .limit(50)
    
    if (error) throw error
    return data || []
  }

  // Cost Tracking
  async getCostData(): Promise<Tables<'cost_tracking'>[]> {
    const { data, error } = await this.supabase
      .from('cost_tracking')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(30)
    
    if (error) throw error
    return data || []
  }
}

export const apiClient = new ApiClient()

// Service Classes for Route Handlers
class WorkOrderService {
  private apiClient = new ApiClient()

  async getAll(request: NextRequest) {
    try {
      const data = await this.apiClient.getWorkOrders()
      return NextResponse.json(data)
    } catch (error) {
      console.error('Error fetching work orders:', error)
      return NextResponse.json(
        { error: 'Failed to fetch work orders' }, 
        { status: 500 }
      )
    }
  }

  async create(request: NextRequest) {
    try {
      const body = await request.json()
      const data = await this.apiClient.createWorkOrder(body)
      return NextResponse.json(data)
    } catch (error) {
      console.error('Error creating work order:', error)
      return NextResponse.json(
        { error: 'Failed to create work order' }, 
        { status: 500 }
      )
    }
  }

  async getById(id: string) {
    try {
      const data = await this.apiClient.getWorkOrderById(id)
      return NextResponse.json(data)
    } catch (error) {
      console.error('Error fetching work order:', error)
      return NextResponse.json(
        { error: 'Failed to fetch work order' },
        { status: 500 }
      )
    }
  }

  async update(request: NextRequest, id: string) {
    try {
      const body = await request.json()
      const data = await this.apiClient.updateWorkOrder(id, body)
      return NextResponse.json(data)
    } catch (error) {
      console.error('Error updating work order:', error)
      return NextResponse.json(
        { error: 'Failed to update work order' },
        { status: 500 }
      )
    }
  }
}

class SystemStatusService {
  private apiClient = new ApiClient()

  async getAll() {
    try {
      const data = await this.apiClient.getSystemStatus()
      return NextResponse.json(data)
    } catch (error) {
      console.error('Error fetching system status:', error)
      return NextResponse.json(
        { error: 'Failed to fetch system status' }, 
        { status: 500 }
      )
    }
  }
}

class BudgetService {
  private apiClient = new ApiClient()

  async getAll() {
    try {
      const data = await this.apiClient.getCostData()
      return NextResponse.json(data)
    } catch (error) {
      console.error('Error fetching budget data:', error)
      return NextResponse.json(
        { error: 'Failed to fetch budget data' }, 
        { status: 500 }
      )
    }
  }
}

class EscalationsService {
  private apiClient = new ApiClient()

  async getAll(request: NextRequest) {
    try {
      const data = await this.apiClient.getEscalations()
      return NextResponse.json(data)
    } catch (error) {
      console.error('Error fetching escalations:', error)
      return NextResponse.json(
        { error: 'Failed to fetch escalations' }, 
        { status: 500 }
      )
    }
  }

  async create(request: NextRequest) {
    try {
      const body = await request.json()
      return NextResponse.json({ message: 'Escalation created' })
    } catch (error) {
      console.error('Error creating escalation:', error)
      return NextResponse.json(
        { error: 'Failed to create escalation' }, 
        { status: 500 }
      )
    }
  }

  async resolve(request: NextRequest, id: string) {
    try {
      const body = await request.json()
      const { resolution } = body
      const data = await this.apiClient.resolveEscalation(id, resolution)
      return NextResponse.json(data)
    } catch (error) {
      console.error('Error resolving escalation:', error)
      return NextResponse.json(
        { error: 'Failed to resolve escalation' }, 
        { status: 500 }
      )
    }
  }
}

class DecisionLogsService {
  private apiClient = new ApiClient()

  async getAll() {
    try {
      const data = await this.apiClient.getDecisionLogs()
      return NextResponse.json(data)
    } catch (error) {
      console.error('Error fetching decision logs:', error)
      return NextResponse.json(
        { error: 'Failed to fetch decision logs' }, 
        { status: 500 }
      )
    }
  }
}

class PatternMetricsService {
  private apiClient = new ApiClient()

  async getAll() {
    try {
      const data = { patterns: [], confidence_scores: [] }
      return NextResponse.json(data)
    } catch (error) {
      console.error('Error fetching pattern metrics:', error)
      return NextResponse.json(
        { error: 'Failed to fetch pattern metrics' }, 
        { status: 500 }
      )
    }
  }
}

class DashboardMetricsService {
  private apiClient = new ApiClient()

  async getAll() {
    try {
      const [workOrders, systemStatus, escalations, costData] = await Promise.all([
        this.apiClient.getWorkOrders(),
        this.apiClient.getSystemStatus(),
        this.apiClient.getEscalations(),
        this.apiClient.getCostData()
      ])

      const metrics = {
        activeWorkOrders: workOrders.filter((wo: Tables<'work_orders'>) => wo.status === 'processing').length,
        pendingEscalations: escalations.filter((esc: Tables<'escalations'>) => esc.status === 'open').length,
        systemHealth: {
          active: systemStatus.filter((comp: Tables<'system_status'>) => comp.status === 'online').length,
          total: systemStatus.length
        },
        monthlySpend: costData.reduce((sum: number, record: Tables<'cost_tracking'>) => sum + (record.cost || 0), 0)
      }

      return NextResponse.json(metrics)
    } catch (error) {
      console.error('Error fetching dashboard metrics:', error)
      return NextResponse.json(
        { error: 'Failed to fetch dashboard metrics' }, 
        { status: 500 }
      )
    }
  }
}

// Export service instances
export const workOrderService = new WorkOrderService()
export const systemStatusService = new SystemStatusService()
export const budgetService = new BudgetService()
export const escalationsService = new EscalationsService()
export const decisionLogsService = new DecisionLogsService()
export const patternMetricsService = new PatternMetricsService()
export const dashboardMetricsService = new DashboardMetricsService()