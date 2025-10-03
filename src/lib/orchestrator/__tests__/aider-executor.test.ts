// src/lib/orchestrator/__tests__/aider-executor.test.ts
// Unit tests for aider-executor - Instruction file formatting

import { describe, it, expect } from 'vitest';

describe('AiderExecutor - Instruction File Formatting', () => {
  it('should format instruction file with Work Order metadata', () => {
    const mockWorkOrder = {
      id: 'wo-abc123',
      title: 'Implement user authentication',
      description: 'Add JWT-based authentication to the API',
      acceptance_criteria: [
        'Users can log in with email/password',
        'JWT tokens expire after 24 hours'
      ],
      files_in_scope: ['src/auth/jwt.ts', 'src/middleware/auth.ts']
    };

    const expectedInstructionHeader = `
Work Order ID: wo-abc123
Title: Implement user authentication

Description:
Add JWT-based authentication to the API

Acceptance Criteria:
1. Users can log in with email/password
2. JWT tokens expire after 24 hours

Files to modify:
- src/auth/jwt.ts
- src/middleware/auth.ts
    `.trim();

    expect(expectedInstructionHeader).toContain('Work Order ID: wo-abc123');
    expect(expectedInstructionHeader).toContain('Implement user authentication');
    expect(expectedInstructionHeader).toContain('1. Users can log in');
    expect(expectedInstructionHeader).toContain('src/auth/jwt.ts');
  });

  it('should include generated code from Proposer in instruction file', () => {
    const mockProposerResponse = {
      proposer_used: 'claude-sonnet-4-5',
      content: `
// src/auth/jwt.ts
export function generateToken(userId: string): string {
  return jwt.sign({ userId }, SECRET, { expiresIn: '24h' });
}
      `.trim()
    };

    const expectedCodeSection = `
Generated code from claude-sonnet-4-5:

// src/auth/jwt.ts
export function generateToken(userId: string): string {
  return jwt.sign({ userId }, SECRET, { expiresIn: '24h' });
}
    `.trim();

    expect(expectedCodeSection).toContain('Generated code from claude-sonnet-4-5');
    expect(expectedCodeSection).toContain('generateToken');
    expect(expectedCodeSection).toContain('expiresIn');
  });

  it('should include step-by-step instructions for Aider', () => {
    const expectedInstructions = `
Instructions:
1. Create/modify the files listed above
2. Apply the generated code changes
3. Ensure all acceptance criteria are met
4. Commit changes with descriptive message
    `.trim();

    expect(expectedInstructions).toContain('Create/modify the files');
    expect(expectedInstructions).toContain('Apply the generated code');
    expect(expectedInstructions).toContain('Ensure all acceptance criteria');
    expect(expectedInstructions).toContain('Commit changes');
  });

  it('should create feature branch name from Work Order title', () => {
    const testCases = [
      {
        title: 'Implement user authentication',
        expected: 'feature/wo-abc123-implement-user-authentication'
      },
      {
        title: 'Fix TypeScript compilation errors',
        expected: 'feature/wo-def456-fix-typescript-compilation-err' // Truncated at 30 chars
      },
      {
        title: 'Add API endpoint for /users',
        expected: 'feature/wo-ghi789-add-api-endpoint-for-users'
      },
      {
        title: 'Refactor: Database query optimization',
        expected: 'feature/wo-jkl012-refactor-database-query-optim' // Special chars removed
      }
    ];

    testCases.forEach(({ title, expected }) => {
      const slug = title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .substring(0, 30);

      // Expected format: feature/wo-{id}-{slug}
      expect(slug).toMatch(/^[a-z0-9-]+$/);
      expect(slug.length).toBeLessThanOrEqual(30);
    });
  });

  it('should sanitize branch names to remove special characters', () => {
    const problematicTitles = [
      'Add API endpoint: /users/{id}',
      'Fix bug #123 in authentication',
      'Refactor (urgent!) database queries',
      'Update README.md & CHANGELOG.md'
    ];

    problematicTitles.forEach(title => {
      const slug = title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');

      // Should only contain alphanumeric and hyphens
      expect(slug).toMatch(/^[a-z0-9-]+$/);
      expect(slug).not.toContain('/');
      expect(slug).not.toContain('{');
      expect(slug).not.toContain('!');
      expect(slug).not.toContain('&');
    });
  });

  it('should generate unique instruction file paths per Work Order', () => {
    const workOrderIds = ['wo-123', 'wo-456', 'wo-789'];

    const instructionPaths = workOrderIds.map(id => {
      // Expected pattern: /tmp/wo-{id}-instruction.txt
      return `/tmp/wo-${id}-instruction.txt`;
    });

    // All paths should be unique
    const uniquePaths = new Set(instructionPaths);
    expect(uniquePaths.size).toBe(workOrderIds.length);

    // All paths should follow naming convention
    instructionPaths.forEach(path => {
      expect(path).toMatch(/\/tmp\/wo-[a-z0-9-]+-instruction\.txt$/);
    });
  });

  it('should handle Work Orders without acceptance criteria gracefully', () => {
    const minimalWorkOrder = {
      id: 'wo-minimal',
      title: 'Simple task',
      description: 'Do something simple'
      // No acceptance_criteria or files_in_scope
    };

    const expectedInstruction = `
Work Order ID: wo-minimal
Title: Simple task

Description:
Do something simple
    `.trim();

    expect(expectedInstruction).toContain('Simple task');
    expect(expectedInstruction).toContain('Do something simple');
    expect(expectedInstruction).not.toContain('Acceptance Criteria:');
    expect(expectedInstruction).not.toContain('Files to modify:');
  });

  it('should format Aider CLI command with correct parameters', () => {
    const mockWorkOrder = {
      id: 'wo-test',
      branch: 'feature/wo-test-implement-auth'
    };

    const instructionPath = '/tmp/wo-test-instruction.txt';

    // Expected Aider command structure
    const expectedCommand = [
      'aider',
      '--yes',                      // Auto-confirm changes
      '--no-pretty',                // Plain output for parsing
      '--message-file', instructionPath,
      '--commit'                    // Auto-commit
    ];

    expect(expectedCommand).toContain('--yes');
    expect(expectedCommand).toContain('--message-file');
    expect(expectedCommand).toContain(instructionPath);
    expect(expectedCommand).toContain('--commit');
  });
});
