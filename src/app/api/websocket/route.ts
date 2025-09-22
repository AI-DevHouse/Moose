// src/app/api/websocket/route.ts
// WebSocket API endpoint for real-time dashboard updates

import { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// WebSocket connection management
const clients = new Set<WebSocket>();
const subscriptions = new Map<WebSocket, Set<string>>();

// Supabase setup for real-time subscriptions
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface WebSocketMessage {
  type: string;
  data?: any;
  channels?: string[];
}

// Handle WebSocket upgrade and connection
export async function GET(request: NextRequest) {
  if (!request.headers.get('upgrade')?.includes('websocket')) {
    return new Response('Expected WebSocket upgrade', { status: 400 });
  }

  try {
    // In a production environment, you'd use a proper WebSocket library
    // For now, we'll return instructions for implementation
    return new Response(JSON.stringify({
      message: 'WebSocket endpoint ready',
      instructions: 'This endpoint requires WebSocket upgrade handling. In production, use a library like ws or socket.io'
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('WebSocket setup error:', error);
    return new Response('WebSocket setup failed', { status: 500 });
  }
}

// Database change listener setup
export class DatabaseChangeListener {
  private static instance: DatabaseChangeListener;
  private supabaseClient: any;
  private channels: Map<string, any> = new Map();

  private constructor() {
    this.supabaseClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
  }

  static getInstance(): DatabaseChangeListener {
    if (!DatabaseChangeListener.instance) {
      DatabaseChangeListener.instance = new DatabaseChangeListener();
    }
    return DatabaseChangeListener.instance;
  }

  // Set up real-time subscriptions for all relevant tables
  async setupRealtimeSubscriptions() {
    try {
      // Work orders subscription
      const workOrdersChannel = this.supabaseClient
        .channel('work-orders-changes')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'work_orders' },
          (payload: any) => {
            this.broadcastToClients('work_orders', payload);
            this.refreshWorkOrders();
          }
        )
        .subscribe();

      this.channels.set('work_orders', workOrdersChannel);

      // System status subscription
      const systemStatusChannel = this.supabaseClient
        .channel('system-status-changes')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'system_status' },
          (payload: any) => {
            this.broadcastToClients('system_status', payload);
            this.refreshSystemStatus();
          }
        )
        .subscribe();

      this.channels.set('system_status', systemStatusChannel);

      // Cost tracking subscription
      const costTrackingChannel = this.supabaseClient
        .channel('cost-tracking-changes')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'cost_tracking' },
          (payload: any) => {
            this.broadcastToClients('budget', payload);
            this.refreshBudgetData();
          }
        )
        .subscribe();

      this.channels.set('cost_tracking', costTrackingChannel);

      // Escalations subscription
      const escalationsChannel = this.supabaseClient
        .channel('escalations-changes')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'escalations' },
          (payload: any) => {
            this.broadcastToClients('escalations', payload);
            this.refreshEscalations();
          }
        )
        .subscribe();

      this.channels.set('escalations', escalationsChannel);

      console.log('Real-time subscriptions established');
    } catch (error) {
      console.error('Error setting up real-time subscriptions:', error);
    }
  }

  // Broadcast updates to connected WebSocket clients
  private broadcastToClients(type: string, data: any) {
    const message = JSON.stringify({
      type,
      data,
      timestamp: new Date().toISOString()
    });

    clients.forEach(client => {
      if (client.readyState === 1) { // WebSocket.OPEN
        const clientSubscriptions = subscriptions.get(client);
        if (clientSubscriptions?.has(type)) {
          try {
            client.send(message);
          } catch (error) {
            console.error('Error sending message to client:', error);
            clients.delete(client);
            subscriptions.delete(client);
          }
        }
      } else {
        clients.delete(client);
        subscriptions.delete(client);
      }
    });
  }

  // Refresh methods to get updated data and broadcast
  private async refreshWorkOrders() {
    try {
      const { data } = await this.supabaseClient
        .from('work_orders')
        .select(`
          *,
          proposer_configs (
            name,
            provider
          ),
          escalations (
            id,
            status,
            reason,
            created_at
          )
        `)
        .order('created_at', { ascending: false });

      this.broadcastToClients('work_orders', data || []);
      this.refreshDashboardMetrics();
    } catch (error) {
      console.error('Error refreshing work orders:', error);
    }
  }

  private async refreshSystemStatus() {
    try {
      const { data } = await this.supabaseClient
        .from('system_status')
        .select('*')
        .order('component_name');

      this.broadcastToClients('system_status', data || []);
      this.refreshDashboardMetrics();
    } catch (error) {
      console.error('Error refreshing system status:', error);
    }
  }

  private async refreshBudgetData() {
    try {
      const { data } = await this.supabaseClient
        .from('cost_tracking')
        .select('*')
        .order('created_at', { ascending: false });

      const totalCost = (data || []).reduce((sum: number, record: any) => sum + (record.cost || 0), 0);
      const budgetData = {
        daily_spend: 0,
        monthly_spend: totalCost,
        monthly_budget: 500,
        cost_by_service: [],
        budget_percentage: (totalCost / 500) * 100,
        projected_monthly: totalCost
      };

      this.broadcastToClients('budget', budgetData);
      this.refreshDashboardMetrics();
    } catch (error) {
      console.error('Error refreshing budget data:', error);
    }
  }

  private async refreshEscalations() {
    try {
      const { data } = await this.supabaseClient
        .from('escalations')
        .select('*')
        .order('created_at', { ascending: false });

      this.broadcastToClients('escalations', data || []);
      this.refreshDashboardMetrics();
    } catch (error) {
      console.error('Error refreshing escalations:', error);
    }
  }

  private async refreshDashboardMetrics() {
    try {
      // Get active work orders count
      const { data: workOrders } = await this.supabaseClient
        .from('work_orders')
        .select('id, status');
      const activeWorkOrders = (workOrders || []).filter((wo: any) => 
        wo.status === 'pending' || wo.status === 'processing'
      ).length;

      // Get pending escalations count
      const { data: escalations } = await this.supabaseClient
        .from('escalations')
        .select('id, status');
      const pendingEscalations = (escalations || []).filter((esc: any) => 
        esc.status === 'pending'
      ).length;

      // Get system health
      const { data: systemComponents } = await this.supabaseClient
        .from('system_status')
        .select('status');
      const activeComponents = (systemComponents || []).filter((comp: any) => 
        comp.status === 'online'
      ).length;
      const totalComponents = (systemComponents || []).length;

      // Get monthly spend
      const { data: costs } = await this.supabaseClient
        .from('cost_tracking')
        .select('cost');
      const monthlySpend = (costs || []).reduce((sum: number, record: any) => 
        sum + (record.cost || 0), 0
      );

      const dashboardMetrics = {
        activeWorkOrders,
        pendingEscalations,
        systemHealth: {
          active: activeComponents,
          total: totalComponents
        },
        monthlySpend
      };

      this.broadcastToClients('dashboard_metrics', dashboardMetrics);
    } catch (error) {
      console.error('Error refreshing dashboard metrics:', error);
    }
  }

  // Clean up subscriptions
  cleanup() {
    this.channels.forEach(channel => {
      channel.unsubscribe();
    });
    this.channels.clear();
  }
}

// Initialize the listener when the module loads
const dbListener = DatabaseChangeListener.getInstance();
dbListener.setupRealtimeSubscriptions();