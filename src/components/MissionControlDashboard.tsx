'use client'
import React, { useState, useEffect, useRef } from 'react';
import { 
  ChartBarIcon, 
  CogIcon, 
  ExclamationTriangleIcon,
  CheckCircleIcon,
  ClockIcon,
  CurrencyDollarIcon,
  DocumentTextIcon,
  PlayIcon,
  PauseIcon,
  ArrowPathIcon,
  WifiIcon,
  NoSymbolIcon,
  XMarkIcon
} from '@heroicons/react/24/outline';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { dashboardApi } from '@/lib/dashboard-api';
import AuthButton from '@/components/AuthButton';
import { TechnicalSpec, DecompositionOutput } from '@/types/architect';

// Types for Moose system data
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

// Simple WebSocket client for real-time updates
class SimpleWebSocketClient {
  private ws: WebSocket | null = null;
  private callbacks: any = {};
  private isConnected = false;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;

  constructor(callbacks: any) {
    this.callbacks = callbacks;
  }

  connect() {
    try {
      // For development, we'll simulate WebSocket with Supabase real-time
      // In production, use actual WebSocket connection
      console.log('Simulating WebSocket connection - using fallback polling with reduced interval');
      this.isConnected = true;
      this.callbacks.onConnectionStatusChange?.(true);
      
      // Start enhanced polling every 5 seconds instead of 30
      this.startEnhancedPolling();
    } catch (error) {
      console.error('WebSocket simulation error:', error);
      this.callbacks.onError?.('Failed to establish real-time connection');
    }
  }

  private startEnhancedPolling() {
  // Enhanced polling with smart updates
  const pollInterval = setInterval(async () => {
    if (this.isConnected) {
      try {
        // Update system heartbeats first
        await fetch('/api/system-heartbeat', { method: 'POST' });
        
        // Load all data and trigger callbacks
        const [workOrders, systemStatus, budgetData, patternMetrics, dashboardMetrics, escalations] = await Promise.all([
          dashboardApi.getWorkOrders(),
          dashboardApi.getSystemStatus(),
          dashboardApi.getBudgetData(),
          dashboardApi.getPatternMetrics(),
          dashboardApi.getDashboardMetrics(),
          dashboardApi.getEscalations()
        ]);
        
        // Trigger callbacks with new data
        this.callbacks.onWorkOrdersUpdate?.(workOrders);
        this.callbacks.onSystemStatusUpdate?.(systemStatus);
        this.callbacks.onBudgetUpdate?.(budgetData);
        this.callbacks.onPatternMetricsUpdate?.(patternMetrics);
        this.callbacks.onDashboardMetricsUpdate?.(dashboardMetrics);
        this.callbacks.onEscalationsUpdate?.(escalations);
        
      } catch (error) {
        console.error('Enhanced polling error:', error);
      }
    }
  }, 5000); // 5 second updates instead of 30

  // Store interval reference
  (this as any).pollInterval = pollInterval;
  }
  
disconnect() {
    this.isConnected = false;
    if ((this as any).pollInterval) {
      clearInterval((this as any).pollInterval);
    }
  }

  isConnectionOpen(): boolean {
    return this.isConnected;
  }
}

