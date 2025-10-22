// Phase 2: Iteration Scoring System
// Implements 5-dimension quality rubrics (1-10 scale) for evaluating generated code
// Reference: TECHNICAL_PLAN_Learning_System.md lines 1785-1878

export interface ScoringRubrics {
  architecture: RubricCriteria;
  readability: RubricCriteria;
  completeness: RubricCriteria;
  test_coverage: RubricCriteria;
  user_experience: RubricCriteria;
}

export interface RubricCriteria {
  weight: number; // 0-1, used for weighted overall score
  score_10: string[];  // Criteria for 10/10
  score_8_9: string[]; // Criteria for 8-9/10
  score_6_7: string[]; // Criteria for 6-7/10
  score_4_5: string[]; // Criteria for 4-5/10
  score_1_3: string[]; // Criteria for 1-3/10
}

export interface ScoringResult {
  architecture_score: number;
  architecture_evidence: string;
  readability_score: number;
  readability_evidence: string;
  completeness_score: number;
  completeness_evidence: string;
  test_coverage_score: number;
  test_coverage_evidence: string;
  user_experience_score: number;
  user_experience_evidence: string;
  overall_score: number;
  summary: string;
  timestamp: string;
}

/**
 * Scoring Rubrics for Code Quality Evaluation
 * Each dimension scored 1-10, with specific criteria for each tier
 * Weights sum to 1.0 for calculating overall score
 */
