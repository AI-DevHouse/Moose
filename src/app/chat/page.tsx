'use client';

import { useState, useEffect } from 'react';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface ParsedIntent {
  action: string;
  params: any;
}

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Initialize messages after component mounts to avoid hydration issues
  useEffect(() => {
    setMounted(true);
    setMessages([{
      role: 'assistant',
      content: 'Hello! I\'m Moose Mission Control. I can help you create projects, decompose specs, and execute work orders. Try commands like:\n\n- "Create a project called my-app"\n- "Decompose the spec in SPEC.txt"\n- "Execute work order 0"\n- "Show me project STATUS"',
      timestamp: new Date()
    }]);
  }, []);

  // Parse user intent from natural language
  function parseIntent(message: string): ParsedIntent {
    const lower = message.toLowerCase();

    // Create project
    if (lower.includes('create project') || lower.includes('new project')) {
      const nameMatch = message.match(/(?:called|named)\s+([a-z0-9_-]+)/i);
      const dirMatch = message.match(/(?:in|at)\s+([a-zA-Z]:\\[^\s]+|\/[^\s]+)/);

      return {
        action: 'create_project',
        params: {
          name: nameMatch?.[1] || 'new-project',
          root_directory: dirMatch?.[1] || 'C:\\dev'
        }
      };
    }

    // Decompose spec
    if (lower.includes('decompose')) {
      const projectMatch = message.match(/project\s+([a-z0-9-]+)/i);
      const specMatch = message.match(/spec(?:\s+in)?\s+([^\s]+)/i);

      return {
        action: 'decompose',
        params: {
          project_id: projectMatch?.[1],
          spec_file: specMatch?.[1]
        }
      };
    }

    // Execute work order
    if (lower.includes('execute')) {
      const woMatch = message.match(/work\s*order\s*(\d+)/i) || message.match(/wo[- ]?(\d+)/i);

      return {
        action: 'execute',
        params: {
          work_order_num: woMatch?.[1]
        }
      };
    }

    // Show project
    if (lower.includes('show') || lower.includes('list') || lower.includes('status')) {
      if (lower.includes('project')) {
        const idMatch = message.match(/([a-f0-9-]{36})/i);
        return {
          action: 'show_project',
          params: {
            project_id: idMatch?.[1]
          }
        };
      }

      if (lower.includes('work order')) {
        return {
          action: 'list_work_orders',
          params: {}
        };
      }
    }

    return {
      action: 'unknown',
      params: {}
    };
  }

  // Format API response to readable English
  function formatResponse(action: string, result: any): string {
    if (!result.success && result.error) {
      return `❌ Error: ${result.error}`;
    }

    switch (action) {
      case 'create_project':
        const steps = result.next_steps?.steps || [];
        return `✅ Project "${result.project.name}" created!\n\n` +
               `📁 Location: ${result.project.local_path}\n` +
               `🆔 ID: ${result.project.id}\n\n` +
               `Next steps:\n${steps.map((s: any) => `${s.step}. ${s.title}`).join('\n')}`;

      case 'decompose':
        const reqs = result.detected_requirements || [];
        return `✅ Created ${result.work_orders_created} work orders\n\n` +
               `📋 Work Orders:\n${result.work_orders?.slice(0, 5).map((wo: any, i: number) => `  ${i}. ${wo.title}`).join('\n')}\n` +
               `${result.work_orders_created > 5 ? `  ... and ${result.work_orders_created - 5} more\n` : ''}` +
               `\n🔑 Detected Requirements: ${reqs.length}\n` +
               `${reqs.map((r: any) => `  - ${r.service}: ${r.env_var}${r.required ? ' (REQUIRED)' : ''}`).join('\n')}`;

      case 'execute':
        return `✅ Work order execution started!\n\n` +
               `📊 Status: ${result.status || 'processing'}\n` +
               `🔗 PR: ${result.pr_url || 'pending...'}`;

      case 'show_project':
        return `📁 Project: ${result.name}\n\n` +
               `🆔 ID: ${result.id}\n` +
               `📂 Path: ${result.local_path}\n` +
               `📊 Status: ${result.status}\n` +
               `🔧 Infrastructure: ${result.infrastructure_status}`;

      case 'list_work_orders':
        const wos = result.data || result;
        return `📋 Work Orders (${wos.length}):\n\n` +
               wos.slice(0, 10).map((wo: any, i: number) =>
                 `${i + 1}. ${wo.title} (${wo.status})`
               ).join('\n') +
               `${wos.length > 10 ? `\n... and ${wos.length - 10} more` : ''}`;

      default:
        return JSON.stringify(result, null, 2);
    }
  }

  // Handle API calls based on intent
  async function handleIntent(intent: ParsedIntent): Promise<string> {
    try {
      switch (intent.action) {
        case 'create_project':
          const createRes = await fetch('/api/projects/initialize', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(intent.params)
          });
          const createData = await createRes.json();
          return formatResponse('create_project', createData);

        case 'decompose':
          if (!intent.params.project_id) {
            return '❌ Please specify a project ID. Example: "Decompose spec for project abc-123"';
          }
          // For MVP, user needs to provide full spec in the message
          // In production, you'd read from file
          return '❌ Decompose requires spec content. Use the API directly for now:\n\n' +
                 `POST /api/architect/decompose\n` +
                 `{\n  "project_id": "${intent.params.project_id}",\n  "spec": {...}\n}`;

        case 'execute':
          if (!intent.params.work_order_num) {
            return '❌ Please specify a work order number. Example: "Execute work order 0"';
          }
          return '❌ Execute command coming soon. Use the API for now:\n\n' +
                 `POST /api/orchestrator/execute\n` +
                 `{\n  "work_order_id": "<work-order-id>"\n}`;

        case 'show_project':
          if (!intent.params.project_id) {
            return '❌ Please specify a project ID';
          }
          const projectRes = await fetch(`/api/projects/${intent.params.project_id}`);
          const projectData = await projectRes.json();
          return formatResponse('show_project', projectData);

        case 'list_work_orders':
          const wosRes = await fetch('/api/work-orders');
          const wosData = await wosRes.json();
          return formatResponse('list_work_orders', wosData);

        case 'unknown':
          return '❓ I didn\'t understand that command. Try:\n\n' +
                 '- "Create a project called my-app"\n' +
                 '- "Show me project <id>"\n' +
                 '- "List work orders"';

        default:
          return '❓ Command not implemented yet';
      }
    } catch (error: any) {
      return `❌ Error: ${error.message}`;
    }
  }

  async function handleSend() {
    if (!input.trim() || loading) return;

    const userMessage: Message = {
      role: 'user',
      content: input,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    try {
      // Parse intent
      const intent = parseIntent(input);

      // Handle intent
      const response = await handleIntent(intent);

      const assistantMessage: Message = {
        role: 'assistant',
        content: response,
        timestamp: new Date()
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (error: any) {
      const errorMessage: Message = {
        role: 'assistant',
        content: `❌ Error: ${error.message}`,
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setLoading(false);
    }
  }

  function handleKeyPress(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100vh',
      maxWidth: '800px',
      margin: '0 auto',
      padding: '20px',
      fontFamily: 'monospace'
    }}>
      <h1 style={{ marginBottom: '20px' }}>🦌 Moose Mission Control - Chat</h1>

      {/* Message history */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        border: '1px solid #ccc',
        padding: '20px',
        marginBottom: '20px',
        backgroundColor: '#f5f5f5',
        borderRadius: '4px'
      }}>
        {messages.map((msg, idx) => (
          <div key={idx} style={{
            marginBottom: '15px',
            padding: '10px',
            backgroundColor: msg.role === 'user' ? '#e3f2fd' : '#fff',
            borderLeft: `4px solid ${msg.role === 'user' ? '#2196f3' : '#4caf50'}`,
            borderRadius: '4px'
          }}>
            <div style={{ fontWeight: 'bold', marginBottom: '5px' }}>
              {msg.role === 'user' ? '👤 You' : '🦌 Moose'}
            </div>
            <div style={{ whiteSpace: 'pre-wrap' }}>{msg.content}</div>
            {mounted && (
              <div style={{ fontSize: '0.8em', color: '#666', marginTop: '5px' }}>
                {msg.timestamp.toLocaleTimeString()}
              </div>
            )}
          </div>
        ))}
        {loading && (
          <div style={{ textAlign: 'center', color: '#666' }}>
            🦌 Thinking...
          </div>
        )}
      </div>

      {/* Input area */}
      <div style={{ display: 'flex', gap: '10px' }}>
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder="Type a command... (e.g., 'Create a project called my-app')"
          disabled={loading}
          style={{
            flex: 1,
            padding: '10px',
            fontSize: '14px',
            fontFamily: 'monospace',
            border: '1px solid #ccc',
            borderRadius: '4px',
            resize: 'vertical',
            minHeight: '60px'
          }}
        />
        <button
          onClick={handleSend}
          disabled={!input.trim() || loading}
          style={{
            padding: '10px 20px',
            fontSize: '14px',
            backgroundColor: loading ? '#ccc' : '#4caf50',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: loading ? 'not-allowed' : 'pointer'
          }}
        >
          Send
        </button>
      </div>
    </div>
  );
}
