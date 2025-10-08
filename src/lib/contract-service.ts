// src/lib/contract-service.ts
// Service for generating integration contracts for system components

import Anthropic from '@anthropic-ai/sdk';
import type {
  WorkOrder,
  IntegrationContracts,
  APIContract,
  IPCContract,
  StateContract,
  FileContract,
  DatabaseContract
} from '@/types/architect';

interface IntegrationPoint {
  type: 'api' | 'ipc' | 'state' | 'file' | 'database';
  description: string;
  work_orders: string[];  // Indices of related work orders
}

export class ContractGenerationService {
  private static instance: ContractGenerationService;
  private anthropic: Anthropic;

  private constructor() {
    const anthropicKey = process.env.ANTHROPIC_API_KEY;

    if (!anthropicKey) {
      throw new Error('[ContractService] ANTHROPIC_API_KEY environment variable is required');
    }

    this.anthropic = new Anthropic({ apiKey: anthropicKey });
  }

  static getInstance(): ContractGenerationService {
    if (!ContractGenerationService.instance) {
      ContractGenerationService.instance = new ContractGenerationService();
    }
    return ContractGenerationService.instance;
  }

  /**
   * Generate integration contracts from work orders
   */
  async generateContracts(workOrders: WorkOrder[]): Promise<{
    contracts: IntegrationContracts;
    cost: number;
  }> {
    console.log(`📋 Analyzing work orders for integration points...`);

    // Detect integration points
    const integrationPoints = this.detectIntegrationPoints(workOrders);

    if (integrationPoints.length === 0) {
      console.log('ℹ️  No integration points detected, skipping contract generation');
      return { contracts: {}, cost: 0 };
    }

    console.log(`🔗 Found ${integrationPoints.length} integration points:`);
    integrationPoints.forEach(p => console.log(`   - ${p.type}: ${p.description}`));

    const contracts: IntegrationContracts = {};
    let totalCost = 0;

    // Generate contracts for each integration type
    for (const point of integrationPoints) {
      try {
        switch (point.type) {
          case 'api':
            const apiResult = await this.generateAPIContracts(point, workOrders);
            contracts.api_contracts = apiResult.contracts;
            totalCost += apiResult.cost;
            break;
          case 'ipc':
            const ipcResult = await this.generateIPCContracts(point, workOrders);
            contracts.ipc_contracts = ipcResult.contracts;
            totalCost += ipcResult.cost;
            break;
          case 'state':
            const stateResult = await this.generateStateContracts(point, workOrders);
            contracts.state_contracts = stateResult.contracts;
            totalCost += stateResult.cost;
            break;
          case 'file':
            const fileResult = await this.generateFileContracts(point, workOrders);
            contracts.file_contracts = fileResult.contracts;
            totalCost += fileResult.cost;
            break;
          case 'database':
            const dbResult = await this.generateDatabaseContracts(point, workOrders);
            contracts.database_contracts = dbResult.contracts;
            totalCost += dbResult.cost;
            break;
        }
      } catch (error: any) {
        console.error(`   ❌ Failed to generate ${point.type} contracts:`, error.message);
      }
    }

    console.log(`✅ Contract generation complete: $${totalCost.toFixed(2)}\n`);

    return { contracts, cost: totalCost };
  }

  /**
   * Detect integration points from work order descriptions
   */
  private detectIntegrationPoints(workOrders: WorkOrder[]): IntegrationPoint[] {
    const points: IntegrationPoint[] = [];

    // Patterns for each integration type
    const patterns = {
      api: /\b(api|endpoint|rest|graphql|route|service|http)\b/i,
      ipc: /\b(ipc|inter-process|electron|main process|renderer|webview|channel)\b/i,
      state: /\b(state|redux|store|context|zustand|mobx|global state)\b/i,
      file: /\b(file system|persist|save|archive|manifest|json file|csv)\b/i,
      database: /\b(database|sql|postgresql|mongodb|table|query|schema)\b/i
    };

    // Check all work orders for integration patterns
    for (const [type, pattern] of Object.entries(patterns)) {
      const relatedWOs = workOrders
        .map((wo, idx) => ({ wo, idx }))
        .filter(({ wo }) =>
          pattern.test(wo.title) ||
          pattern.test(wo.description) ||
          wo.files_in_scope.some(f => pattern.test(f))
        );

      if (relatedWOs.length > 0) {
        const description = `${relatedWOs.length} work orders involve ${type} integration`;
        points.push({
          type: type as any,
          description,
          work_orders: relatedWOs.map(({ idx }) => idx.toString())
        });
      }
    }

    return points;
  }

