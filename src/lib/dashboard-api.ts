// src/lib/dashboard-api.ts
// Frontend API client for dashboard data

interface WorkOrder {
  id: string;
  title: string;
  description: string;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'escalated';
  risk_level: 'low' | 'medium' | 'high';
  proposer_id: string;
  estimated_cost: number;
  pattern_confidence: number;
  created_at: string;
  proposer_configs?: {
    name: string;
    provider: string;
  };
  escalations?: Array<{
    id: string;
    status: string;
    reason: string;
    created_at: string;
  }>;
}

interface SystemStatus {
  id: string;
  component_name: string;
  status: 'online' | 'offline' | 'degraded';
  last_heartbeat: string;
  response_time_ms: number;
}

interface BudgetData {
  daily_spend: number;
  monthly_spend: number;
  monthly_budget: number;
  cost_by_service: Array<{
    service: string;
    cost: number;
  }>;
  budget_percentage: number;
  projected_monthly: number;
}

interface PatternMetrics {
  total_patterns: number;
  high_confidence: number;
  success_rate: number;
  learning_rate: number;
}

interface DashboardMetrics {
  activeWorkOrders: number;
  pendingEscalations: number;
  systemHealth: {
    active: number;
    total: number;
  };
  monthlySpend: number;
}

interface Escalation {
  id: string;
  work_order_id: string;
  reason: string;
  status: 'open' | 'in_progress' | 'resolved' | 'dismissed';
  escalation_data?: any;
  resolution_notes?: string;
  assigned_to?: string;
  created_at: string;
  updated_at: string;
  resolved_at?: string;
  work_orders?: {
    title: string;
    description: string;
    risk_level: string;
  };
}

export const dashboardApi = {
  async getWorkOrders(): Promise<WorkOrder[]> {
    try {
      const response = await fetch('/api/work-orders');
      if (!response.ok) throw new Error('Failed to fetch work orders');
      const result = await response.json();
      return result;
    } catch (error) {
      console.error('Error fetching work orders:', error);
      return [];
    }
  },

  async createWorkOrder(workOrder: {
    title: string;
    description: string;
    risk_level: 'low' | 'medium' | 'high';
  }): Promise<WorkOrder | null> {
    try {
      const response = await fetch('/api/work-orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(workOrder),
      });
      
      if (!response.ok) throw new Error('Failed to create work order');
      const result = await response.json();
      return result;
    } catch (error) {
      console.error('Error creating work order:', error);
      return null;
    }
  },

  async getSystemStatus(): Promise<SystemStatus[]> {
    try {
      const response = await fetch('/api/system-status');
      if (!response.ok) throw new Error('Failed to fetch system status');
      const result = await response.json();
      return result;
    } catch (error) {
      console.error('Error fetching system status:', error);
      return [];
    }
  },

  async getBudgetData(): Promise<BudgetData | null> {
    try {
      const response = await fetch('/api/budget');
      if (!response.ok) throw new Error('Failed to fetch budget data');
      const result = await response.json();
      
      // Transform the cost_tracking data to match expected format
      if (Array.isArray(result)) {
        const totalCost = result.reduce((sum: number, record: any) => sum + (record.cost || 0), 0);
        return {
          daily_spend: 0,
          monthly_spend: totalCost,
          monthly_budget: 500,
          cost_by_service: [],
          budget_percentage: (totalCost / 500) * 100,
          projected_monthly: totalCost
        };
      }
      
      return result;
    } catch (error) {
      console.error('Error fetching budget data:', error);
      return null;
    }
  },

  async getPatternMetrics(): Promise<PatternMetrics | null> {
    try {
      const response = await fetch('/api/patterns/metrics');
      if (!response.ok) throw new Error('Failed to fetch pattern metrics');
      const result = await response.json();
      return result;
    } catch (error) {
      console.error('Error fetching pattern metrics:', error);
      return null;
    }
  },

  async getDashboardMetrics(): Promise<DashboardMetrics | null> {
    try {
      const response = await fetch('/api/dashboard/metrics');
      if (!response.ok) throw new Error('Failed to fetch dashboard metrics');
      const result = await response.json();
      return result;
    } catch (error) {
      console.error('Error fetching dashboard metrics:', error);
      return null;
    }
  },

  async getEscalations(): Promise<Escalation[]> {
    try {
      const response = await fetch('/api/escalations');
      if (!response.ok) throw new Error('Failed to fetch escalations');
      const result = await response.json();
      return result;
    } catch (error) {
      console.error('Error fetching escalations:', error);
      return [];
    }
  },

  async resolveEscalation(id: string, resolution: string): Promise<boolean> {
    try {
      const response = await fetch(`/api/escalations/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ resolution }),
      });
      
      if (!response.ok) throw new Error('Failed to resolve escalation');
      return true;
    } catch (error) {
      console.error('Error resolving escalation:', error);
      return false;
    }
  }
};