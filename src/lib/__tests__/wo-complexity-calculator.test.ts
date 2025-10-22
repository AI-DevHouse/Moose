// src/lib/__tests__/wo-complexity-calculator.test.ts
import { describe, it, expect } from 'vitest';
import {
  assessWOScope,
  isHealthyWO,
  isOversizedWO,
  assessMultipleWOs,
  type WorkOrderInput
} from '../wo-complexity-calculator';

describe('wo-complexity-calculator', () => {
  describe('assessWOScope', () => {
    it('should assess a healthy WO with low complexity', () => {
      const wo: WorkOrderInput = {
        files_in_scope: ['file1.ts', 'file2.ts', 'file3.ts'],
        acceptance_criteria: ['criterion1', 'criterion2', 'criterion3'],
        metadata: {},
        context_budget_estimate: 1500,
        risk_level: 'low'
      };

      const result = assessWOScope(wo);

      expect(result.signal).toBe('healthy');
      expect(result.score).toBeLessThan(0.55);
      expect(result.factors.fileCount).toBe(3);
      expect(result.factors.criteriaCount).toBe(3);
      expect(result.factors.dependencyCount).toBe(0);
      expect(result.guidance).toContain('appropriate');
    });

    it('should assess a WO with medium complexity requiring review', () => {
      const wo: WorkOrderInput = {
        files_in_scope: ['f1.ts', 'f2.ts', 'f3.ts', 'f4.ts', 'f5.ts'],
        acceptance_criteria: ['c1', 'c2', 'c3', 'c4', 'c5', 'c6'],
        metadata: {
          dependencies: ['dep1', 'dep2']
        },
        context_budget_estimate: 2500,
        risk_level: 'medium'
      };

      const result = assessWOScope(wo);

      expect(result.signal).toBe('review_recommended');
      expect(result.score).toBeGreaterThanOrEqual(0.55);
      expect(result.score).toBeLessThan(0.70);
      expect(result.factors.fileCount).toBe(5);
      expect(result.factors.criteriaCount).toBe(6);
      expect(result.factors.dependencyCount).toBe(2);
      expect(result.guidance).toContain('simplifying');
    });

    it('should assess an oversized WO with high complexity', () => {
      const wo: WorkOrderInput = {
        files_in_scope: Array(12).fill('file.ts'), // 12 files
        acceptance_criteria: Array(11).fill('criterion'), // 11 criteria
        metadata: {
          dependencies: ['dep1', 'dep2', 'dep3', 'dep4']
        },
        context_budget_estimate: 4500,
        risk_level: 'high'
      };

      const result = assessWOScope(wo);

      expect(result.signal).toBe('likely_oversized');
      expect(result.score).toBeGreaterThanOrEqual(0.70);
      expect(result.factors.fileCount).toBe(12);
      expect(result.factors.criteriaCount).toBe(11);
      expect(result.factors.dependencyCount).toBe(4);
      expect(result.guidance).toContain('splitting');
    });

    it('should handle edge case: zero files', () => {
      const wo: WorkOrderInput = {
        files_in_scope: [],
        acceptance_criteria: ['c1', 'c2'],
        metadata: {},
        context_budget_estimate: 1000,
        risk_level: 'low'
      };

      const result = assessWOScope(wo);

      expect(result.factors.fileCount).toBe(0);
      expect(result.score).toBeLessThan(0.55); // Should still be healthy with low other factors
      expect(result.signal).toBe('healthy');
    });

    it('should handle edge case: null metadata', () => {
      const wo: WorkOrderInput = {
        files_in_scope: ['file1.ts', 'file2.ts'],
        acceptance_criteria: ['c1', 'c2'],
        metadata: null,
        context_budget_estimate: 1000,
        risk_level: 'low'
      };

      const result = assessWOScope(wo);

      expect(result.factors.dependencyCount).toBe(0);
      expect(result.score).toBeLessThan(0.55);
    });

    it('should handle edge case: null context_budget_estimate', () => {
      const wo: WorkOrderInput = {
        files_in_scope: ['file1.ts'],
        acceptance_criteria: ['c1'],
        metadata: {},
        context_budget_estimate: null,
        risk_level: 'low'
      };

      const result = assessWOScope(wo);

      expect(result.factors.estimatedTokens).toBe(1000); // Default value
    });

    it('should handle Json object format for files_in_scope', () => {
      const wo: WorkOrderInput = {
        files_in_scope: { length: 4 }, // Object with length property
        acceptance_criteria: ['c1', 'c2'],
        metadata: {},
        context_budget_estimate: 1000,
        risk_level: 'low'
      };

      const result = assessWOScope(wo);

      expect(result.factors.fileCount).toBe(4);
    });

    it('should handle alternative dependency field names', () => {
      const wo: WorkOrderInput = {
        files_in_scope: ['f1.ts'],
        acceptance_criteria: ['c1'],
        metadata: {
          dependency_ids: ['dep1', 'dep2', 'dep3']
        },
        context_budget_estimate: 1000,
        risk_level: 'low'
      };

      const result = assessWOScope(wo);

      expect(result.factors.dependencyCount).toBe(3);
    });

    it('should apply correct risk level multipliers', () => {
      const baseWO = {
        files_in_scope: ['f1.ts', 'f2.ts'],
        acceptance_criteria: ['c1', 'c2'],
        metadata: {},
        context_budget_estimate: 1000
      };

      const lowRisk = assessWOScope({ ...baseWO, risk_level: 'low' });
      const mediumRisk = assessWOScope({ ...baseWO, risk_level: 'medium' });
      const highRisk = assessWOScope({ ...baseWO, risk_level: 'high' });

      expect(lowRisk.factors.riskLevel).toBe(0.3);
      expect(mediumRisk.factors.riskLevel).toBe(0.6);
      expect(highRisk.factors.riskLevel).toBe(1.0);

      // Higher risk should result in higher score
      expect(highRisk.score).toBeGreaterThan(mediumRisk.score);
      expect(mediumRisk.score).toBeGreaterThan(lowRisk.score);
    });

    it('should round score to 2 decimal places', () => {
      const wo: WorkOrderInput = {
        files_in_scope: ['f1.ts'],
        acceptance_criteria: ['c1'],
        metadata: {},
        context_budget_estimate: 1000,
        risk_level: 'low'
      };

      const result = assessWOScope(wo);

      // Check that score has at most 2 decimal places
      expect(result.score.toString().split('.')[1]?.length || 0).toBeLessThanOrEqual(2);
    });
  });

  describe('isHealthyWO', () => {
    it('should return true for healthy WOs', () => {
      const wo: WorkOrderInput = {
        files_in_scope: ['f1.ts', 'f2.ts'],
        acceptance_criteria: ['c1', 'c2'],
        metadata: {},
        context_budget_estimate: 1000,
        risk_level: 'low'
      };

      expect(isHealthyWO(wo)).toBe(true);
    });

    it('should return false for oversized WOs', () => {
      const wo: WorkOrderInput = {
        files_in_scope: Array(12).fill('file.ts'),
        acceptance_criteria: Array(11).fill('c'),
        metadata: {},
        context_budget_estimate: 4500,
        risk_level: 'high'
      };

      expect(isHealthyWO(wo)).toBe(false);
    });
  });

  describe('isOversizedWO', () => {
    it('should return true for oversized WOs', () => {
      const wo: WorkOrderInput = {
        files_in_scope: Array(12).fill('file.ts'),
        acceptance_criteria: Array(11).fill('c'),
        metadata: {},
        context_budget_estimate: 4500,
        risk_level: 'high'
      };

      expect(isOversizedWO(wo)).toBe(true);
    });

    it('should return false for healthy WOs', () => {
      const wo: WorkOrderInput = {
        files_in_scope: ['f1.ts', 'f2.ts'],
        acceptance_criteria: ['c1', 'c2'],
        metadata: {},
        context_budget_estimate: 1000,
        risk_level: 'low'
      };

      expect(isOversizedWO(wo)).toBe(false);
    });
  });

  describe('assessMultipleWOs', () => {
    it('should assess multiple WOs in batch', () => {
      const wos: WorkOrderInput[] = [
        {
          files_in_scope: ['f1.ts'],
          acceptance_criteria: ['c1'],
          metadata: {},
          context_budget_estimate: 1000,
          risk_level: 'low'
        },
        {
          files_in_scope: Array(12).fill('f'),
          acceptance_criteria: Array(11).fill('c'),
          metadata: {},
          context_budget_estimate: 4500,
          risk_level: 'high'
        }
      ];

      const results = assessMultipleWOs(wos);

      expect(results).toHaveLength(2);
      expect(results[0].signal).toBe('healthy');
      expect(results[1].signal).toBe('likely_oversized');
    });
  });

  describe('threshold boundaries', () => {
    it('should correctly classify WO at healthy/review boundary (0.55)', () => {
      // Craft a WO that scores around 0.55
      const wo: WorkOrderInput = {
        files_in_scope: Array(3).fill('f'), // 3/6 * 0.35 = 0.175
        acceptance_criteria: Array(5).fill('c'), // 5/8 * 0.25 = 0.156
        metadata: { dependencies: ['d1', 'd2'] }, // 2/4 * 0.15 = 0.075
        context_budget_estimate: 2000, // 2000/4000 * 0.15 = 0.075
        risk_level: 'medium' // 0.6 * 0.10 = 0.06
      };
      // Total ≈ 0.541

      const result = assessWOScope(wo);

      expect(result.score).toBeLessThan(0.55);
      expect(result.signal).toBe('healthy');
    });

    it('should correctly classify WO at review/oversized boundary (0.70)', () => {
      // Craft a WO that scores around 0.70
      const wo: WorkOrderInput = {
        files_in_scope: Array(5).fill('f'), // 5/6 * 0.35 = 0.292
        acceptance_criteria: Array(7).fill('c'), // 7/8 * 0.25 = 0.219
        metadata: { dependencies: ['d1', 'd2', 'd3'] }, // 3/4 * 0.15 = 0.1125
        context_budget_estimate: 2500, // 2500/4000 * 0.15 = 0.094
        risk_level: 'low' // 0.3 * 0.10 = 0.03
      };
      // Total ≈ 0.748

      const result = assessWOScope(wo);

      expect(result.score).toBeGreaterThanOrEqual(0.70);
      expect(result.signal).toBe('likely_oversized');
    });
  });
});
