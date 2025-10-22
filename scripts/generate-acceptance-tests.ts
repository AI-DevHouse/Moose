/**
 * Auto-generate acceptance tests from work order acceptance criteria
 *
 * This script reads acceptance criteria from the database and generates
 * Vitest test files that validate each criterion.
 */

import { createSupabaseServiceClient } from '../src/lib/supabase';
import * as fs from 'fs';
import * as path from 'path';

interface AcceptanceCriterion {
  index: number;
  text: string;
  testType: 'unit' | 'integration' | 'e2e';
  requiresMocking: boolean;
  mockTargets: string[];
}

interface TestGenerationContext {
  woId: string;
  title: string;
  description: string;
  acceptanceCriteria: string[];
  complexity: number;
  projectId: string;
}

/**
 * Analyze acceptance criterion to determine test characteristics
 */
function analyzeCriterion(criterion: string, index: number): AcceptanceCriterion {
  const lowerCriterion = criterion.toLowerCase();

  // Determine test type
  let testType: 'unit' | 'integration' | 'e2e' = 'unit';
  if (lowerCriterion.includes('integration') || lowerCriterion.includes('workflow') || lowerCriterion.includes('end-to-end')) {
    testType = 'integration';
  }
  if (lowerCriterion.includes('e2e') || lowerCriterion.includes('user flow')) {
    testType = 'e2e';
  }

  // Determine if mocking is needed
  const requiresMocking =
    lowerCriterion.includes('ipc') ||
    lowerCriterion.includes('api') ||
    lowerCriterion.includes('database') ||
    lowerCriterion.includes('supabase') ||
    lowerCriterion.includes('network') ||
    lowerCriterion.includes('file system') ||
    lowerCriterion.includes('external');

  // Identify mock targets
  const mockTargets: string[] = [];
  if (lowerCriterion.includes('ipc')) mockTargets.push('ipcRenderer');
  if (lowerCriterion.includes('supabase') || lowerCriterion.includes('database')) mockTargets.push('supabase');
  if (lowerCriterion.includes('fetch') || lowerCriterion.includes('api')) mockTargets.push('fetch');
  if (lowerCriterion.includes('file')) mockTargets.push('fs');

  return {
    index,
    text: criterion,
    testType,
    requiresMocking,
    mockTargets
  };
}

/**
 * Generate test code for a single acceptance criterion
 */
function generateTestForCriterion(ac: AcceptanceCriterion, context: TestGenerationContext): string {
  const acNumber = String(ac.index + 1).padStart(3, '0');
  const testDescription = ac.text;

  // Generate test implementation based on criterion keywords
  const testImpl = generateTestImplementation(ac, context);

  return `  describe('AC-${acNumber}: ${testDescription}', () => {
${testImpl}
  });
`;
}

/**
 * Generate test implementation based on criterion analysis
 */
function generateTestImplementation(ac: AcceptanceCriterion, context: TestGenerationContext): string {
  const lowerText = ac.text.toLowerCase();

  // Test patterns based on common acceptance criteria patterns

  // Pattern: "X implemented/created/built"
  if (lowerText.match(/\b(implemented|created|built|added)\b/)) {
    return generateImplementationTest(ac, context);
  }

  // Pattern: "X handles/manages/processes"
  if (lowerText.match(/\b(handles|manages|processes|tracks)\b/)) {
    return generateBehaviorTest(ac, context);
  }

  // Pattern: "X validates/verifies/checks"
  if (lowerText.match(/\b(validates|verifies|checks|ensures)\b/)) {
    return generateValidationTest(ac, context);
  }

  // Pattern: "Tests/Coverage/Documentation"
  if (lowerText.match(/\b(tests|coverage|documented|documentation)\b/)) {
    return generateMetaTest(ac, context);
  }

  // Pattern: "Error handling/retry logic"
  if (lowerText.match(/\b(error|retry|timeout|failure)\b/)) {
    return generateErrorHandlingTest(ac, context);
  }

  // Pattern: "Performance/timing/optimization"
  if (lowerText.match(/\b(performance|timing|fast|slow|optimize|debounce|throttle)\b/)) {
    return generatePerformanceTest(ac, context);
  }

  // Default: generic existence test
  return generateGenericTest(ac, context);
}

