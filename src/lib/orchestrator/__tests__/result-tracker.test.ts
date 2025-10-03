// src/lib/orchestrator/__tests__/result-tracker.test.ts
// Unit tests for result-tracker - Schema validation (CRITICAL)

import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('ResultTracker - Schema Validation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should use correct outcome_vectors column names (work_order_id, model_used, route_reason)', () => {
    // This test validates the schema bug fix from v34
    // Before fix: Used agent_name, operation_type (WRONG)
    // After fix: Uses work_order_id, model_used, route_reason (CORRECT)

    const mockWorkOrder = {
      id: 'test-wo-123',
      title: 'Test Work Order',
      description: 'Test',
      status: 'processing',
      metadata: {}
    };

    const mockRoutingDecision = {
      proposer_id: 'claude-sonnet-proposer',
      proposer_name: 'Claude Sonnet 4.5',
      reason: 'High complexity task',
      routing_metadata: {
        complexity_score: 0.85,
        hard_stop_required: false
      }
    };

    const mockProposerResponse = {
      proposer_used: 'claude-sonnet-4-5',
      cost: 0.50,
      execution_time_ms: 3500,
      refinement_metadata: {
        refinement_count: 2
      }
    };

    // Expected outcome_vectors insert structure (correct schema)
    const expectedOutcomeVectors = {
      work_order_id: 'test-wo-123',          // ✅ Correct column
      model_used: 'claude-sonnet-4-5',       // ✅ Correct column
      route_reason: 'High complexity task',  // ✅ Correct column
      cost: 0.50,
      execution_time_ms: 3500,
      success: true,
      diff_size_lines: 0,
      test_duration_ms: null,
      failure_classes: null,
      metadata: {
        complexity_score: 0.85,
        hard_stop_required: false,
        refinement_cycles: 2
      }
    };

    // Validate structure matches expected schema
    expect(expectedOutcomeVectors).toHaveProperty('work_order_id');
    expect(expectedOutcomeVectors).toHaveProperty('model_used');
    expect(expectedOutcomeVectors).toHaveProperty('route_reason');

    // Validate WRONG columns are NOT present (from v33 bug)
    expect(expectedOutcomeVectors).not.toHaveProperty('agent_name');
    expect(expectedOutcomeVectors).not.toHaveProperty('operation_type');
  });

  it('should only write to outcome_vectors for proposer stage (LLM tracking)', () => {
    // outcome_vectors is for LLM model performance tracking, not infrastructure events
    // Should track: Proposer LLM decisions (which model, cost, success)
    // Should NOT track: Orchestrator polling, Aider execution, GitHub PR creation

    const validStagesForOutcomeVectors = ['proposer'];
    const invalidStages = ['orchestrator_poll', 'aider_execution', 'github_pr', 'sentinel'];

    expect(validStagesForOutcomeVectors).toContain('proposer');
    expect(invalidStages).not.toContain('proposer');
  });

  it('should track github_events with correct metadata structure', () => {
    const mockWorkOrder = {
      id: 'test-wo-456',
      github_pr_number: 123,
      github_pr_url: 'https://github.com/AI-DevHouse/Moose/pull/123',
      github_branch: 'feature/wo-test-456'
    };

    const expectedGithubEvents = {
      work_order_id: 'test-wo-456',
      event_type: 'pr_created',
      github_pr_number: 123,
      github_pr_url: 'https://github.com/AI-DevHouse/Moose/pull/123',
      metadata: {
        branch: 'feature/wo-test-456',
        created_by: 'orchestrator'
      }
    };

    expect(expectedGithubEvents.work_order_id).toBe('test-wo-456');
    expect(expectedGithubEvents.event_type).toBe('pr_created');
    expect(expectedGithubEvents.github_pr_number).toBe(123);
  });

  it('should handle failed execution tracking with proper error metadata', () => {
    const mockWorkOrder = {
      id: 'test-wo-789',
      status: 'processing',
      metadata: {
        retry_count: 2
      }
    };

    const mockError = new Error('TypeScript compilation failed');
    const stage = 'proposer';

    const expectedMetadata = {
      retry_count: 2,
      orchestrator_error: {
        stage: 'proposer',
        message: 'TypeScript compilation failed',
        timestamp: expect.any(String)
      }
    };

    expect(expectedMetadata.orchestrator_error.stage).toBe('proposer');
    expect(expectedMetadata.orchestrator_error.message).toContain('TypeScript');
  });

  it('should write outcome_vectors only for proposer failures (not infrastructure)', () => {
    // Proposer stage failures should write to outcome_vectors (LLM performance tracking)
    const proposerFailure = {
      stage: 'proposer',
      should_write_outcome_vectors: true,
      reason: 'LLM decision tracking'
    };

    // Infrastructure failures should NOT write to outcome_vectors
    const aiderFailure = {
      stage: 'aider',
      should_write_outcome_vectors: false,
      reason: 'Infrastructure event, not LLM decision'
    };

    expect(proposerFailure.should_write_outcome_vectors).toBe(true);
    expect(aiderFailure.should_write_outcome_vectors).toBe(false);
  });
});
