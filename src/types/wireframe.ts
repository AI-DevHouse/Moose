// src/types/wireframe.ts
// Type definitions for wireframe generation service

export interface WireframeRequest {
  component_name: string;        // e.g., "ArbitrationView"
  work_order_title: string;      // From WorkOrder.title
  description: string;           // From WorkOrder.description
  files_in_scope: string[];      // From WorkOrder.files_in_scope
  acceptance_criteria?: string[]; // Optional: from WorkOrder
}

export interface WireframeResult {
  component_name: string;
  code: string;                  // Full React component code
  tokens_used: number;           // Input + output tokens
  cost: number;                  // Dollars
  generated_at: string;          // ISO timestamp
  storage_path?: string;         // Path in Supabase storage
}

export interface WireframeMetadata {
  component_name: string;
  generated: boolean;
  storage_path: string;
  cost: number;
}
