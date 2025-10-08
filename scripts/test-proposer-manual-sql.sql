-- Manual SQL for Testing Proposer Execution
-- Run these commands in Supabase SQL Editor: https://supabase.com/dashboard/project/veofqiywppjsjqfqztft/sql
--
-- This creates 3 Todo App work orders for end-to-end testing

-- Work Order 0: Setup project structure and TypeScript configuration
INSERT INTO work_orders (
  title,
  description,
  status,
  risk_level,
  estimated_cost,
  pattern_confidence,
  acceptance_criteria,
  files_in_scope,
  context_budget_estimate,
  metadata
) VALUES (
  'Setup project structure and TypeScript configuration',
  'Initialize React project with TypeScript, configure tsconfig.json, setup necessary dependencies (React, TypeScript, type definitions), and create basic folder structure for components, types, and utilities.',
  'pending',
  'low',
  0.10,
  0.95,
  '["Project builds without TypeScript errors", "tsconfig.json properly configured for React", "Folder structure created (components/, types/, utils/)", "Dependencies installed and verified"]'::jsonb,
  '["package.json", "tsconfig.json", "src/types/todo.ts"]'::jsonb,
  800,
  '{"test": true, "project": "Todo App", "batch": "Phase 2 Validation"}'::jsonb
);

-- Work Order 1: Implement localStorage utility layer (depends on WO-0)
INSERT INTO work_orders (
  title,
  description,
  status,
  risk_level,
  estimated_cost,
  pattern_confidence,
  acceptance_criteria,
  files_in_scope,
  context_budget_estimate,
  metadata
) VALUES (
  'Implement localStorage utility layer',
  'Create a localStorage wrapper utility with TypeScript types for saving, loading, and managing todo data. Include error handling for quota exceeded and JSON parsing errors.',
  'pending',
  'low',
  0.12,
  0.93,
  '["localStorage utility functions created with proper typing", "Error handling for storage operations implemented", "Unit tests for save/load/delete operations pass", "Data persistence verified across page refreshes"]'::jsonb,
  '["src/utils/localStorage.ts", "src/types/todo.ts"]'::jsonb,
  1200,
  '{"test": true, "project": "Todo App", "batch": "Phase 2 Validation", "depends_on": "WO-0"}'::jsonb
);

-- Work Order 2: Create Todo data model and state management (depends on WO-1)
INSERT INTO work_orders (
  title,
  description,
  status,
  risk_level,
  estimated_cost,
  pattern_confidence,
  acceptance_criteria,
  files_in_scope,
  context_budget_estimate,
  metadata
) VALUES (
  'Create Todo data model and state management',
  'Define TypeScript interfaces for Todo items, implement React state management (useState/useReducer) for todo list operations, and create hooks for managing todo state with localStorage integration.',
  'pending',
  'medium',
  0.15,
  0.88,
  '["Todo interface defined with id, text, completed properties", "Custom hook created for todo operations (add, toggle, delete)", "State updates trigger localStorage saves", "Initial state loads from localStorage on mount"]'::jsonb,
  '["src/types/todo.ts", "src/hooks/useTodos.ts"]'::jsonb,
  1500,
  '{"test": true, "project": "Todo App", "batch": "Phase 2 Validation", "depends_on": "WO-1"}'::jsonb
);

-- Return the created work order IDs
SELECT id, title, status FROM work_orders WHERE metadata->>'test' = 'true' ORDER BY created_at DESC LIMIT 3;
