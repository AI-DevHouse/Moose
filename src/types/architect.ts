// src/types/architect.ts
import type { WireframeMetadata } from './wireframe';

export interface TechnicalSpec {
  feature_name: string;
  objectives: string[];
  constraints: string[];
  acceptance_criteria: string[];
  budget_estimate?: number;    // dollars
  time_estimate?: string;      // e.g., "3 days"
}

export interface WorkOrder {
  title: string;
  description: string;
  acceptance_criteria: string[];
  files_in_scope: string[];
  context_budget_estimate: number;  // tokens
  risk_level: "low" | "medium" | "high";
  dependencies: string[];           // WO IDs or indices
  wireframe?: WireframeMetadata;    // Optional: Generated wireframe metadata
  contracts?: IntegrationContracts;  // Optional: Integration contracts
}

export interface DecompositionOutput {
  work_orders: WorkOrder[];
  decomposition_doc: string;         // markdown explanation
  total_estimated_cost: number;      // dollars
  wireframe_cost?: number;           // Optional: Cost of wireframe generation
  contract_cost?: number;            // Optional: Cost of contract generation
  contracts?: IntegrationContracts;  // Optional: Generated contracts
}

// Integration contracts for system components
export interface IntegrationContracts {
  api_contracts?: APIContract[];
  ipc_contracts?: IPCContract[];
  state_contracts?: StateContract[];
  file_contracts?: FileContract[];
  database_contracts?: DatabaseContract[];
}

export interface APIContract {
  endpoint: string;
  method: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
  request_schema: string;  // TypeScript interface as string
  response_schema: string;
  validation_rules?: string;
  error_responses?: string[];
}

export interface IPCContract {
  channel_name: string;
  message_format: string;  // TypeScript interface as string
  event_sequence?: string;  // Description of message flow
  example?: string;
}

export interface StateContract {
  state_shape: string;  // TypeScript interface as string
  action_types?: string[];
  selectors?: string[];
}

export interface FileContract {
  path: string;
  format: "json" | "csv" | "xml" | "binary" | "text";
  schema?: string;  // JSON schema or description
}

export interface DatabaseContract {
  table_name: string;
  columns: { name: string; type: string; constraints?: string }[];
  relationships?: { foreign_key: string; references: string }[];
  indexes?: string[];
}