export default function MissionControlDashboard() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [systemStatus, setSystemStatus] = useState<SystemStatus[]>([]);
  const [budgetData, setBudgetData] = useState<BudgetData | null>(null);
  const [patternMetrics, setPatternMetrics] = useState<PatternMetrics | null>(null);
  const [dashboardMetrics, setDashboardMetrics] = useState<DashboardMetrics | null>(null);
  const [escalations, setEscalations] = useState<Escalation[]>([]);
  const [showCreateWorkOrder, setShowCreateWorkOrder] = useState(false);
  const [showEscalationModal, setShowEscalationModal] = useState(false);
  const [selectedEscalation, setSelectedEscalation] = useState<Escalation | null>(null);
  const [systemPaused, setSystemPaused] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [wsConnected, setWsConnected] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  // Upload Spec tab state
  const [specInput, setSpecInput] = useState('');
  const [decomposition, setDecomposition] = useState<DecompositionOutput | null>(null);
  const [decomposing, setDecomposing] = useState(false);

  const wsClient = useRef<SimpleWebSocketClient | null>(null);

  // Form state for work order creation
  const [newWorkOrder, setNewWorkOrder] = useState({
    title: '',
    description: '',
    risk_level: 'medium' as 'low' | 'medium' | 'high'
  });

  // Form state for escalation resolution
  const [escalationResolution, setEscalationResolution] = useState({
    resolution: '',
    assignedTo: ''
  });

  // Initialize WebSocket connection
  useEffect(() => {
    const wsCallbacks = {
      onWorkOrdersUpdate: (data: WorkOrder[]) => {
        setWorkOrders(data);
        setLastUpdate(new Date());
      },
      onSystemStatusUpdate: (data: SystemStatus[]) => {
        setSystemStatus(data);
        setLastUpdate(new Date());
      },
      onBudgetUpdate: (data: BudgetData) => {
        setBudgetData(data);
        setLastUpdate(new Date());
      },
      onPatternMetricsUpdate: (data: PatternMetrics) => {
        setPatternMetrics(data);
        setLastUpdate(new Date());
      },
      onDashboardMetricsUpdate: (data: DashboardMetrics) => {
        setDashboardMetrics(data);
        setLastUpdate(new Date());
      },
      onEscalationsUpdate: (data: Escalation[]) => {
        setEscalations(data);
        setLastUpdate(new Date());
      },
      onConnectionStatusChange: (connected: boolean) => {
        setWsConnected(connected);
        if (connected) {
          setError(null);
        }
      },
      onError: (errorMsg: string) => {
        setError(errorMsg);
        setWsConnected(false);
      }
    };

    wsClient.current = new SimpleWebSocketClient(wsCallbacks);
    wsClient.current.connect();

    // Initial data load
    loadDashboardData();

    return () => {
      if (wsClient.current) {
        wsClient.current.disconnect();
      }
    };
  }, []);

  // Load all dashboard data (fallback and initial load)
  const loadDashboardData = async () => {
    try {
      setError(null);
      const [
        workOrdersData,
        systemStatusData,
        budgetDataResult,
        patternMetricsData,
        dashboardMetricsData,
        escalationsData
      ] = await Promise.all([
        dashboardApi.getWorkOrders(),
        dashboardApi.getSystemStatus(),
        dashboardApi.getBudgetData(),
        dashboardApi.getPatternMetrics(),
        dashboardApi.getDashboardMetrics(),
        dashboardApi.getEscalations()
      ]);

      setWorkOrders(workOrdersData);
      setSystemStatus(systemStatusData);
      setBudgetData(budgetDataResult);
      setPatternMetrics(patternMetricsData);
      setDashboardMetrics(dashboardMetricsData);
      setEscalations(escalationsData);
      setLastUpdate(new Date());
    } catch (err) {
      setError('Failed to load dashboard data');
      console.error('Dashboard data loading error:', err);
    } finally {
      setLoading(false);
    }
  };

  // Handle work order creation with real-time update
  const handleCreateWorkOrder = async () => {
    if (!newWorkOrder.title.trim() || !newWorkOrder.description.trim()) {
      alert('Please fill in all fields');
      return;
    }

    try {
      const created = await dashboardApi.createWorkOrder(newWorkOrder);
      if (created) {
        // Optimistically update UI immediately
        setWorkOrders(prev => [created, ...prev]);
        setShowCreateWorkOrder(false);
        setNewWorkOrder({ title: '', description: '', risk_level: 'medium' });
        
        // Real-time update will sync automatically via WebSocket
      } else {
        alert('Failed to create work order');
      }
    } catch (err) {
      console.error('Error creating work order:', err);
      alert('Failed to create work order');
    }
  };

  // Handle escalation resolution - WITH DEBUG LOGGING
  const handleResolveEscalation = async (workOrder: WorkOrder) => {
    console.log('Debug - Looking for escalation for work order:', workOrder.id);
    console.log('Debug - Available escalations:', escalations);
    console.log('Debug - Escalations for this work order:', escalations.filter(esc => esc.work_order_id === workOrder.id));
    
    // Find the escalation for this work order - include both 'open' and 'in_progress' statuses
    const escalation = escalations.find(esc => 
      esc.work_order_id === workOrder.id && 
      (esc.status === 'open' || esc.status === 'in_progress')
    );
    
    if (escalation) {
      setSelectedEscalation(escalation);
      setShowEscalationModal(true);
    } else {
      alert('No active escalation found for this work order');
    }
  };

  // Submit escalation resolution
  const handleSubmitResolution = async () => {
    if (!selectedEscalation || !escalationResolution.resolution.trim()) {
      alert('Please provide resolution notes');
      return;
    }

    try {
      const success = await dashboardApi.resolveEscalation(
        selectedEscalation.id,
        escalationResolution.resolution
      );

      if (success) {
        // Update escalations list
        setEscalations(prev => prev.map(esc =>
          esc.id === selectedEscalation.id
            ? { ...esc, status: 'resolved' as const, resolution_notes: escalationResolution.resolution }
            : esc
        ));

        // Update work order status if needed
        setWorkOrders(prev => prev.map(wo =>
          wo.id === selectedEscalation.work_order_id
            ? { ...wo, status: 'processing' as const }
            : wo
        ));

        setShowEscalationModal(false);
        setSelectedEscalation(null);
        setEscalationResolution({ resolution: '', assignedTo: '' });
      } else {
        alert('Failed to resolve escalation');
      }
    } catch (err) {
      console.error('Error resolving escalation:', err);
      alert('Failed to resolve escalation');
    }
  };

  // Handle spec decomposition
  const handleDecomposeSpec = async () => {
    if (!specInput.trim()) {
      alert('Please provide a technical specification');
      return;
    }

    // Parse spec input (expecting markdown format)
    const lines = specInput.trim().split('\n');
    const spec: TechnicalSpec = {
      feature_name: lines[0]?.replace(/^#\s*/, '') || 'Untitled Feature',
      objectives: [],
      constraints: [],
      acceptance_criteria: []
    };

    // Simple parser - look for sections
    let currentSection = '';
    for (const line of lines.slice(1)) {
      if (line.toLowerCase().includes('objective')) currentSection = 'objectives';
      else if (line.toLowerCase().includes('constraint')) currentSection = 'constraints';
      else if (line.toLowerCase().includes('acceptance')) currentSection = 'acceptance_criteria';
      else if (line.startsWith('-') || line.startsWith('*')) {
        const item = line.replace(/^[-*]\s*/, '').trim();
        if (item && currentSection) {
          spec[currentSection as keyof Pick<TechnicalSpec, 'objectives' | 'constraints' | 'acceptance_criteria'>].push(item);
        }
      }
    }

    setDecomposing(true);
    setError(null);

    try {
      const response = await fetch('/api/architect/decompose', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(spec)
      });

      if (!response.ok) {
        throw new Error(`Decomposition failed: ${response.statusText}`);
      }

      const result: DecompositionOutput = await response.json();
      setDecomposition(result);
    } catch (err) {
      console.error('Decomposition error:', err);
      setError(err instanceof Error ? err.message : 'Failed to decompose specification');
    } finally {
      setDecomposing(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'online': return <CheckCircleIcon className="w-5 h-5 text-green-500" />;
      case 'degraded': return <ExclamationTriangleIcon className="w-5 h-5 text-yellow-500" />;
      case 'offline': return <ExclamationTriangleIcon className="w-5 h-5 text-red-500" />;
      default: return <ClockIcon className="w-5 h-5 text-gray-500" />;
    }
  };

  const getWorkOrderStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-800';
      case 'processing': return 'bg-blue-100 text-blue-800';
      case 'failed': return 'bg-red-100 text-red-800';
      case 'escalated': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getRiskLevelColor = (risk: string) => {
    switch (risk) {
      case 'low': return 'bg-green-100 text-green-800';
      case 'medium': return 'bg-yellow-100 text-yellow-800';
      case 'high': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <ArrowPathIcon className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">Loading Mission Control...</p>
        </div>
      </div>
    );
  }

  const budgetPercentage = budgetData ? budgetData.budget_percentage : 0;

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header with Real-time Status */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center space-x-3">
                <h1 className="text-3xl font-bold text-gray-900">Moose Mission Control</h1>
                <div className="flex items-center space-x-2">
                  {wsConnected ? (
                    <div className="flex items-center text-green-600">
                      <WifiIcon className="w-5 h-5 mr-1" />
                      <span className="text-sm font-medium">Real-time</span>
                    </div>
                  ) : (
                    <div className="flex items-center text-red-500">
                      <NoSymbolIcon className="w-5 h-5 mr-1" />
                      <span className="text-sm font-medium">Offline</span>
                    </div>
                  )}
                </div>
              </div>
              <div className="flex items-center space-x-4 text-gray-600">
                <p>AI-Native Autonomous Dev Environment v3.0</p>
                {lastUpdate && (
                  <p className="text-sm">
                    Last updated: {lastUpdate.toLocaleTimeString()}
                  </p>
                )}
              </div>
            </div>
            <div className="flex items-center space-x-4">
            <AuthButton />
            <button
                onClick={() => setSystemPaused(!systemPaused)}
                className={`flex items-center px-4 py-2 rounded-md ${
                  systemPaused 
                    ? 'bg-green-600 hover:bg-green-700 text-white' 
                    : 'bg-red-600 hover:bg-red-700 text-white'
                }`}
              >
                {systemPaused ? <PlayIcon className="w-4 h-4 mr-2" /> : <PauseIcon className="w-4 h-4 mr-2" />}
                {systemPaused ? 'Resume System' : 'Pause System'}
              </button>
              <button
                onClick={() => setShowCreateWorkOrder(true)}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md flex items-center"
              >
                <DocumentTextIcon className="w-4 h-4 mr-2" />
                Create Work Order
              </button>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="mb-6 border-b border-gray-200">
          <nav className="-mb-px flex space-x-8">
            <button
              onClick={() => setActiveTab('dashboard')}
              className={`${
                activeTab === 'dashboard'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
            >
              Dashboard
            </button>
            <button
              onClick={() => setActiveTab('upload-spec')}
              className={`${
                activeTab === 'upload-spec'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
            >
              Upload Spec
            </button>
          </nav>
        </div>

        {/* Error Banner */}
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-md p-4">
            <div className="flex items-center">
              <ExclamationTriangleIcon className="w-5 h-5 text-red-600 mr-2" />
              <span className="text-red-800">{error}</span>
              <button
                onClick={loadDashboardData}
                className="ml-auto text-red-600 hover:text-red-800 text-sm font-medium"
              >
                Retry
              </button>
            </div>
          </div>
        )}

        {/* Dashboard Tab Content */}
        {activeTab === 'dashboard' && (
          <>
            {/* Key Metrics Cards */}
            {dashboardMetrics && (
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <DocumentTextIcon className="h-8 w-8 text-blue-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-500">Active Work Orders</p>
                  <p className="text-2xl font-semibold text-gray-900">{dashboardMetrics.activeWorkOrders}</p>
                </div>
              </div>
            </div>
            
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <ExclamationTriangleIcon className="h-8 w-8 text-red-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-500">Pending Escalations</p>
                  <p className="text-2xl font-semibold text-gray-900">{dashboardMetrics.pendingEscalations}</p>
                </div>
              </div>
            </div>
            
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <CheckCircleIcon className="h-8 w-8 text-green-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-500">System Health</p>
                  <p className="text-2xl font-semibold text-gray-900">{dashboardMetrics.systemHealth.active}/{dashboardMetrics.systemHealth.total}</p>
                </div>
              </div>
            </div>
            
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <CurrencyDollarIcon className="h-8 w-8 text-yellow-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-500">Monthly Spend</p>
                  <p className="text-2xl font-semibold text-gray-900">£{dashboardMetrics.monthlySpend.toFixed(0)}</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* System Status Overview */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-7 gap-4 mb-8">
          {systemStatus.map((status) => (
            <div key={status.component_name} className="bg-white rounded-lg shadow p-4">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-medium text-gray-900">{status.component_name}</h3>
                {getStatusIcon(status.status)}
              </div>
              <p className="text-xs text-gray-600 mb-1">
                {status.response_time_ms.toFixed(0)}ms response
              </p>
              <p className="text-xs text-gray-500">
                {new Date(status.last_heartbeat).toLocaleTimeString()}
              </p>
            </div>
          ))}
        </div>

        {/* Budget and Pattern Metrics */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Budget Card */}
          {budgetData && (
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-gray-900">Budget Status</h3>
                <CurrencyDollarIcon className="w-6 h-6 text-green-600" />
              </div>
              
              <div className="mb-4">
                <div className="flex justify-between text-sm text-gray-600 mb-1">
                  <span>Monthly spend: £{budgetData.monthly_spend.toFixed(2)}</span>
                  <span>£{budgetData.monthly_budget.toFixed(2)}</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className={`h-2 rounded-full transition-all duration-500 ${
                      budgetPercentage > 90 ? 'bg-red-500' : 
                      budgetPercentage > 75 ? 'bg-yellow-500' : 'bg-green-500'
                    }`}
                    style={{ width: `${Math.min(budgetPercentage, 100)}%` }}
                  />
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  {budgetPercentage.toFixed(1)}% of monthly budget used
                </p>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Daily spend:</span>
                  <span className="font-medium">£{budgetData.daily_spend.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Projected month:</span>
                  <span className="font-medium">£{budgetData.projected_monthly.toFixed(2)}</span>
                </div>
              </div>
            </div>
          )}

          {/* Pattern Learning Metrics */}
          {patternMetrics && (
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-gray-900">Learning Progress</h3>
                <ChartBarIcon className="w-6 h-6 text-blue-600" />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-2xl font-bold text-gray-900">{patternMetrics.total_patterns}</p>
                  <p className="text-xs text-gray-600">Total Patterns</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-green-600">{patternMetrics.high_confidence}</p>
                  <p className="text-xs text-gray-600">High Confidence</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-blue-600">{(patternMetrics.success_rate * 100).toFixed(1)}%</p>
                  <p className="text-xs text-gray-600">Success Rate</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-purple-600">+{patternMetrics.learning_rate}</p>
                  <p className="text-xs text-gray-600">Daily Learning</p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Charts Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Real-time Performance Indicator */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Real-time Performance</h3>
            <div className="flex items-center justify-center h-48">
              <div className="text-center">
                <div className={`w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center ${
                  wsConnected ? 'bg-green-100' : 'bg-red-100'
                }`}>
                  {wsConnected ? (
                    <WifiIcon className="w-8 h-8 text-green-600 animate-pulse" />
                  ) : (
                    <NoSymbolIcon className="w-8 h-8 text-red-600" />
                  )}
                </div>
                <p className={`text-lg font-semibold ${wsConnected ? 'text-green-600' : 'text-red-600'}`}>
                  {wsConnected ? 'Real-time Connected' : 'Connection Lost'}
                </p>
                <p className="text-sm text-gray-500 mt-2">
                  {wsConnected 
                    ? 'Updates every 5 seconds' 
                    : 'Using fallback refresh'}
                </p>
              </div>
            </div>
          </div>

          {/* Cost Breakdown */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Cost Breakdown</h3>
            {budgetData?.cost_by_service && budgetData.cost_by_service.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={budgetData.cost_by_service}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="service" tick={{fontSize: 10}} angle={-45} textAnchor="end" />
                  <YAxis />
                  <Tooltip formatter={(value) => [`£${value}`, 'Cost']} />
                  <Bar dataKey="cost" fill="#8B5CF6" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-48 text-gray-500">
                <div className="text-center">
                  <CurrencyDollarIcon className="w-12 h-12 mx-auto mb-2 text-gray-400" />
                  <p className="text-sm">No cost data available yet</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Work Orders Table */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-medium text-gray-900">Recent Work Orders</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">ID</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Title</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Risk</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Proposer</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Confidence</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Cost</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {workOrders.map((wo) => (
                  <tr key={wo.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {wo.id.substring(0, 8)}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      <div className="max-w-xs truncate">{wo.title}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full transition-colors ${getWorkOrderStatusColor(wo.status)}`}>
                        {wo.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getRiskLevelColor(wo.risk_level)}`}>
                        {wo.risk_level}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {wo.proposer_configs?.name || 'Unknown'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {(wo.pattern_confidence * 100).toFixed(0)}%
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      £{wo.estimated_cost.toFixed(2)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <button className="text-blue-600 hover:text-blue-900 mr-3 transition-colors">View</button>
                      {wo.status === 'escalated' && (
                        <button 
                          onClick={() => handleResolveEscalation(wo)}
                          className="text-red-600 hover:text-red-900 transition-colors"
                        >
                          Resolve
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
          </>
        )}

        {/* Upload Spec Tab Content */}
        {activeTab === 'upload-spec' && (
          <div className="space-y-6">
            {/* Spec Input Section */}
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Technical Specification</h3>
              <p className="text-sm text-gray-600 mb-4">
                Provide a technical specification in markdown format. The Architect will decompose it into 3-8 Work Orders.
              </p>
              <textarea
                className="w-full border border-gray-300 rounded-md px-3 py-2 h-64 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder={`# Feature Name

## Objectives
- Objective 1
- Objective 2

## Constraints
- Constraint 1
- Constraint 2

## Acceptance Criteria
- Criterion 1
- Criterion 2`}
                value={specInput}
                onChange={(e) => setSpecInput(e.target.value)}
              />
              <div className="mt-4 flex justify-end space-x-3">
                <button
                  onClick={() => {
                    setSpecInput('');
                    setDecomposition(null);
                  }}
                  className="px-4 py-2 text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50"
                >
                  Clear
                </button>
                <button
                  onClick={handleDecomposeSpec}
                  disabled={decomposing || !specInput.trim()}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                >
                  {decomposing ? (
                    <>
                      <ArrowPathIcon className="w-4 h-4 mr-2 animate-spin" />
                      Decomposing...
                    </>
                  ) : (
                    <>
                      <DocumentTextIcon className="w-4 h-4 mr-2" />
                      Decompose Specification
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Decomposition Results */}
            {decomposition && (
              <>
                {/* Summary */}
                <div className="bg-white rounded-lg shadow p-6">
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Decomposition Summary</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <p className="text-2xl font-bold text-blue-600">{decomposition.work_orders.length}</p>
                      <p className="text-sm text-gray-600">Work Orders</p>
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-green-600">${decomposition.total_estimated_cost.toFixed(2)}</p>
                      <p className="text-sm text-gray-600">Estimated Cost</p>
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-purple-600">
                        {decomposition.work_orders.filter(wo => wo.risk_level === 'high').length}
                      </p>
                      <p className="text-sm text-gray-600">High Risk WOs</p>
                    </div>
                  </div>
                </div>

                {/* Work Orders List */}
                <div className="bg-white rounded-lg shadow overflow-hidden">
                  <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
                    <h3 className="text-lg font-medium text-gray-900">Work Orders</h3>
                    <button
                      className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
                      onClick={() => alert('Director approval flow will be implemented next')}
                    >
                      Submit to Director
                    </button>
                  </div>
                  <div className="divide-y divide-gray-200">
                    {decomposition.work_orders.map((wo, index) => (
                      <div key={index} className="p-6 hover:bg-gray-50">
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex-1">
                            <div className="flex items-center space-x-3 mb-2">
                              <span className="font-medium text-gray-900">WO-{index}</span>
                              <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getRiskLevelColor(wo.risk_level)}`}>
                                {wo.risk_level}
                              </span>
                              <span className="text-sm text-gray-500">
                                ~{wo.context_budget_estimate} tokens
                              </span>
                            </div>
                            <h4 className="text-lg font-medium text-gray-900 mb-2">{wo.title}</h4>
                            <p className="text-sm text-gray-600 mb-3">{wo.description}</p>

                            {/* Acceptance Criteria */}
                            <div className="mb-3">
                              <p className="text-sm font-medium text-gray-700 mb-1">Acceptance Criteria:</p>
                              <ul className="list-disc list-inside text-sm text-gray-600 space-y-1">
                                {wo.acceptance_criteria.map((criterion, i) => (
                                  <li key={i}>{criterion}</li>
                                ))}
                              </ul>
                            </div>

                            {/* Files in Scope */}
                            {wo.files_in_scope.length > 0 && (
                              <div className="mb-3">
                                <p className="text-sm font-medium text-gray-700 mb-1">Files in Scope:</p>
                                <div className="flex flex-wrap gap-2">
                                  {wo.files_in_scope.map((file, i) => (
                                    <span key={i} className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded">
                                      {file}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Dependencies */}
                            {wo.dependencies.length > 0 && (
                              <div>
                                <p className="text-sm font-medium text-gray-700 mb-1">Dependencies:</p>
                                <div className="flex flex-wrap gap-2">
                                  {wo.dependencies.map((dep, i) => (
                                    <span key={i} className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">
                                      WO-{dep}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Decomposition Documentation */}
                <div className="bg-white rounded-lg shadow p-6">
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Decomposition Documentation</h3>
                  <div className="prose prose-sm max-w-none">
                    <pre className="whitespace-pre-wrap text-sm text-gray-700 bg-gray-50 p-4 rounded">
                      {decomposition.decomposition_doc}
                    </pre>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* Create Work Order Modal */}
        {showCreateWorkOrder && (
          <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
            <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
              <div className="mt-3 text-center">
                <h3 className="text-lg font-medium text-gray-900 mb-4">Create Work Order</h3>
                <div className="space-y-4 text-left">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
                    <input 
                      type="text" 
                      className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" 
                      placeholder="Brief description of the work"
                      value={newWorkOrder.title}
                      onChange={(e) => setNewWorkOrder(prev => ({...prev, title: e.target.value}))}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                    <textarea 
                      className="w-full border border-gray-300 rounded-md px-3 py-2 h-24 focus:outline-none focus:ring-2 focus:ring-blue-500" 
                      placeholder="Detailed requirements and acceptance criteria"
                      value={newWorkOrder.description}
                      onChange={(e) => setNewWorkOrder(prev => ({...prev, description: e.target.value}))}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Risk Level</label>
                    <select 
                      className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      value={newWorkOrder.risk_level}
                      onChange={(e) => setNewWorkOrder(prev => ({...prev, risk_level: e.target.value as 'low' | 'medium' | 'high'}))}
                    >
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                    </select>
                  </div>
                  <div className="flex justify-between pt-4">
                    <button
                      type="button"
                      onClick={() => setShowCreateWorkOrder(false)}
                      className="px-4 py-2 text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleCreateWorkOrder}
                      className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                    >
                      Create Work Order
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Escalation Resolution Modal */}
        {showEscalationModal && selectedEscalation && (
          <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
            <div className="relative top-20 mx-auto p-5 border w-[500px] shadow-lg rounded-md bg-white">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-medium text-gray-900">Resolve Escalation</h3>
                <button
                  onClick={() => {
                    setShowEscalationModal(false);
                    setSelectedEscalation(null);
                    setEscalationResolution({ resolution: '', assignedTo: '' });
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <XMarkIcon className="w-6 h-6" />
                </button>
              </div>
              
              <div className="space-y-4 text-left">
                {/* Escalation Details */}
                <div className="bg-gray-50 p-4 rounded-md">
                  <h4 className="text-sm font-medium text-gray-900 mb-2">Escalation Details</h4>
                  <p className="text-sm text-gray-600 mb-1">
                    <span className="font-medium">Work Order:</span> {selectedEscalation.work_orders?.title || 'Unknown'}
                  </p>
                  <p className="text-sm text-gray-600 mb-1">
                    <span className="font-medium">Reason:</span> {selectedEscalation.reason}
                  </p>
                  <p className="text-sm text-gray-600">
                    <span className="font-medium">Created:</span> {new Date(selectedEscalation.created_at).toLocaleString()}
                  </p>
                </div>

                {/* Resolution Form */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Resolution Notes</label>
                  <textarea 
                    className="w-full border border-gray-300 rounded-md px-3 py-2 h-32 focus:outline-none focus:ring-2 focus:ring-blue-500" 
                    placeholder="Describe how this escalation was resolved..."
                    value={escalationResolution.resolution}
                    onChange={(e) => setEscalationResolution(prev => ({...prev, resolution: e.target.value}))}
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Assigned To (Optional)</label>
                  <input 
                    type="text" 
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" 
                    placeholder="Team member or department handling this"
                    value={escalationResolution.assignedTo}
                    onChange={(e) => setEscalationResolution(prev => ({...prev, assignedTo: e.target.value}))}
                  />
                </div>

                <div className="flex justify-between pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setShowEscalationModal(false);
                      setSelectedEscalation(null);
                      setEscalationResolution({ resolution: '', assignedTo: '' });
                    }}
                    className="px-4 py-2 text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleSubmitResolution}
                    className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors"
                    disabled={!escalationResolution.resolution.trim()}
                  >
                    Resolve Escalation
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}