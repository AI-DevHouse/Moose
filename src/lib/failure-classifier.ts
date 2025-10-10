/**
 * Failure Classification System
 *
 * Purpose: Classify errors into structured categories for pattern analysis and learning.
 * Used by: Result tracking, error escalation, learning system
 *
 * Created: 2025-10-09 (Phase 2A - Learning System Foundation)
 */

// ============================================================================
// Types
// ============================================================================

/**
 * Failure classification categories matching database enum
 */
export type FailureClass =
  | 'compile_error'        // TypeScript/build errors
  | 'contract_violation'   // Breaking changes detected
  | 'test_fail'            // Tests failed
  | 'lint_error'           // Linting issues
  | 'orchestration_error'  // Aider/git/PR failures
  | 'budget_exceeded'      // Hit budget cap
  | 'dependency_missing'   // Blocked by dependencies
  | 'timeout'              // Execution timeout
  | 'unknown';             // Unclassified failure

/**
 * Structured error context for debugging and analysis
 */
export interface ErrorContext {
  error_message: string;
  error_type: string;           // Error.name (e.g., 'TypeError', 'SyntaxError')
  stack_trace?: string;
  failed_file?: string;         // File path where error occurred
  failed_line?: number;         // Line number where error occurred
  failed_tests?: string[];      // For test_fail: list of failed test names
  contract_violations?: Array<{ // For contract_violation
    type: 'breaking_change';
    file: string;
    description: string;
  }>;
  original_error?: string;      // JSON stringified error for fallback
}

/**
 * Classification result
 */
export interface ClassificationResult {
  failure_class: FailureClass;
  error_context: ErrorContext;
}

/**
 * Optional context to improve classification accuracy
 */
export interface ClassificationContext {
  component?: string;     // e.g., 'AiderExecutor', 'ProposerService'
  operation?: string;     // e.g., 'executeAider', 'generateCode'
  metadata?: any;         // Additional context (e.g., contract_validation results)
}

// ============================================================================
// Main Classification Function
// ============================================================================

/**
 * Classify an error into a structured failure category
 *
 * @param error - The error to classify
 * @param context - Optional context to improve classification accuracy
 * @returns Classification result with failure_class and error_context
 *
 * @example
 * ```ts
 * try {
 *   await runBuild();
 * } catch (error) {
 *   const { failure_class, error_context } = classifyError(error as Error, {
 *     component: 'BuildService',
 *     operation: 'runBuild'
 *   });
 *   // failure_class: 'compile_error'
 *   // error_context: { error_message: '...', failed_file: 'src/app.ts', ... }
 * }
 * ```
 */
