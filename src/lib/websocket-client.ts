// src/lib/websocket-client.ts
// Real-time WebSocket client for dashboard updates

interface WebSocketMessage {
  type: 'work_orders' | 'system_status' | 'budget' | 'pattern_metrics' | 'dashboard_metrics' | 'escalations';
  data: any;
  timestamp: string;
}

interface WebSocketCallbacks {
  onWorkOrdersUpdate?: (data: any[]) => void;
  onSystemStatusUpdate?: (data: any[]) => void;
  onBudgetUpdate?: (data: any) => void;
  onPatternMetricsUpdate?: (data: any) => void;
  onDashboardMetricsUpdate?: (data: any) => void;
  onEscalationsUpdate?: (data: any[]) => void;
  onConnectionStatusChange?: (connected: boolean) => void;
  onError?: (error: string) => void;
}

export class WebSocketClient {
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000; // Start with 1 second
  private callbacks: WebSocketCallbacks = {};
  private isConnected = false;
  private heartbeatInterval: NodeJS.Timeout | null = null;

  constructor(callbacks: WebSocketCallbacks) {
    this.callbacks = callbacks;
  }

  connect() {
    try {
      // Use wss:// for production, ws:// for development
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/api/websocket`;
      
      this.ws = new WebSocket(wsUrl);
      
      this.ws.onopen = this.handleOpen.bind(this);
      this.ws.onmessage = this.handleMessage.bind(this);
      this.ws.onclose = this.handleClose.bind(this);
      this.ws.onerror = this.handleError.bind(this);
      
    } catch (error) {
      console.error('WebSocket connection error:', error);
      this.callbacks.onError?.('Failed to establish WebSocket connection');
      this.scheduleReconnect();
    }
  }

  private handleOpen() {
    console.log('WebSocket connected');
    this.isConnected = true;
    this.reconnectAttempts = 0;
    this.reconnectDelay = 1000;
    this.callbacks.onConnectionStatusChange?.(true);
    
    // Start heartbeat to keep connection alive
    this.startHeartbeat();
    
    // Subscribe to all data streams
    this.subscribe(['work_orders', 'system_status', 'budget', 'pattern_metrics', 'dashboard_metrics', 'escalations']);
  }

  private handleMessage(event: MessageEvent) {
    try {
      const message: WebSocketMessage = JSON.parse(event.data);
      
      switch (message.type) {
        case 'work_orders':
          this.callbacks.onWorkOrdersUpdate?.(message.data);
          break;
        case 'system_status':
          this.callbacks.onSystemStatusUpdate?.(message.data);
          break;
        case 'budget':
          this.callbacks.onBudgetUpdate?.(message.data);
          break;
        case 'pattern_metrics':
          this.callbacks.onPatternMetricsUpdate?.(message.data);
          break;
        case 'dashboard_metrics':
          this.callbacks.onDashboardMetricsUpdate?.(message.data);
          break;
        case 'escalations':
          this.callbacks.onEscalationsUpdate?.(message.data);
          break;
        default:
          console.warn('Unknown WebSocket message type:', message.type);
      }
    } catch (error) {
      console.error('Error parsing WebSocket message:', error);
    }
  }

  private handleClose(event: CloseEvent) {
    console.log('WebSocket disconnected:', event.code, event.reason);
    this.isConnected = false;
    this.callbacks.onConnectionStatusChange?.(false);
    this.stopHeartbeat();
    
    // Don't reconnect if it was a normal closure
    if (event.code !== 1000) {
      this.scheduleReconnect();
    }
  }

  private handleError(error: Event) {
    console.error('WebSocket error:', error);
    this.callbacks.onError?.('WebSocket connection error');
  }

  private scheduleReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('Max reconnection attempts reached');
      this.callbacks.onError?.('Connection lost. Please refresh the page.');
      return;
    }

    this.reconnectAttempts++;
    const delay = Math.min(this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1), 30000);
    
    console.log(`Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);
    
    setTimeout(() => {
      if (!this.isConnected) {
        this.connect();
      }
    }, delay);
  }

  private startHeartbeat() {
    this.heartbeatInterval = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: 'ping' }));
      }
    }, 30000); // Ping every 30 seconds
  }

  private stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  private subscribe(types: string[]) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        type: 'subscribe',
        channels: types
      }));
    }
  }

  disconnect() {
    this.stopHeartbeat();
    if (this.ws) {
      this.ws.close(1000, 'Client disconnecting');
      this.ws = null;
    }
    this.isConnected = false;
  }

  isConnectionOpen(): boolean {
    return this.isConnected && this.ws?.readyState === WebSocket.OPEN;
  }
}

// Enhanced dashboard API with fallback to HTTP when WebSocket unavailable
export const enhancedDashboardApi = {
  ...require('./dashboard-api').dashboardApi,
  
  // Fallback method that uses HTTP when WebSocket is not available
  async getDataWithFallback(endpoint: string) {
    try {
      const response = await fetch(endpoint);
      if (!response.ok) throw new Error(`Failed to fetch ${endpoint}`);
      return await response.json();
    } catch (error) {
      console.error(`Fallback API call failed for ${endpoint}:`, error);
      return null;
    }
  }
};