  /**
   * Generate API contracts
   */
  private async generateAPIContracts(
    point: IntegrationPoint,
    workOrders: WorkOrder[]
  ): Promise<{ contracts: APIContract[]; cost: number }> {
    console.log(`   📡 Generating API contracts...`);

    const relevantWOs = point.work_orders.map(idx => workOrders[parseInt(idx)]);
    const context = relevantWOs.map((wo, i) =>
      `WO-${point.work_orders[i]}: ${wo.title}\n${wo.description}`
    ).join('\n\n');

    const prompt = `Based on these work order descriptions, define REST API contracts.

Work Orders:
${context}

For each API endpoint mentioned or implied:
1. endpoint: The URL path (e.g., "/api/users/:id")
2. method: HTTP method (GET, POST, PUT, DELETE, PATCH)
3. request_schema: TypeScript interface for request body (as string)
4. response_schema: TypeScript interface for response (as string)
5. validation_rules: Optional validation requirements
6. error_responses: Optional list of possible error codes/messages

Return ONLY a JSON array of APIContract objects. No explanations.

Example:
[
  {
    "endpoint": "/api/messages",
    "method": "POST",
    "request_schema": "interface CreateMessageRequest { text: string; room_id: string; }",
    "response_schema": "interface MessageResponse { message_id: string; created_at: string; }",
    "validation_rules": "text must be 1-1000 characters",
    "error_responses": ["400: Invalid room_id", "429: Rate limit exceeded"]
  }
]`;

    const startTime = Date.now();
    const response = await this.anthropic.messages.create({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 4000,
      messages: [{ role: 'user', content: prompt }]
    });

    const duration = Date.now() - startTime;
    const cost = this.calculateCost(response.usage.input_tokens, response.usage.output_tokens);

    const text = response.content[0].type === 'text' ? response.content[0].text : '';
    const contracts = this.extractJSON(text) as APIContract[];

    console.log(`      ✅ ${contracts.length} API contracts (${duration}ms, $${cost.toFixed(4)})`);

    return { contracts, cost };
  }

  /**
   * Generate IPC contracts
   */
  private async generateIPCContracts(
    point: IntegrationPoint,
    workOrders: WorkOrder[]
  ): Promise<{ contracts: IPCContract[]; cost: number }> {
    console.log(`   🔌 Generating IPC contracts...`);

    const relevantWOs = point.work_orders.map(idx => workOrders[parseInt(idx)]);
    const context = relevantWOs.map((wo, i) =>
      `WO-${point.work_orders[i]}: ${wo.title}\n${wo.description}`
    ).join('\n\n');

    const prompt = `Based on these work order descriptions, define IPC (Inter-Process Communication) contracts.

Work Orders:
${context}

For each IPC channel mentioned or implied:
1. channel_name: The channel identifier (e.g., "clipboard-paste")
2. message_format: TypeScript interface for message structure (as string)
3. event_sequence: Optional description of communication flow
4. example: Optional example message

Return ONLY a JSON array of IPCContract objects. No explanations.

Example:
[
  {
    "channel_name": "clipboard-paste",
    "message_format": "interface ClipboardMessage { content: string; target_window: number; }",
    "event_sequence": "Main sends 'start-capture' → Renderer replies 'capture-complete' with data",
    "example": "{ content: 'Hello', target_window: 1 }"
  }
]`;

    const startTime = Date.now();
    const response = await this.anthropic.messages.create({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 4000,
      messages: [{ role: 'user', content: prompt }]
    });

    const duration = Date.now() - startTime;
    const cost = this.calculateCost(response.usage.input_tokens, response.usage.output_tokens);

    const text = response.content[0].type === 'text' ? response.content[0].text : '';
    const contracts = this.extractJSON(text) as IPCContract[];

    console.log(`      ✅ ${contracts.length} IPC contracts (${duration}ms, $${cost.toFixed(4)})`);

    return { contracts, cost };
  }

  /**
   * Generate state management contracts
   */
  private async generateStateContracts(
    point: IntegrationPoint,
    workOrders: WorkOrder[]
  ): Promise<{ contracts: StateContract[]; cost: number }> {
    console.log(`   📦 Generating state contracts...`);

    const relevantWOs = point.work_orders.map(idx => workOrders[parseInt(idx)]);
    const context = relevantWOs.map((wo, i) =>
      `WO-${point.work_orders[i]}: ${wo.title}\n${wo.description}`
    ).join('\n\n');

    const prompt = `Based on these work order descriptions, define state management contracts.

Work Orders:
${context}

For each state slice or global state mentioned:
1. state_shape: TypeScript interface for state structure (as string)
2. action_types: Optional list of action type strings
3. selectors: Optional list of selector function names

Return ONLY a JSON array of StateContract objects. No explanations.

Example:
[
  {
    "state_shape": "interface AppState { cycles: Cycle[]; currentCycle: Cycle | null; status: 'idle' | 'running'; }",
    "action_types": ["START_CYCLE", "COMPLETE_CYCLE", "UPDATE_STATUS"],
    "selectors": ["selectCurrentCycle", "selectActiveCycles", "selectCycleCount"]
  }
]`;

    const startTime = Date.now();
    const response = await this.anthropic.messages.create({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 3000,
      messages: [{ role: 'user', content: prompt }]
    });

    const duration = Date.now() - startTime;
    const cost = this.calculateCost(response.usage.input_tokens, response.usage.output_tokens);

    const text = response.content[0].type === 'text' ? response.content[0].text : '';
    const contracts = this.extractJSON(text) as StateContract[];

    console.log(`      ✅ ${contracts.length} state contracts (${duration}ms, $${cost.toFixed(4)})`);

    return { contracts, cost };
  }