export function classifyError(
  error: Error,
  context?: ClassificationContext
): ClassificationResult {
  const errorMessage = error.message.toLowerCase();
  const errorStack = error.stack || '';

  // Base error context
  const baseContext: ErrorContext = {
    error_message: error.message,
    error_type: error.name,
    stack_trace: errorStack
  };

  // ========================================
  // 1. Dependency Missing (check before compile errors)
  // ========================================
  // Note: Must come before compile_error check since "cannot find module"
  // can be mistaken for "cannot find name" (TypeScript error)
  if (
    errorMessage.includes('cannot find module') ||
    errorMessage.includes('module not found') ||
    errorMessage.includes('dependency') ||
    errorMessage.includes('blocked by') ||
    errorMessage.includes('waiting for') ||
    errorMessage.includes('prerequisite')
  ) {
    return {
      failure_class: 'dependency_missing',
      error_context: baseContext
    };
  }

  // ========================================
  // 2. TypeScript / Compile Errors
  // ========================================
  if (
    errorMessage.includes('typescript') ||
    errorMessage.includes('tsc') ||
    errorMessage.includes('type error') ||
    errorMessage.includes('cannot find name') ||
    errorMessage.includes('property') && errorMessage.includes('does not exist') ||
    errorMessage.includes('is not assignable to')
  ) {
    return {
      failure_class: 'compile_error',
      error_context: {
        ...baseContext,
        ...extractTypeScriptDetails(error)
      }
    };
  }

  // ========================================
  // 3. Contract Violations
  // ========================================
  if (
    context?.metadata?.contract_validation?.has_violations ||
    errorMessage.includes('contract violation') ||
    errorMessage.includes('breaking change')
  ) {
    return {
      failure_class: 'contract_violation',
      error_context: {
        ...baseContext,
        contract_violations: context?.metadata?.contract_validation?.violations || []
      }
    };
  }

  // ========================================
  // 4. Test Failures
  // ========================================
  if (
    errorMessage.includes('test') && (
      errorMessage.includes('fail') ||
      errorMessage.includes('expected') ||
      errorMessage.includes('assertion')
    ) ||
    errorMessage.includes('vitest') ||
    errorMessage.includes('jest') ||
    errorMessage.includes('spec failed')
  ) {
    return {
      failure_class: 'test_fail',
      error_context: {
        ...baseContext,
        failed_tests: extractFailedTests(error)
      }
    };
  }

  // ========================================
  // 5. Lint Errors
  // ========================================
  if (
    errorMessage.includes('eslint') ||
    errorMessage.includes('lint error') ||
    errorMessage.includes('prettier') ||
    (errorMessage.includes('error:') && (
      errorMessage.includes('unexpected var') ||
      errorMessage.includes('use let or const') ||
      errorMessage.includes('missing semicolon') ||
      errorMessage.includes('indentation')
    ))
  ) {
    return {
      failure_class: 'lint_error',
      error_context: baseContext
    };
  }

  // ========================================
  // 6. Orchestration Errors (Aider/Git/PR)
  // ========================================
  if (
    context?.component === 'AiderExecutor' ||
    context?.component === 'GitHubIntegration' ||
    errorMessage.includes('aider') ||
    errorMessage.includes('git') ||
    errorMessage.includes('github') ||
    errorMessage.includes('pull request') ||
    errorMessage.includes('branch') ||
    errorMessage.includes('spawn') ||
    errorMessage.includes('command failed') ||
    errorMessage.includes('fatal:') ||
    errorMessage.includes('repository') ||
    errorMessage.includes('unable to access')
  ) {
    return {
      failure_class: 'orchestration_error',
      error_context: baseContext
    };
  }

  // ========================================
  // 7. Budget Exceeded
  // ========================================
  if (
    errorMessage.includes('budget') ||
    errorMessage.includes('emergency_kill') ||
    errorMessage.includes('cost limit') ||
    errorMessage.includes('hard cap reached')
  ) {
    return {
      failure_class: 'budget_exceeded',
      error_context: baseContext
    };
  }

  // ========================================
  // 8. Timeout
  // ========================================
  if (
    errorMessage.includes('timeout') ||
    errorMessage.includes('timed out') ||
    errorMessage.includes('exceeded time limit')
  ) {
    return {
      failure_class: 'timeout',
      error_context: baseContext
    };
  }

  // ========================================
  // 9. Unknown (Fallback)
  // ========================================
  return {
    failure_class: 'unknown',
    error_context: {
      ...baseContext,
      original_error: JSON.stringify(error, Object.getOwnPropertyNames(error))
    }
  };
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Extract TypeScript error details (file, line number)
 *
 * Parses error messages like:
 * "src/app/page.tsx:42:5 - error TS2322: Type 'string' is not assignable..."
 */
function extractTypeScriptDetails(error: Error): Partial<ErrorContext> {
  const message = error.message;

  // Match pattern: file.ts:line:col - error TS####: message
  const match = message.match(/([^:]+):(\d+):(\d+)/);

  if (match) {
    return {
      failed_file: match[1],
      failed_line: parseInt(match[2], 10)
    };
  }

  // Alternative pattern: just file.ts:line
  const simpleMatch = message.match(/([^\s:]+\.(ts|tsx|js|jsx)):(\d+)/);
  if (simpleMatch) {
    return {
      failed_file: simpleMatch[1],
      failed_line: parseInt(simpleMatch[3], 10)
    };
  }

  return {};
}

/**
 * Extract failed test names from test framework output
 *
 * Supports:
 * - Vitest
 * - Jest
 * - Generic test output
 */
function extractFailedTests(error: Error): string[] {
  const lines = error.message.split('\n');
  const failedTests: string[] = [];

  for (const line of lines) {
    // Vitest format: "❯ test name"
    if (line.includes('❯') || line.includes('✗')) {
      const testMatch = line.match(/[❯✗]\s+(.+)/);
      if (testMatch) {
        failedTests.push(testMatch[1].trim());
      }
    }

    // Jest format: "● test name"
    if (line.includes('●')) {
      const testMatch = line.match(/●\s+(.+)/);
      if (testMatch) {
        failedTests.push(testMatch[1].trim());
      }
    }

    // Generic format: "FAIL test name" or "Failed: test name"
    if (line.match(/FAIL|Failed:/i)) {
      const testMatch = line.match(/(?:FAIL|Failed:)\s+(.+)/i);
      if (testMatch) {
        failedTests.push(testMatch[1].trim());
      }
    }

    // Look for quoted test names
    const quotedMatch = line.match(/['"]([^'"]+)['"]\s+(?:fail|error)/i);
    if (quotedMatch) {
      failedTests.push(quotedMatch[1]);
    }
  }

  return failedTests.length > 0 ? failedTests : [];
}

// ============================================================================
// Exports
// ============================================================================

export default classifyError;
