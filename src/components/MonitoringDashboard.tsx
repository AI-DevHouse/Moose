'use client';

import { useState, useEffect } from 'react';
import {
  CheckCircleIcon,
  ExclamationTriangleIcon,
  XCircleIcon,
  ArrowPathIcon
} from '@heroicons/react/24/outline';

interface HealthCheck {
  status: 'healthy' | 'warning' | 'error';
  count?: number;
  details?: any[];
  dailySpend?: number;
  dailyLimit?: number;
  percentUsed?: number;
}

interface HealthResponse {
  status: 'healthy' | 'warning' | 'error';
  timestamp: string;
  checks: {
    stuckWorkOrders: HealthCheck;
    pendingEscalations: HealthCheck;
    budgetUsage: HealthCheck;
    recentErrors: HealthCheck;
    workOrderStates: Record<string, number>;
  };
  error?: string;
}

export function MonitoringDashboard() {
  const [healthData, setHealthData] = useState<HealthResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  const fetchHealth = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/admin/health');
      const data = await response.json();
      setHealthData(data);
      setLastRefresh(new Date());
    } catch (error) {
      console.error('Failed to fetch health data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHealth();
    // Auto-refresh every 30 seconds
    const interval = setInterval(fetchHealth, 30000);
    return () => clearInterval(interval);
  }, []);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy':
        return <CheckCircleIcon className="h-5 w-5 text-green-500" />;
      case 'warning':
        return <ExclamationTriangleIcon className="h-5 w-5 text-yellow-500" />;
      case 'error':
        return <XCircleIcon className="h-5 w-5 text-red-500" />;
      default:
        return null;
    }
  };

  const getStatusBadge = (status: string) => {
    const colorClass = status === 'healthy' ? 'bg-green-100 text-green-800' :
                       status === 'warning' ? 'bg-yellow-100 text-yellow-800' :
                       'bg-red-100 text-red-800';
    return (
      <span className={`px-3 py-1 rounded-full text-sm font-medium ${colorClass}`}>
        {status.toUpperCase()}
      </span>
    );
  };

  if (loading && !healthData) {
    return <div className="p-8 text-center">Loading health data...</div>;
  }

  if (!healthData) {
    return <div className="p-8 text-center text-red-500">Failed to load health data</div>;
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">System Health Monitor</h1>
          <p className="text-sm text-gray-500 mt-1">
            Last updated: {lastRefresh.toLocaleTimeString()}
          </p>
        </div>
        <div className="flex items-center gap-4">
          {getStatusBadge(healthData.status)}
          <button
            onClick={fetchHealth}
            disabled={loading}
            className="p-2 rounded-md hover:bg-gray-100 disabled:opacity-50"
          >
            <ArrowPathIcon className={`h-5 w-5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Overall Status */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            {getStatusIcon(healthData.status)}
            Overall System Status
          </h2>
        </div>
        <div className="p-6">
          <p className="text-sm text-gray-600">
            {healthData.status === 'healthy' && 'All systems operating normally'}
            {healthData.status === 'warning' && 'Some issues detected - review recommended'}
            {healthData.status === 'error' && 'Critical issues detected - immediate attention required'}
          </p>
        </div>
      </div>

      {/* Stuck Work Orders */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            {getStatusIcon(healthData.checks.stuckWorkOrders.status)}
            Stuck Work Orders
          </h2>
        </div>
        <div className="p-6">
          <p className="text-2xl font-bold">{healthData.checks.stuckWorkOrders.count}</p>
          <p className="text-sm text-gray-600 mt-1">Work orders older than 24 hours</p>
          {healthData.checks.stuckWorkOrders.details && healthData.checks.stuckWorkOrders.details.length > 0 && (
            <div className="mt-4 space-y-2">
              <p className="text-sm font-semibold">Recent stuck work orders:</p>
              {healthData.checks.stuckWorkOrders.details.map((wo: any) => (
                <div key={wo.id} className="text-sm p-2 bg-gray-50 rounded">
                  <div className="font-medium">{wo.title}</div>
                  <div className="text-gray-600">Status: {wo.status}</div>
                  <div className="text-gray-500 text-xs">
                    Created: {new Date(wo.created_at).toLocaleString()}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Pending Escalations */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            {getStatusIcon(healthData.checks.pendingEscalations.status)}
            Pending Escalations
          </h2>
        </div>
        <div className="p-6">
          <p className="text-2xl font-bold">{healthData.checks.pendingEscalations.count}</p>
          <p className="text-sm text-gray-600 mt-1">Unresolved escalations</p>
          {healthData.checks.pendingEscalations.details && healthData.checks.pendingEscalations.details.length > 0 && (
            <div className="mt-4 space-y-2">
              <p className="text-sm font-semibold">Recent escalations:</p>
              {healthData.checks.pendingEscalations.details.map((esc: any) => (
                <div key={esc.id} className="text-sm p-2 bg-gray-50 rounded">
                  <div className="font-medium">{esc.reason}</div>
                  <div className="text-gray-600">Status: {esc.status}</div>
                  <div className="text-gray-500 text-xs">
                    {new Date(esc.created_at).toLocaleString()}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Budget Usage */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            {getStatusIcon(healthData.checks.budgetUsage.status)}
            Budget Usage (Today)
          </h2>
        </div>
        <div className="p-6">
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Spent:</span>
              <span className="text-2xl font-bold">
                ${healthData.checks.budgetUsage.dailySpend?.toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Limit:</span>
              <span className="text-sm font-medium">
                ${healthData.checks.budgetUsage.dailyLimit?.toFixed(2)}
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2.5 mt-2">
              <div
                className={`h-2.5 rounded-full ${
                  (healthData.checks.budgetUsage.percentUsed || 0) > 80
                    ? 'bg-red-600'
                    : (healthData.checks.budgetUsage.percentUsed || 0) > 50
                    ? 'bg-yellow-600'
                    : 'bg-green-600'
                }`}
                style={{ width: `${Math.min(healthData.checks.budgetUsage.percentUsed || 0, 100)}%` }}
              ></div>
            </div>
            <p className="text-sm text-gray-600 text-right">
              {healthData.checks.budgetUsage.percentUsed?.toFixed(1)}% used
            </p>
          </div>
        </div>
      </div>

      {/* Recent Errors */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            {getStatusIcon(healthData.checks.recentErrors.status)}
            Recent Errors (Last 24h)
          </h2>
        </div>
        <div className="p-6">
          <p className="text-2xl font-bold">{healthData.checks.recentErrors.count}</p>
          <p className="text-sm text-gray-600 mt-1">Errors in the last 24 hours</p>
        </div>
      </div>

      {/* Work Order State Distribution */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-lg font-semibold">Work Order State Distribution</h2>
        </div>
        <div className="p-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {Object.entries(healthData.checks.workOrderStates).map(([state, count]) => (
              <div key={state} className="p-3 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-600 capitalize">{state}</p>
                <p className="text-2xl font-bold">{count}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