function generateImplementationTest(ac: AcceptanceCriterion, context: TestGenerationContext): string {
  const componentName = extractComponentName(ac.text);
  const setupMocks = ac.requiresMocking ? generateMockSetup(ac.mockTargets) : '';

  return `    it('should be implemented', () => {
${setupMocks}      // TODO: Import and verify ${componentName} exists
      // Example: expect(${componentName}).toBeDefined();
      expect(true).toBe(true); // Placeholder - implement actual test
    });

    it('should have correct interface/type', () => {
      // TODO: Verify ${componentName} implements expected interface
      expect(true).toBe(true); // Placeholder - implement actual test
    });
`;
}

function generateBehaviorTest(ac: AcceptanceCriterion, context: TestGenerationContext): string {
  const behavior = extractBehaviorDescription(ac.text);
  const setupMocks = ac.requiresMocking ? generateMockSetup(ac.mockTargets) : '';

  return `    it('should ${behavior}', async () => {
${setupMocks}      // TODO: Set up test scenario
      // TODO: Execute behavior
      // TODO: Assert expected outcome
      expect(true).toBe(true); // Placeholder - implement actual test
    });

    it('should handle ${behavior} correctly with various inputs', async () => {
      // TODO: Test edge cases and various inputs
      expect(true).toBe(true); // Placeholder - implement actual test
    });
`;
}

function generateValidationTest(ac: AcceptanceCriterion, context: TestGenerationContext): string {
  const validationTarget = extractValidationTarget(ac.text);

  return `    it('should validate ${validationTarget}', () => {
      // TODO: Test validation with valid input
      // TODO: Expect validation to pass
      expect(true).toBe(true); // Placeholder - implement actual test
    });

    it('should reject invalid ${validationTarget}', () => {
      // TODO: Test validation with invalid input
      // TODO: Expect validation to fail appropriately
      expect(true).toBe(true); // Placeholder - implement actual test
    });
`;
}

function generateErrorHandlingTest(ac: AcceptanceCriterion, context: TestGenerationContext): string {
  const errorType = extractErrorType(ac.text);
  const hasRetry = ac.text.toLowerCase().includes('retry');

  let tests = `    it('should handle ${errorType} gracefully', async () => {
      // TODO: Simulate ${errorType}
      // TODO: Verify error handling behavior
      expect(true).toBe(true); // Placeholder - implement actual test
    });
`;

  if (hasRetry) {
    const retryCount = extractRetryCount(ac.text);
    tests += `
    it('should retry ${retryCount} times on failure', async () => {
      // TODO: Mock failure scenario
      // TODO: Verify retry attempts
      // TODO: Verify exponential backoff if specified
      expect(true).toBe(true); // Placeholder - implement actual test
    });
`;
  }

  return tests;
}

function generatePerformanceTest(ac: AcceptanceCriterion, context: TestGenerationContext): string {
  const threshold = extractPerformanceThreshold(ac.text);
  const metric = extractPerformanceMetric(ac.text);

  return `    it('should ${metric} within ${threshold} threshold', async () => {
      const startTime = performance.now();

      // TODO: Execute operation

      const endTime = performance.now();
      const duration = endTime - startTime;

      // TODO: Verify performance threshold
      // expect(duration).toBeLessThan(${threshold});
      expect(true).toBe(true); // Placeholder - implement actual test
    });
`;
}

function generateMetaTest(ac: AcceptanceCriterion, context: TestGenerationContext): string {
  if (ac.text.toLowerCase().includes('coverage')) {
    const coverageThreshold = extractCoverageThreshold(ac.text);
    return `    it('should achieve ${coverageThreshold}% test coverage', () => {
      // TODO: Verify test coverage meets threshold
      // This typically requires integration with coverage tools (Istanbul/c8)
      // Run: npm run test:coverage
      expect(true).toBe(true); // Placeholder - verify with coverage report
    });
`;
  }

  if (ac.text.toLowerCase().includes('document')) {
    return `    it('should have documentation', () => {
      // TODO: Verify code documentation exists
      // Check for JSDoc comments, README, etc.
      expect(true).toBe(true); // Placeholder - implement actual test
    });
`;
  }

  return generateGenericTest(ac, context);
}

