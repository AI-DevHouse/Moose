// src/types/architect.ts
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
}

export interface DecompositionOutput {
  work_orders: WorkOrder[];
  decomposition_doc: string;         // markdown explanation
  total_estimated_cost: number;      // dollars
}