export const SCORING_RUBRICS: ScoringRubrics = {
  architecture: {
    weight: 0.25, // 25% of overall score
    score_10: [
      'Perfect separation of concerns (UI/logic/data layers clearly separated)',
      'Follows Next.js App Router conventions exactly (Server/Client Components used correctly)',
      'Clean dependency flow with no circular dependencies',
      'Proper use of composition over inheritance',
      'Reusable abstractions that follow DRY principle',
      'All API routes follow RESTful conventions',
      'Database access properly abstracted (e.g., Supabase client in dedicated service)'
    ],
    score_8_9: [
      'Good separation of concerns with 1-2 minor violations acceptable',
      'Follows framework conventions with minor deviations',
      'Mostly clean dependency flow',
      'Good reuse of components and utilities',
      'API routes mostly RESTful',
      'Database access mostly centralized'
    ],
    score_6_7: [
      'Separation of concerns present but inconsistent',
      'Some framework convention violations',
      'A few circular dependencies or improper imports',
      'Some code duplication (DRY violations)',
      'API routes inconsistent',
      'Database access somewhat scattered'
    ],
    score_4_5: [
      'Poor separation of concerns (mixing UI, logic, data)',
      'Many framework convention violations',
      'Circular dependencies present',
      'Significant code duplication',
      'API routes poorly structured',
      'Database queries scattered throughout codebase'
    ],
    score_1_3: [
      'No architectural structure',
      'Framework used incorrectly',
      'Tangled dependencies',
      'Massive code duplication',
      'No API structure',
      'Database queries everywhere'
    ]
  },

  readability: {
    weight: 0.20, // 20% of overall score
    score_10: [
      'All functions have clear, descriptive names that explain purpose',
      'Consistent naming conventions throughout (camelCase, PascalCase as appropriate)',
      'Every non-trivial function has JSDoc or TSDoc comments',
      'Complex logic has inline comments explaining "why" not "what"',
      'Consistent code formatting (Prettier or similar)',
      'File and folder names match content',
      'No overly long functions (>50 lines is a red flag)',
      'TypeScript types are clear and well-documented'
    ],
    score_8_9: [
      'Most functions well-named',
      'Consistent naming with minor lapses',
      'Key functions documented',
      'Important logic commented',
      'Mostly consistent formatting',
      'File organization clear',
      'Few overly long functions',
      'Types mostly clear'
    ],
    score_6_7: [
      'Function names sometimes unclear',
      'Naming inconsistencies',
      'Some documentation missing',
      'Sparse comments',
      'Formatting inconsistent',
      'File organization confusing',
      'Several long functions',
      'Types sometimes unclear'
    ],
    score_4_5: [
      'Many unclear function names',
      'Inconsistent naming throughout',
      'Little to no documentation',
      'No explanatory comments',
      'Poor formatting',
      'Confusing file structure',
      'Many overly long functions',
      'Types unclear or missing'
    ],
    score_1_3: [
      'Cryptic or misleading names',
      'No naming convention',
      'No documentation',
      'No comments',
      'No formatting',
      'Chaotic file structure',
      'Monolithic functions',
      'No types or any types everywhere'
    ]
  },

  completeness: {
    weight: 0.25, // 25% of overall score
    score_10: [
      'All features from specification are implemented',
      'All edge cases handled (empty states, errors, loading states)',
      'Input validation on all user inputs',
      'Error handling with user-friendly messages',
      'Loading states for async operations',
      'Success/failure feedback for user actions',
      'Accessibility considerations (ARIA labels, keyboard navigation)',
      'Responsive design for mobile/tablet/desktop'
    ],
    score_8_9: [
      'All major features implemented',
      'Most edge cases handled',
      'Input validation on critical inputs',
      'Good error handling',
      'Loading states on key operations',
      'User feedback present',
      'Some accessibility',
      'Mostly responsive'
    ],
    score_6_7: [
      'Core features implemented, some minor features missing',
      'Some edge cases unhandled',
      'Basic input validation',
      'Basic error handling',
      'Some loading states',
      'Minimal user feedback',
      'Little accessibility',
      'Partially responsive'
    ],
    score_4_5: [
      'Many features missing or incomplete',
      'Most edge cases unhandled',
      'Minimal input validation',
      'Poor error handling',
      'Few loading states',
      'Poor user feedback',
      'No accessibility',
      'Not responsive'
    ],
    score_1_3: [
      'Majority of features missing',
      'No edge case handling',
      'No input validation',
      'No error handling',
      'No loading states',
      'No user feedback',
      'No accessibility',
      'Mobile broken'
    ]
  },

  test_coverage: {
    weight: 0.15, // 15% of overall score
    score_10: [
      'All critical paths have tests (>80% coverage)',
      'Unit tests for utility functions and services',
      'Integration tests for API routes',
      'Component tests for UI components',
      'Tests are readable and maintainable',
      'Tests use proper assertions (not just smoke tests)',
      'Edge cases covered in tests',
      'Test data is realistic and representative'
    ],
    score_8_9: [
      'Most critical paths tested (60-80% coverage)',
      'Unit tests for key utilities',
      'Some integration tests',
      'Some component tests',
      'Tests mostly readable',
      'Good assertions',
      'Some edge case testing',
      'Decent test data'
    ],
    score_6_7: [
      'Basic test coverage (40-60%)',
      'Some unit tests',
      'Minimal integration tests',
      'Few component tests',
      'Tests somewhat unclear',
      'Basic assertions',
      'Few edge cases tested',
      'Basic test data'
    ],
    score_4_5: [
      'Minimal test coverage (<40%)',
      'Very few unit tests',
      'No integration tests',
      'No component tests',
      'Tests poorly written',
      'Weak assertions',
      'No edge case testing',
      'Poor test data'
    ],
    score_1_3: [
      'No tests or broken tests',
      'No unit tests',
      'No integration tests',
      'No component tests',
      'Tests don\'t run',
      'No meaningful assertions',
      'No test coverage',
      'No test data'
    ]
  },

  user_experience: {
    weight: 0.15, // 15% of overall score
    score_10: [
      'Intuitive navigation (user knows where they are and where to go)',
      'Consistent UI patterns throughout application',
      'Fast perceived performance (<100ms interactions, <2s page loads)',
      'Clear calls-to-action with proper visual hierarchy',
      'Helpful error messages that guide user to resolution',
      'Smooth animations and transitions (not jarring)',
      'Form inputs have labels, placeholders, and validation feedback',
      'Application feels polished and professional'
    ],
    score_8_9: [
      'Clear navigation',
      'Mostly consistent UI',
      'Good performance',
      'Clear CTAs',
      'Good error messages',
      'Decent animations',
      'Forms well-labeled',
      'Feels solid'
    ],
    score_6_7: [
      'Navigation present but unclear',
      'Some UI inconsistencies',
      'Acceptable performance',
      'CTAs sometimes unclear',
      'Basic error messages',
      'Some animations',
      'Forms functional',
      'Feels unfinished'
    ],
    score_4_5: [
      'Confusing navigation',
      'Inconsistent UI',
      'Slow performance',
      'Unclear CTAs',
      'Poor error messages',
      'Jarring or no animations',
      'Forms poorly labeled',
      'Feels amateurish'
    ],
    score_1_3: [
      'No clear navigation',
      'Chaotic UI',
      'Very slow',
      'No clear CTAs',
      'No error messages or cryptic ones',
      'Broken animations',
      'Forms unusable',
      'Feels broken'
    ]
  }
};

/**
 * Calculate weighted overall score from individual dimension scores
 */
export function calculateOverallScore(scores: {
  architecture: number;
  readability: number;
  completeness: number;
  test_coverage: number;
  user_experience: number;
}): number {
  const overall =
    scores.architecture * SCORING_RUBRICS.architecture.weight +
    scores.readability * SCORING_RUBRICS.readability.weight +
    scores.completeness * SCORING_RUBRICS.completeness.weight +
    scores.test_coverage * SCORING_RUBRICS.test_coverage.weight +
    scores.user_experience * SCORING_RUBRICS.user_experience.weight;

  // Round to 1 decimal place
  return Math.round(overall * 10) / 10;
}

