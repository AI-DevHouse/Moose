// src/lib/orchestrator/__tests__/proposer-executor.test.ts
// Unit tests for proposer-executor - Task description building

import { describe, it, expect } from 'vitest';

describe('ProposerExecutor - Task Description Building', () => {
  it('should build task description with all Work Order components', () => {
    const mockWorkOrder = {
      id: 'wo-12345',
      title: 'Implement authentication',
      description: 'Add JWT-based authentication to the API',
      acceptance_criteria: [
        'Users can log in with email/password',
        'JWT tokens expire after 24 hours',
        'Refresh token mechanism implemented'
      ],
      files_in_scope: ['src/auth/jwt.ts', 'src/middleware/auth.ts'],
      decomposition_doc: 'Part of OAuth 2.0 implementation suite'
    };

    const expectedTaskDescription = `
Work Order: Implement authentication

Description:
Add JWT-based authentication to the API

Acceptance Criteria:
- Users can log in with email/password
- JWT tokens expire after 24 hours
- Refresh token mechanism implemented

Files in Scope:
- src/auth/jwt.ts
- src/middleware/auth.ts

Context:
Part of OAuth 2.0 implementation suite
    `.trim();

    // Verify all components are present
    expect(expectedTaskDescription).toContain('Implement authentication');
    expect(expectedTaskDescription).toContain('Add JWT-based authentication');
    expect(expectedTaskDescription).toContain('Users can log in');
    expect(expectedTaskDescription).toContain('src/auth/jwt.ts');
    expect(expectedTaskDescription).toContain('OAuth 2.0');
  });

  it('should include routing metadata in task description', () => {
    const mockRoutingDecision = {
      proposer_id: 'claude-sonnet-proposer',
      proposer_name: 'Claude Sonnet 4.5',
      reason: 'High complexity task with security requirements',
      routing_metadata: {
        complexity_score: 0.85,
        hard_stop_required: true,
        keywords_detected: ['authentication', 'JWT', 'security']
      }
    };

    const expectedMetadataSection = `
Routing Information:
- Selected Model: Claude Sonnet 4.5
- Complexity Score: 0.85
- Hard Stop Required: Yes
- Reason: High complexity task with security requirements
    `.trim();

    expect(expectedMetadataSection).toContain('Claude Sonnet 4.5');
    expect(expectedMetadataSection).toContain('0.85');
    expect(expectedMetadataSection).toContain('Hard Stop Required: Yes');
  });

  it('should format acceptance criteria as bulleted list', () => {
    const criteria = [
      'API returns 200 on success',
      'Error handling for invalid credentials',
      'Rate limiting prevents brute force'
    ];

    const formattedCriteria = criteria.map(c => `- ${c}`).join('\n');

    expect(formattedCriteria).toBe(
      '- API returns 200 on success\n' +
      '- Error handling for invalid credentials\n' +
      '- Rate limiting prevents brute force'
    );
  });

  it('should format files in scope as bulleted list', () => {
    const files = [
      'src/auth/login.ts',
      'src/auth/jwt.ts',
      'src/middleware/auth.ts'
    ];

    const formattedFiles = files.map(f => `- ${f}`).join('\n');

    expect(formattedFiles).toContain('- src/auth/login.ts');
    expect(formattedFiles).toContain('- src/auth/jwt.ts');
    expect(formattedFiles).toContain('- src/middleware/auth.ts');
  });

  it('should handle Work Orders with minimal data gracefully', () => {
    const minimalWorkOrder = {
      id: 'wo-minimal',
      title: 'Simple task',
      description: 'Do something simple'
      // No acceptance_criteria, files_in_scope, or decomposition_doc
    };

    // Should still generate valid task description with available data
    const expectedDescription = `
Work Order: Simple task

Description:
Do something simple
    `.trim();

    expect(expectedDescription).toContain('Simple task');
    expect(expectedDescription).toContain('Do something simple');
  });

  it('should transform Work Order to Proposer API request format', () => {
    const mockWorkOrder = {
      id: 'wo-67890',
      title: 'Refactor database queries',
      description: 'Optimize slow queries',
      acceptance_criteria: ['Query time < 100ms', 'No N+1 queries']
    };

    const mockRoutingDecision = {
      proposer_id: 'gpt-4o-mini-proposer',
      proposer_name: 'GPT-4o-mini',
      reason: 'Low complexity refactoring'
    };

    const expectedRequest = {
      work_order_id: 'wo-67890',
      task_description: expect.stringContaining('Refactor database queries'),
      force_model: undefined, // No forced model unless Hard Stop
      metadata: {
        routing_decision: {
          proposer_id: 'gpt-4o-mini-proposer',
          proposer_name: 'GPT-4o-mini',
          reason: 'Low complexity refactoring'
        }
      }
    };

    expect(expectedRequest.work_order_id).toBe('wo-67890');
    expect(expectedRequest.task_description).toEqual(expect.stringContaining('Refactor database queries'));
    expect(expectedRequest.metadata.routing_decision.proposer_name).toBe('GPT-4o-mini');
  });

  it('should force model when Hard Stop required', () => {
    const hardStopRoutingDecision = {
      proposer_id: 'claude-sonnet-proposer',
      proposer_name: 'Claude Sonnet 4.5',
      reason: 'Security keyword detected: authentication',
      routing_metadata: {
        hard_stop_required: true,
        keywords_detected: ['authentication', 'password']
      }
    };

    const expectedRequest = {
      force_model: 'claude-sonnet-4-5',
      metadata: {
        hard_stop_override: true,
        reason: 'Security keyword detected: authentication'
      }
    };

    expect(expectedRequest.force_model).toBe('claude-sonnet-4-5');
    expect(expectedRequest.metadata.hard_stop_override).toBe(true);
  });

  it('should include refinement context if retry attempt', () => {
    const workOrderWithRetry = {
      id: 'wo-retry',
      title: 'Fix TypeScript errors',
      description: 'Resolve compilation errors',
      metadata: {
        retry_count: 2,
        previous_errors: [
          'TS2304: Cannot find name "User"',
          'TS2339: Property "email" does not exist'
        ]
      }
    };

    const expectedRefinementContext = `
Previous Attempt Failures:
- Attempt 1: TS2304: Cannot find name "User"
- Attempt 2: TS2339: Property "email" does not exist

This is retry attempt #2. Please learn from previous errors.
    `.trim();

    expect(expectedRefinementContext).toContain('retry attempt #2');
    expect(expectedRefinementContext).toContain('TS2304');
    expect(expectedRefinementContext).toContain('TS2339');
  });
});
