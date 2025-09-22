import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServiceClient } from '@/lib/supabase'
import { Database } from '@/types/supabase'

type Tables = Database['public']['Tables']

// Core API Client Class
export class ApiClient {
  private supabase = createSupabaseServiceClient()

  // Work Orders
  async getWorkOrders() {
    const { data, error } = await this.supabase
      .from('work_orders')
      .select('*')
      .order('created_at', { ascending: false })
    
    if (error) throw error
    return data
  }

  async createWorkOrder(workOrder: {
    title: string
    description: string
    risk_level?: 'low' | 'medium' | 'high'  // Use risk_level, not priority
    estimated_effort_hours?: number
    budget_cap?: number
  }) {
    const { data, error } = await this.supabase
      .from('work_orders')
      .insert([{
        ...workOrder,
        status: 'pending',
    	proposer_id: 'a40c5caf-b0fb-4a8b-a544-ca82bb2ab939', 
      	estimated_cost: workOrder.budget_cap || 0, 
      	pattern_confidence: 0.5, 
        created_at: new Date().toISOString(),
      }])
      .select()
      .single()
    
    if (error) throw error
    return data
  }

  async updateWorkOrder(id: string, updates: Partial<Tables['work_orders']['Update']>) {
    const { data, error } = await this.supabase
      .from('work_orders')
      .update(updates)
      .eq('id', id)
      .select()
      .single()
    
    if (error) throw error
    return data
  }

  // System Status (corrected table name)
  async getSystemStatus() {
    const { data, error } = await this.supabase
      .from('system_status')  // Changed from system_components
      .select('*')
      .order('component_name')  // Use component_name instead of name
    
    if (error) throw error
    return data
  }

  async updateSystemStatus(id: string, status: 'online' | 'offline' | 'degraded') {
    const { data, error } = await this.supabase
      .from('system_status')  // Changed from system_components
      .update({ 
        status,
        last_heartbeat: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single()
    
    if (error) throw error
    return data
  }

  // Escalations - FIXED VERSION
  async getEscalations() {
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
    return data
  }

  async resolveEscalation(id: string, resolution: string) {
    const { data, error } = await this.supabase
      .from('escalations')
      .update({
        status: 'resolved',
        resolution_notes: resolution,
        resolved_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single()
    
    if (error) throw error
    return data
  }

  // Decision Logs
  async getDecisionLogs() {
    const { data, error } = await this.supabase
      .from('decision_logs')
      .select(`
        *,
        work_orders (
          title,
          status
        )
      `)
      .order('timestamp', { ascending: false })
      .limit(50)
    
    if (error) throw error
    return data
  }

  // Cost Tracking (corrected table name)
  async getCostData() {
    const { data, error } = await this.supabase
      .from('cost_tracking')  // Changed from budget_tracking
      .select('*')
      .order('created_at', { ascending: false })
      .limit(30)
    
    if (error) throw error
    return data
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
      const data = await this.apiClient.getSystemStatus()  // Now calls corrected method
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
      const data = await this.apiClient.getCostData()  // Now calls corrected method
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
      // Implementation for creating escalations would go here
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
      // Placeholder for pattern metrics - would integrate with playbook_memory table
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
      // Aggregate multiple data sources for dashboard overview
      const [workOrders, systemStatus, escalations, costData] = await Promise.all([
        this.apiClient.getWorkOrders(),
        this.apiClient.getSystemStatus(),  // Corrected method name
        this.apiClient.getEscalations(),
        this.apiClient.getCostData()  // Corrected method name
      ])

      const metrics = {
        activeWorkOrders: workOrders.filter(wo => wo.status === 'processing').length,  // Use 'processing' not 'in_progress'
        pendingEscalations: escalations.filter(esc => esc.status === 'pending').length,
        systemHealth: {
          active: systemStatus.filter(comp => comp.status === 'online').length,  // Use 'online' not 'active'
          total: systemStatus.length
        },
        monthlySpend: costData.reduce((sum, record) => sum + (record.cost || 0), 0)  // Use 'cost' field
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