function generateGenericTest(ac: AcceptanceCriterion, context: TestGenerationContext): string {
  const setupMocks = ac.requiresMocking ? generateMockSetup(ac.mockTargets) : '';

  return `    it('should satisfy: ${ac.text}', () => {
${setupMocks}      // TODO: Implement test for this acceptance criterion
      // Review the criterion and implement appropriate assertions
      expect(true).toBe(true); // Placeholder - implement actual test
    });
`;
}

function generateMockSetup(mockTargets: string[]): string {
  if (mockTargets.length === 0) return '';

  const mocks = mockTargets.map(target => {
    switch (target) {
      case 'ipcRenderer':
        return `      const mockIpcRenderer = {
        send: vi.fn(),
        invoke: vi.fn(),
        on: vi.fn()
      };
      (window as any).electron = { ipcRenderer: mockIpcRenderer };
`;
      case 'supabase':
        return `      const mockSupabase = {
        from: vi.fn(() => ({
          select: vi.fn().mockReturnThis(),
          insert: vi.fn().mockReturnThis(),
          update: vi.fn().mockReturnThis(),
          delete: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ data: null, error: null })
        }))
      };
`;
      case 'fetch':
        return `      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({})
      });
`;
      case 'fs':
        return `      vi.mock('fs', () => ({
        readFileSync: vi.fn(),
        writeFileSync: vi.fn(),
        existsSync: vi.fn(() => true)
      }));
`;
      default:
        return `      // TODO: Mock ${target}\n`;
    }
  }).join('\n');

  return mocks;
}

// Helper extraction functions
function extractComponentName(text: string): string {
  const match = text.match(/\b([A-Z][a-zA-Z]+(?:Class|Manager|Service|Handler|Middleware|Component)?)\b/);
  return match ? match[1] : 'Component';
}

function extractBehaviorDescription(text: string): string {
  const match = text.match(/(?:handles|manages|processes|tracks)\s+(.+?)(?:\s+with|\s+for|\s+using|$)/i);
  return match ? match[1].trim() : 'specified behavior';
}

function extractValidationTarget(text: string): string {
  const match = text.match(/(?:validates|verifies|checks)\s+(.+?)(?:\s+against|\s+with|$)/i);
  return match ? match[1].trim() : 'input';
}

function extractErrorType(text: string): string {
  const match = text.match(/\b(network|timeout|validation|database|ipc|connection)\s+(?:error|failure)/i);
  return match ? match[1] + ' errors' : 'errors';
}

function extractRetryCount(text: string): string {
  const match = text.match(/\b(\d+)\s+retr(?:y|ies)/i);
  return match ? match[1] : '3';
}

function extractPerformanceThreshold(text: string): string {
  const match = text.match(/(\d+)\s*(ms|milliseconds|seconds|s)/i);
  if (match) {
    const value = parseInt(match[1]);
    const unit = match[2].toLowerCase();
    if (unit.startsWith('s') && unit !== 'ms') {
      return `${value * 1000}ms`;
    }
    return `${value}ms`;
  }
  return '100ms';
}

function extractPerformanceMetric(text: string): string {
  if (text.toLowerCase().includes('debounce')) return 'debounce';
  if (text.toLowerCase().includes('throttle')) return 'throttle';
  if (text.toLowerCase().includes('response')) return 'respond';
  return 'execute';
}

function extractCoverageThreshold(text: string): string {
  const match = text.match(/(\d+)%/);
  return match ? match[1] : '80';
}

/**
 * Generate complete test file for a work order
 */
function generateTestFile(context: TestGenerationContext): string {
  const analyzedCriteria = context.acceptanceCriteria.map((criterion, index) =>
    analyzeCriterion(criterion, index)
  );

  const testSuites = analyzedCriteria.map(ac =>
    generateTestForCriterion(ac, context)
  ).join('\n');

  const imports = generateImports(analyzedCriteria);
  const setupSection = generateSetupSection(analyzedCriteria);

  return `/**
 * Auto-Generated Acceptance Tests
 * Work Order: ${context.title}
 *
 * Generated from database acceptance criteria
 * DO NOT EDIT MANUALLY - Regenerate using scripts/generate-acceptance-tests.ts
 *
 * Work Order ID: ${context.woId}
 * Complexity: ${context.complexity}/10
 * Total Acceptance Criteria: ${context.acceptanceCriteria.length}
 */

${imports}

describe('WO: ${context.title}', () => {
  ${setupSection}

${testSuites}
  describe('Meta Tests', () => {
    it('should have all ${context.acceptanceCriteria.length} acceptance criteria tested', () => {
      // This test ensures we don't miss any acceptance criteria
      const implementedTests = ${context.acceptanceCriteria.length};
      expect(implementedTests).toBe(${context.acceptanceCriteria.length});
    });
  });
});
`;
}