  /**
   * Generate file system contracts
   */
  private async generateFileContracts(
    point: IntegrationPoint,
    workOrders: WorkOrder[]
  ): Promise<{ contracts: FileContract[]; cost: number }> {
    console.log(`   📄 Generating file contracts...`);

    const relevantWOs = point.work_orders.map(idx => workOrders[parseInt(idx)]);
    const context = relevantWOs.map((wo, i) =>
      `WO-${point.work_orders[i]}: ${wo.title}\n${wo.description}`
    ).join('\n\n');

    const prompt = `Based on these work order descriptions, define file system contracts.

Work Orders:
${context}

For each file or file type mentioned:
1. path: File path or pattern (e.g., "manifests/[timestamp].json")
2. format: File format ("json", "csv", "xml", "binary", "text")
3. schema: Optional JSON schema or description of file structure

Return ONLY a JSON array of FileContract objects. No explanations.

Example:
[
  {
    "path": "manifests/[timestamp].json",
    "format": "json",
    "schema": "{ cycle_id: string, responses: string[], timestamp: string }"
  }
]`;

    const startTime = Date.now();
    const response = await this.anthropic.messages.create({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 3000,
      messages: [{ role: 'user', content: prompt }]
    });

    const duration = Date.now() - startTime;
    const cost = this.calculateCost(response.usage.input_tokens, response.usage.output_tokens);

    const text = response.content[0].type === 'text' ? response.content[0].text : '';
    const contracts = this.extractJSON(text) as FileContract[];

    console.log(`      ✅ ${contracts.length} file contracts (${duration}ms, $${cost.toFixed(4)})`);

    return { contracts, cost };
  }

  /**
   * Generate database contracts
   */
  private async generateDatabaseContracts(
    point: IntegrationPoint,
    workOrders: WorkOrder[]
  ): Promise<{ contracts: DatabaseContract[]; cost: number }> {
    console.log(`   🗄️  Generating database contracts...`);

    const relevantWOs = point.work_orders.map(idx => workOrders[parseInt(idx)]);
    const context = relevantWOs.map((wo, i) =>
      `WO-${point.work_orders[i]}: ${wo.title}\n${wo.description}`
    ).join('\n\n');

    const prompt = `Based on these work order descriptions, define database contracts.

Work Orders:
${context}

For each database table mentioned or implied:
1. table_name: Name of the table
2. columns: Array of {name, type, constraints} objects
3. relationships: Optional array of foreign key relationships
4. indexes: Optional array of index definitions

Return ONLY a JSON array of DatabaseContract objects. No explanations.

Example:
[
  {
    "table_name": "cycles",
    "columns": [
      {"name": "id", "type": "uuid", "constraints": "PRIMARY KEY"},
      {"name": "started_at", "type": "timestamp", "constraints": "NOT NULL"},
      {"name": "status", "type": "varchar(20)"}
    ],
    "relationships": [
      {"foreign_key": "user_id", "references": "users(id)"}
    ],
    "indexes": ["CREATE INDEX idx_status ON cycles(status)"]
  }
]`;

    const startTime = Date.now();
    const response = await this.anthropic.messages.create({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 3000,
      messages: [{ role: 'user', content: prompt }]
    });

    const duration = Date.now() - startTime;
    const cost = this.calculateCost(response.usage.input_tokens, response.usage.output_tokens);

    const text = response.content[0].type === 'text' ? response.content[0].text : '';
    const contracts = this.extractJSON(text) as DatabaseContract[];

    console.log(`      ✅ ${contracts.length} database contracts (${duration}ms, $${cost.toFixed(4)})`);

    return { contracts, cost };
  }

  /**
   * Extract JSON from Claude's response
   */
  private extractJSON(text: string): any {
    // Try to find JSON array in response
    const patterns = [
      /```json\n([\s\S]+?)\n```/,
      /```\n([\s\S]+?)\n```/,
      /(\[[\s\S]+\])/
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        try {
          return JSON.parse(match[1].trim());
        } catch (e) {
          continue;
        }
      }
    }

    // Fallback: try to parse entire text
    try {
      return JSON.parse(text);
    } catch (e) {
      console.warn('⚠️  Failed to parse contract JSON, returning empty array');
      return [];
    }
  }

  /**
   * Calculate cost based on Claude Sonnet 4.5 pricing
   */
  private calculateCost(inputTokens: number, outputTokens: number): number {
    const INPUT_COST_PER_TOKEN = 0.000003;
    const OUTPUT_COST_PER_TOKEN = 0.000015;

    return (inputTokens * INPUT_COST_PER_TOKEN) + (outputTokens * OUTPUT_COST_PER_TOKEN);
  }
}

export const contractService = ContractGenerationService.getInstance();
