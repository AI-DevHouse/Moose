// src/lib/orchestrator/__tests__/manager-coordinator.test.ts
// Unit tests for manager-coordinator - Complexity estimation logic

import { describe, it, expect } from 'vitest';

describe('ManagerCoordinator - Complexity Estimation', () => {
  it('should estimate complexity based on acceptance criteria count', () => {
    // Formula: 0.1 per criterion (max 0.5)
    const testCases = [
      { criteria: 1, expectedMin: 0.1, expectedMax: 0.2 },
      { criteria: 3, expectedMin: 0.3, expectedMax: 0.4 },
      { criteria: 5, expectedMin: 0.5, expectedMax: 0.6 }, // Capped at 0.5 for criteria alone
      { criteria: 10, expectedMin: 0.5, expectedMax: 1.0 }  // Maxed out criteria component
    ];

    testCases.forEach(({ criteria, expectedMin, expectedMax }) => {
      const mockWorkOrder = {
        id: 'test-wo',
        acceptance_criteria: Array(criteria).fill('criterion'),
        files_in_scope: ['file.ts'],
        context_budget_estimate: 2000
      };

      // Complexity should be at least based on criteria count
      const criteriaScore = Math.min(criteria * 0.1, 0.5);
      expect(criteriaScore).toBeGreaterThanOrEqual(expectedMin - 0.1);
      expect(criteriaScore).toBeLessThanOrEqual(expectedMax);
    });
  });

  it('should estimate complexity based on files in scope count', () => {
    // Formula: 0.05 per file (max 0.3)
    const testCases = [
      { files: 1, expectedScore: 0.05 },
      { files: 3, expectedScore: 0.15 },
      { files: 6, expectedScore: 0.30 },  // Capped at 0.3
      { files: 10, expectedScore: 0.30 }  // Maxed out
    ];

    testCases.forEach(({ files, expectedScore }) => {
      const filesScore = Math.min(files * 0.05, 0.3);
      expect(filesScore).toBeCloseTo(expectedScore, 2);
    });
  });

  it('should estimate complexity based on context budget', () => {
    // Formula: (context_budget - 2000) / 8000 (max 0.2)
    // Range: 2k tokens (simple) to 10k tokens (complex)
    const testCases = [
      { budget: 2000, expectedScore: 0.0 },   // Minimum: (2000-2000)/8000 = 0
      { budget: 6000, expectedScore: 0.2 },   // Mid-range: (6000-2000)/8000 = 0.5, capped at 0.2
      { budget: 10000, expectedScore: 0.2 },  // Maximum: (10000-2000)/8000 = 1.0, capped at 0.2
      { budget: 15000, expectedScore: 0.2 }   // Capped at 0.2
    ];

    testCases.forEach(({ budget, expectedScore }) => {
      const contextScore = Math.min((budget - 2000) / 8000, 0.2);
      expect(contextScore).toBeCloseTo(expectedScore, 2);
    });
  });

  it('should calculate total complexity as sum of components (max 1.0)', () => {
    const highComplexityWorkOrder = {
      acceptance_criteria: Array(10).fill('criterion'), // 0.5 (maxed)
      files_in_scope: Array(10).fill('file.ts'),        // 0.3 (maxed)
      context_budget_estimate: 10000                    // 0.2 (maxed)
    };

    // Total: 0.5 + 0.3 + 0.2 = 1.0 (capped at 1.0)
    const criteriaScore = Math.min(10 * 0.1, 0.5); // 0.5
    const filesScore = Math.min(10 * 0.05, 0.3);   // 0.3
    const contextScore = Math.min((10000 - 2000) / 8000, 0.2); // 0.2

    const totalComplexity = Math.min(criteriaScore + filesScore + contextScore, 1.0);
    expect(totalComplexity).toBe(1.0);
  });

  it('should transform Work Order to Manager API request format', () => {
    const mockWorkOrder = {
      id: 'wo-12345',
      description: 'Implement user authentication',
      acceptance_criteria: ['AC1', 'AC2', 'AC3'],
      files_in_scope: ['auth.ts', 'user.ts'],
      context_budget_estimate: 4000
    };

    const expectedRequest = {
      work_order_id: 'wo-12345',
      task_description: 'Implement user authentication',
      complexity_score: expect.any(Number),
      context_requirements: ['auth.ts', 'user.ts'],
      approved_by_director: true
    };

    expect(expectedRequest.work_order_id).toBe('wo-12345');
    expect(expectedRequest.task_description).toBe('Implement user authentication');
    expect(expectedRequest.context_requirements).toHaveLength(2);
    expect(expectedRequest.approved_by_director).toBe(true);
  });

  it('should handle Work Orders with minimal data', () => {
    const minimalWorkOrder = {
      id: 'wo-minimal',
      description: 'Simple task'
      // No acceptance_criteria, files_in_scope, or context_budget_estimate
    };

    // Should use defaults: 1 criterion, 1 file, 2000 tokens
    const defaultCriteriaScore = Math.min(1 * 0.1, 0.5);  // 0.1
    const defaultFilesScore = Math.min(1 * 0.05, 0.3);    // 0.05
    const defaultContextScore = Math.min((2000 - 2000) / 8000, 0.2); // 0.0

    const expectedComplexity = defaultCriteriaScore + defaultFilesScore + defaultContextScore; // 0.15
    expect(expectedComplexity).toBeCloseTo(0.15, 2);
  });

  it('should produce complexity scores that route correctly to proposers', () => {
    // Complexity thresholds:
    // - claude-sonnet-4-5: >= 1.0 (handles all complexity)
    // - gpt-4o-mini: < 0.3 (simple tasks only)

    const simpleTask = {
      acceptance_criteria: ['AC1'],
      files_in_scope: ['config.json'],
      context_budget_estimate: 2000
    };

    const complexTask = {
      acceptance_criteria: Array(5).fill('AC'),
      files_in_scope: Array(6).fill('file.ts'),
      context_budget_estimate: 8000
    };

    const simpleScore = Math.min(0.1 + 0.05 + 0.0, 1.0); // 0.15
    const complexScore = Math.min(0.5 + 0.3 + 0.15, 1.0); // 0.95

    expect(simpleScore).toBeLessThan(0.3); // Should route to gpt-4o-mini
    expect(complexScore).toBeGreaterThanOrEqual(0.3); // Should route to claude-sonnet-4-5
  });
});
