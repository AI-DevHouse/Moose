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

// Technical requirements specification per work order
export interface TechnicalRequirements {
  npm_dependencies?: string[];           // e.g., ["react@18.2.0", "next@14.0.0"]
  npm_dev_dependencies?: string[];       // e.g., ["typescript@5.3.0", "@types/react@18.2.0"]
  environment_variables?: string[];      // e.g., ["NEXT_PUBLIC_API_URL", "DATABASE_URL"]
  external_services?: Array<{
    name: string;                        // e.g., "OpenAI"
    env_vars: string[];                  // e.g., ["OPENAI_API_KEY"]
    purpose: string;                     // e.g., "AI text generation"
  }>;
  tsconfig_requirements?: {
    jsx?: 'react' | 'react-jsx' | 'preserve';
    target?: string;                     // e.g., "ES2020"
    lib?: string[];                      // e.g., ["ES2020", "DOM"]
    module?: string;                     // e.g., "commonjs", "esnext"
    [key: string]: any;                  // Allow other tsconfig options
  };
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
  technical_requirements?: TechnicalRequirements;  // NEW: Per-WO dependency specification
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