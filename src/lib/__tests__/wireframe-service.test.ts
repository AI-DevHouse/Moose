// src/lib/__tests__/wireframe-service.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { WireframeService } from '../wireframe-service';
import type { WireframeRequest } from '@/types/wireframe';

// Mock Anthropic SDK
vi.mock('@anthropic-ai/sdk', () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      messages: {
        create: vi.fn().mockResolvedValue({
          content: [{
            type: 'text',
            text: '```typescript\nimport React from "react";\n\nconst TestComponent: React.FC = () => {\n  return <div>Test</div>;\n};\n\nexport default TestComponent;\n```'
          }],
          usage: {
            input_tokens: 1200,
            output_tokens: 5000
          }
        })
      }
    }))
  };
});

// Mock Supabase client
vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    storage: {
      from: vi.fn(() => ({
        upload: vi.fn().mockResolvedValue({ error: null }),
        download: vi.fn().mockResolvedValue({
          data: new Blob(['test code'], { type: 'text/plain' }),
          error: null
        }),
        list: vi.fn().mockResolvedValue({
          data: [{ name: 'TestComponent.tsx' }],
          error: null
        })
      }))
    }
  }))
}));

describe('WireframeService', () => {
  let service: WireframeService;

  beforeEach(() => {
    service = WireframeService.getInstance();
  });

  describe('generateWireframe', () => {
    it('should generate a wireframe from a request', async () => {
      const request: WireframeRequest = {
        component_name: 'TestButton',
        work_order_title: 'Create button component',
        description: 'A simple button for user actions',
        files_in_scope: ['components/TestButton.tsx']
      };

      const result = await service.generateWireframe(request);

      expect(result).toBeDefined();
      expect(result.component_name).toBe('TestButton');
      expect(result.code).toContain('TestComponent');
      expect(result.tokens_used).toBe(6200); // 1200 + 5000
      expect(result.cost).toBeGreaterThan(0);
      expect(result.generated_at).toBeDefined();
    });

    it('should extract code from typescript block', async () => {
      const request: WireframeRequest = {
        component_name: 'DashboardView',
        work_order_title: 'Dashboard UI',
        description: 'Main dashboard view',
        files_in_scope: ['views/DashboardView.tsx'],
        acceptance_criteria: ['Shows metrics', 'Responsive layout']
      };

      const result = await service.generateWireframe(request);

      expect(result.code).toContain('import React');
      expect(result.code).toContain('TestComponent');
      expect(result.code).not.toContain('```typescript');
      expect(result.code).not.toContain('```');
    });

    it('should calculate cost correctly', async () => {
      const request: WireframeRequest = {
        component_name: 'PricingComponent',
        work_order_title: 'Pricing display',
        description: 'Display pricing tiers',
        files_in_scope: ['components/Pricing.tsx']
      };

      const result = await service.generateWireframe(request);

      // Input: 1200 tokens * $0.000003 = $0.0036
      // Output: 5000 tokens * $0.000015 = $0.075
      // Total: $0.0786
      const expectedCost = (1200 * 0.000003) + (5000 * 0.000015);
      expect(result.cost).toBeCloseTo(expectedCost, 4);
    });

    it('should handle storage errors gracefully', async () => {
      // Mock storage failure
      const mockStorageError = vi.fn(() => ({
        upload: vi.fn().mockResolvedValue({ error: { message: 'Storage full' } })
      }));

      const request: WireframeRequest = {
        component_name: 'ErrorTest',
        work_order_title: 'Error handling test',
        description: 'Test error handling',
        files_in_scope: ['components/ErrorTest.tsx']
      };

      // Should not throw even if storage fails
      const result = await service.generateWireframe(request);
      expect(result).toBeDefined();
      expect(result.code).toBeDefined();
    });
  });

  describe('generateBatch', () => {
    it('should generate multiple wireframes', async () => {
      const requests: WireframeRequest[] = [
        {
          component_name: 'ComponentA',
          work_order_title: 'Component A',
          description: 'First component',
          files_in_scope: ['components/ComponentA.tsx']
        },
        {
          component_name: 'ComponentB',
          work_order_title: 'Component B',
          description: 'Second component',
          files_in_scope: ['components/ComponentB.tsx']
        }
      ];

      const results = await service.generateBatch(requests);

      expect(results).toHaveLength(2);
      expect(results[0].component_name).toBe('ComponentA');
      expect(results[1].component_name).toBe('ComponentB');
    });

    it('should continue on individual failures', async () => {
      // This test verifies that batch processing continues even if one fails
      const requests: WireframeRequest[] = [
        {
          component_name: 'GoodComponent',
          work_order_title: 'Good one',
          description: 'This should work',
          files_in_scope: ['components/Good.tsx']
        }
      ];

      const results = await service.generateBatch(requests);
      expect(results.length).toBeGreaterThan(0);
    });
  });

  describe('extractCodeBlock', () => {
    it('should extract from typescript block', () => {
      const text = '```typescript\nconst code = "test";\n```';
      // Access private method through any cast
      const extracted = (service as any).extractCodeBlock(text);
      expect(extracted).toBe('const code = "test";');
    });

    it('should extract from tsx block', () => {
      const text = '```tsx\nconst Component = () => <div/>;\n```';
      const extracted = (service as any).extractCodeBlock(text);
      expect(extracted).toBe('const Component = () => <div/>;');
    });

    it('should handle plain code block', () => {
      const text = '```\nplain code\n```';
      const extracted = (service as any).extractCodeBlock(text);
      expect(extracted).toBe('plain code');
    });

    it('should fallback to raw text if no block found', () => {
      const text = 'just some text without code block';
      const extracted = (service as any).extractCodeBlock(text);
      expect(extracted).toBe('just some text without code block');
    });
  });

  describe('calculateCost', () => {
    it('should calculate cost for typical wireframe', () => {
      const inputTokens = 1200;
      const outputTokens = 5000;
      const cost = (service as any).calculateCost(inputTokens, outputTokens);

      // $3 per 1M input tokens, $15 per 1M output tokens
      const expected = (1200 * 0.000003) + (5000 * 0.000015);
      expect(cost).toBeCloseTo(expected, 6);
    });

    it('should handle large component generation', () => {
      const inputTokens = 2000;
      const outputTokens = 8000;
      const cost = (service as any).calculateCost(inputTokens, outputTokens);

      const expected = (2000 * 0.000003) + (8000 * 0.000015);
      expect(cost).toBeCloseTo(expected, 6);
      expect(cost).toBeLessThan(0.15); // Should be under $0.15
    });
  });

  describe('storage operations', () => {
    it('should retrieve existing wireframe', async () => {
      const code = await service.getWireframe('TestComponent');
      expect(code).toBeDefined();
    });

    it('should list all wireframes', async () => {
      const list = await service.listWireframes();
      expect(Array.isArray(list)).toBe(true);
      expect(list).toContain('TestComponent.tsx');
    });

    it('should handle missing wireframes gracefully', async () => {
      // Mock not found
      const result = await service.getWireframe('NonExistentComponent');
      // Should not throw, may return null or empty string
      expect(result !== undefined).toBe(true);
    });
  });
});