/**
 * Build scoring prompt for Claude Code to evaluate a project
 * This prompt will be used with Claude Code CLI to perform the evaluation
 */
export function buildScoringPrompt(projectPath: string, projectSpec?: string): string {
  return `You are evaluating a Next.js application against objective quality rubrics.

PROJECT CONTEXT:
- Project path: ${projectPath}
- Read all source files in src/ (or app/, pages/, components/, lib/, etc.)
${projectSpec ? `- Original specification: ${projectSpec}` : ''}

SCORING RUBRICS:
${JSON.stringify(SCORING_RUBRICS, null, 2)}

INSTRUCTIONS:
1. Read all relevant source code files (excluding node_modules, .next, etc.)
2. For each dimension (architecture, readability, completeness, test_coverage, user_experience):
   - Select the score tier (1-3, 4-5, 6-7, 8-9, or 10) that best matches the code
   - Provide SPECIFIC EVIDENCE with file paths, line numbers, and code examples
   - Quote actual code snippets as evidence (not just descriptions)
3. Be objective - score based on criteria, not gut feeling
4. Be strict - 10/10 is rare and requires meeting ALL criteria for that tier
5. Calculate weighted overall score using the dimension weights

RETURN FORMAT (JSON only, no markdown):
{
  "architecture_score": <1-10>,
  "architecture_evidence": "<specific file:line examples showing why this score>",
  "readability_score": <1-10>,
  "readability_evidence": "<specific file:line examples showing why this score>",
  "completeness_score": <1-10>,
  "completeness_evidence": "<specific file:line examples showing why this score>",
  "test_coverage_score": <1-10>,
  "test_coverage_evidence": "<specific file:line examples showing why this score>",
  "user_experience_score": <1-10>,
  "user_experience_evidence": "<specific file:line examples showing why this score>",
  "overall_score": <weighted average calculated>,
  "summary": "<2-3 sentence summary of overall quality and key issues>",
  "timestamp": "<ISO 8601 timestamp>"
}

CRITICAL: Provide concrete evidence. Good evidence example:
"Architecture score: 7/10. src/app/api/users/route.ts:15-20 mixes data fetching with business logic. src/components/UserList.tsx:45 directly imports Supabase client instead of using service layer. However, src/lib/services/auth.ts shows good separation."

Bad evidence example:
"Architecture score: 7/10. Some separation of concerns issues, but mostly okay."

Begin evaluation now.`;
}

/**
 * Parse scoring result from Claude Code's JSON output
 * Validates that all required fields are present and scores are in range
 */
export function parseScoringResult(jsonOutput: string): ScoringResult {
  const result = JSON.parse(jsonOutput);

  // Validate required fields
  const requiredFields = [
    'architecture_score',
    'architecture_evidence',
    'readability_score',
    'readability_evidence',
    'completeness_score',
    'completeness_evidence',
    'test_coverage_score',
    'test_coverage_evidence',
    'user_experience_score',
    'user_experience_evidence',
    'overall_score',
    'summary'
  ];

  for (const field of requiredFields) {
    if (!(field in result)) {
      throw new Error(`Missing required field: ${field}`);
    }
  }

  // Validate score ranges (1-10)
  const scoreFields = [
    'architecture_score',
    'readability_score',
    'completeness_score',
    'test_coverage_score',
    'user_experience_score'
  ];

  for (const field of scoreFields) {
    const score = result[field];
    if (typeof score !== 'number' || score < 1 || score > 10) {
      throw new Error(`Invalid score for ${field}: ${score}. Must be 1-10.`);
    }
  }

  // Validate overall score
  if (typeof result.overall_score !== 'number' || result.overall_score < 1 || result.overall_score > 10) {
    throw new Error(`Invalid overall_score: ${result.overall_score}. Must be 1-10.`);
  }

  // Add timestamp if not present
  if (!result.timestamp) {
    result.timestamp = new Date().toISOString();
  }

  return result as ScoringResult;
}

/**
 * Get human-readable summary of scores
 */
export function getSummary(result: ScoringResult): string {
  const grade = result.overall_score >= 8 ? '🟢 EXCELLENT' :
                result.overall_score >= 6 ? '🟡 GOOD' :
                result.overall_score >= 4 ? '🟠 NEEDS IMPROVEMENT' :
                '🔴 POOR';

  return `
Overall: ${result.overall_score}/10 ${grade}

Breakdown:
  Architecture:   ${result.architecture_score}/10
  Readability:    ${result.readability_score}/10
  Completeness:   ${result.completeness_score}/10
  Test Coverage:  ${result.test_coverage_score}/10
  User Experience: ${result.user_experience_score}/10

${result.summary}
`.trim();
}