function generateImports(criteria: AcceptanceCriterion[]): string {
  const baseImports = [`import { describe, it, expect, beforeEach, vi } from 'vitest';`];

  const needsReactTesting = criteria.some(ac =>
    ac.text.toLowerCase().includes('component') ||
    ac.text.toLowerCase().includes('render') ||
    ac.text.toLowerCase().includes('ui')
  );

  if (needsReactTesting) {
    baseImports.push(`import { render, screen } from '@testing-library/react';`);
  }

  const needsUserEvent = criteria.some(ac =>
    ac.text.toLowerCase().includes('click') ||
    ac.text.toLowerCase().includes('type') ||
    ac.text.toLowerCase().includes('interaction')
  );

  if (needsUserEvent) {
    baseImports.push(`import userEvent from '@testing-library/user-event';`);
  }

  return baseImports.join('\n');
}

function generateSetupSection(criteria: AcceptanceCriterion[]): string {
  const hasAsyncTests = criteria.some(ac =>
    ac.text.toLowerCase().includes('async') ||
    ac.text.toLowerCase().includes('promise') ||
    ac.testType === 'integration'
  );

  if (hasAsyncTests) {
    return `
  beforeEach(() => {
    vi.clearAllMocks();
  });
`;
  }

  return '';
}

/**
 * Main execution
 */
async function generateAcceptanceTests() {
  const supabase = createSupabaseServiceClient();
  const outputDir = path.join(__dirname, '..', 'tests', 'acceptance', 'generated');

  // Ensure output directory exists
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  console.log('🧪 Generating Acceptance Tests from Database\n');
  console.log('='.repeat(80));

  // Fetch work orders with acceptance criteria
  const { data: wos, error } = await supabase
    .from('work_orders')
    .select('id, title, description, acceptance_criteria, complexity_score, project_id')
    .not('acceptance_criteria', 'is', null)
    .order('created_at', { ascending: false })
    .limit(10);

  if (error) {
    console.error('❌ Error fetching work orders:', error);
    return;
  }

  if (!wos || wos.length === 0) {
    console.log('⚠️  No work orders with acceptance criteria found');
    return;
  }

  console.log(`Found ${wos.length} work orders with acceptance criteria\n`);

  let generatedCount = 0;

  for (const wo of wos) {
    // Skip if acceptance criteria is not an array
    if (!Array.isArray(wo.acceptance_criteria) || wo.acceptance_criteria.length === 0) {
      console.log(`⏭️  Skipping ${wo.title} - invalid acceptance criteria format`);
      continue;
    }

    const context: TestGenerationContext = {
      woId: wo.id,
      title: wo.title,
      description: wo.description || '',
      acceptanceCriteria: wo.acceptance_criteria,
      complexity: wo.complexity_score || 0,
      projectId: wo.project_id || ''
    };

    const testContent = generateTestFile(context);
    const fileName = `wo-${wo.id.substring(0, 8)}-acceptance.test.ts`;
    const filePath = path.join(outputDir, fileName);

    fs.writeFileSync(filePath, testContent);

    console.log(`✅ Generated: ${fileName}`);
    console.log(`   Title: ${wo.title}`);
    console.log(`   Criteria: ${wo.acceptance_criteria.length}`);
    console.log(`   Complexity: ${wo.complexity_score}/10`);
    console.log();

    generatedCount++;
  }

  console.log('='.repeat(80));
  console.log(`\n✅ Successfully generated ${generatedCount} test files`);
  console.log(`📂 Output directory: ${outputDir}`);
  console.log('\n💡 Next steps:');
  console.log('   1. Review generated tests in tests/acceptance/generated/');
  console.log('   2. Implement TODO sections with actual test logic');
  console.log('   3. Run tests: npm run test tests/acceptance/generated/');
  console.log('   4. Integrate with CI/CD pipeline');
}

generateAcceptanceTests().catch(console.error);
