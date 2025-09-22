'use client'

import React, { useState, useEffect } from 'react';
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
  ArrowPathIcon
} from '@heroicons/react/24/outline';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { dashboardApi } from '@/lib/dashboard-api';
import AuthButton from '@/components/AuthButton';

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

export default function MissionControlDashboard() {
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [systemStatus, setSystemStatus] = useState<SystemStatus[]>([]);
  const [budgetData, setBudgetData] = useState<BudgetData | null>(null);
  const [patternMetrics, setPatternMetrics] = useState<PatternMetrics | null>(null);
  const [dashboardMetrics, setDashboardMetrics] = useState<DashboardMetrics | null>(null);
  const [showCreateWorkOrder, setShowCreateWorkOrder] = useState(false);
  const [systemPaused, setSystemPaused] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Form state for work order creation
  const [newWorkOrder, setNewWorkOrder] = useState({
    title: '',
    description: '',
    risk_level: 'medium' as 'low' | 'medium' | 'high'
  });

  // Load all dashboard data
  const loadDashboardData = async () => {
    try {
      setError(null);
      const [
        workOrdersData,
        systemStatusData,
        budgetDataResult,
        patternMetricsData,
        dashboardMetricsData
      ] = await Promise.all([
        dashboardApi.getWorkOrders(),
        dashboardApi.getSystemStatus(),
        dashboardApi.getBudgetData(),
        dashboardApi.getPatternMetrics(),
        dashboardApi.getDashboardMetrics()
      ]);

      setWorkOrders(workOrdersData);
      setSystemStatus(systemStatusData);
      setBudgetData(budgetDataResult);
      setPatternMetrics(patternMetricsData);
      setDashboardMetrics(dashboardMetricsData); // Fixed: Now correctly storing dashboard metrics
    } catch (err) {
      setError('Failed to load dashboard data');
      console.error('Dashboard data loading error:', err);
    } finally {
      setLoading(false);
    }
  };

  // Initial data load
  useEffect(() => {
    loadDashboardData();
  }, []);

  // Real-time updates every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      if (!systemPaused) {
        loadDashboardData();
      }
    }, 30000);

    return () => clearInterval(interval);
  }, [systemPaused]);

  // Handle work order creation
  const handleCreateWorkOrder = async () => {
    if (!newWorkOrder.title.trim() || !newWorkOrder.description.trim()) {
      alert('Please fill in all fields');
      return;
    }

    try {
      const created = await dashboardApi.createWorkOrder(newWorkOrder);
      if (created) {
        setWorkOrders(prev => [created, ...prev]);
        setShowCreateWorkOrder(false);
        setNewWorkOrder({ title: '', description: '', risk_level: 'medium' });
      } else {
        alert('Failed to create work order');
      }
    } catch (err) {
      console.error('Error creating work order:', err);
      alert('Failed to create work order');
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

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <ExclamationTriangleIcon className="w-8 h-8 text-red-600 mx-auto mb-4" />
          <p className="text-red-600 mb-4">{error}</p>
          <button 
            onClick={() => { setLoading(true); loadDashboardData(); }}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const budgetPercentage = budgetData ? budgetData.budget_percentage : 0;

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Moose Mission Control</h1>
              <p className="text-gray-600">AI-Native Autonomous Dev Environment v3.0</p>
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
                    className={`h-2 rounded-full ${
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

        {/* Charts Section - Simplified for now */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Placeholder for future charts */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Performance Trends</h3>
            <div className="flex items-center justify-center h-48 text-gray-500">
              <div className="text-center">
                <ChartBarIcon className="w-12 h-12 mx-auto mb-2 text-gray-400" />
                <p className="text-sm">Chart data will appear here as more work orders are processed</p>
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
                  <tr key={wo.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {wo.id.substring(0, 8)}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      <div className="max-w-xs truncate">{wo.title}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getWorkOrderStatusColor(wo.status)}`}>
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
                      <button className="text-blue-600 hover:text-blue-900 mr-3">View</button>
                      {wo.status === 'escalated' && (
                        <button className="text-red-600 hover:text-red-900">Resolve</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

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
                      className="w-full border border-gray-300 rounded-md px-3 py-2" 
                      placeholder="Brief description of the work"
                      value={newWorkOrder.title}
                      onChange={(e) => setNewWorkOrder(prev => ({...prev, title: e.target.value}))}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                    <textarea 
                      className="w-full border border-gray-300 rounded-md px-3 py-2 h-24" 
                      placeholder="Detailed requirements and acceptance criteria"
                      value={newWorkOrder.description}
                      onChange={(e) => setNewWorkOrder(prev => ({...prev, description: e.target.value}))}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Risk Level</label>
                    <select 
                      className="w-full border border-gray-300 rounded-md px-3 py-2"
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
                      className="px-4 py-2 text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleCreateWorkOrder}
                      className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                    >
                      Create Work Order
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}