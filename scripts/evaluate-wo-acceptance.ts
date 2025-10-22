/**
 * Evaluate work order implementation against acceptance criteria
 *
 * This script performs code inspection based on structured evaluation criteria
 * to determine if a WO implementation meets acceptance requirements.
 */

import * as fs from 'fs';
import * as path from 'path';
import { glob } from 'glob';

interface EvaluationCheck {
  id: string;
  type: string;
  description?: string;
  patterns?: string[];
  required?: boolean;
  points: number;
  min_occurrences?: number;
  min_matches?: number;
  name?: string;
  name_patterns?: string[];
  required_values?: string[];
  required_channels?: string[];
  methods?: string[];
  min_required?: number;
}

interface AcceptanceCriterion {
  id: string;
  description: string;
  weight: number;
  evaluation_type: string;
  checks: EvaluationCheck[];
  pass_threshold: number;
  max_points: number;
  optional?: boolean;
  test_file_patterns?: string[];
}

interface EvaluationCriteria {
  wo_id: string;
  title: string;
  complexity: number;
  total_acceptance_criteria: number;
  target_files: string[];
  acceptance_criteria: AcceptanceCriterion[];
  scoring: {
    total_possible_points: number;
    pass_threshold: number;
    grade_scale: Record<string, number>;
  };
}

interface CheckResult {
  checkId: string;
  passed: boolean;
  pointsEarned: number;
  pointsPossible: number;
  details: string;
}

interface ACResult {
  acId: string;
  description: string;
  passed: boolean;
  score: number;
  maxScore: number;
  checks: CheckResult[];
}

interface EvaluationResult {
  woId: string;
  title: string;
  totalScore: number;
  maxScore: number;
  percentage: number;
  passed: boolean;
  grade: string;
  acResults: ACResult[];
  filesEvaluated: string[];
  timestamp: string;
}

/**
 * Find implementation files in the codebase
 */
async function findImplementationFiles(targetFiles: string[]): Promise<string[]> {
  const found: string[] = [];
  const searchPaths = ['src/**/*.ts', 'lib/**/*.ts'];

  for (const pattern of searchPaths) {
    const files = await glob(pattern, { cwd: process.cwd() });
    found.push(...files);
  }

  // Also check exact target paths
  for (const targetPath of targetFiles) {
    const fullPath = path.join(process.cwd(), targetPath);
    if (fs.existsSync(fullPath)) {
      found.push(targetPath);
    }
  }

  return [...new Set(found)]; // Deduplicate
}

/**
 * Read and combine content from multiple files
 */
function readImplementationCode(files: string[]): string {
  let combinedCode = '';

  for (const file of files) {
    const fullPath = path.join(process.cwd(), file);
    if (fs.existsSync(fullPath)) {
      const content = fs.readFileSync(fullPath, 'utf-8');
      combinedCode += `\n// ========== ${file} ==========\n${content}\n`;
    }
  }

  return combinedCode;
}

/**
 * Evaluate a single check against the code
 */
function evaluateCheck(check: EvaluationCheck, code: string, testCode?: string): CheckResult {
  const result: CheckResult = {
    checkId: check.id,
    passed: false,
    pointsEarned: 0,
    pointsPossible: check.points,
    details: ''
  };

  const searchCode = testCode && check.type.includes('test') ? testCode : code;

  switch (check.type) {
    case 'class_exists':
      result.passed = new RegExp(`class\\s+${check.name}`, 'i').test(code);
      result.details = result.passed
        ? `Class ${check.name} found`
        : `Class ${check.name} not found`;
      break;

    case 'state_machine_present':
      if (check.patterns) {
        const matches = check.patterns.filter(p => new RegExp(p, 'i').test(code));
        result.passed = matches.length >= (check.min_matches || check.patterns.length);
        result.details = `Found ${matches.length}/${check.patterns.length} state machine patterns: ${matches.join(', ')}`;
      }
      break;

    case 'method_exists':
      if (check.methods) {
        const found = check.methods.filter(m =>
          new RegExp(`(${m})\\s*\\(`, 'i').test(code) ||
          new RegExp(`(${m})\\s*=`, 'i').test(code)
        );
        result.passed = found.length >= (check.min_required || check.methods.length);
        result.details = `Found ${found.length}/${check.methods.length} methods: ${found.join(', ')}`;
      }
      break;

    case 'implements_interface':
      result.passed = /implements\s+\w+|:\s*\w+Interface/.test(code) || /type\s+\w+\s*=/.test(code);
      result.details = result.passed ? 'Interface/type definition found' : 'No clear interface definition';
      break;

    case 'enum_or_type_exists':
      if (check.required_values) {
        const found = check.required_values.filter(v =>
          new RegExp(`['"]${v}['"]|\\b${v}\\b`, 'i').test(code)
        );
        result.passed = found.length >= (check.min_matches || check.required_values.length);
        result.details = `Found ${found.length}/${check.required_values.length} states: ${found.join(', ')}`;
      }
      break;

    case 'state_transition_logic':
      if (check.patterns) {
        result.passed = check.patterns.some(p => new RegExp(p, 'i').test(code));
        result.details = result.passed ? 'State transition logic found' : 'No state transition logic detected';
      }
      break;

    case 'state_validation':
      if (check.patterns) {
        result.passed = check.patterns.some(p => new RegExp(p, 'i').test(code));
        result.details = result.passed ? 'State validation found' : 'No state validation detected';
      }
      break;

    case 'delay_mechanism':
      if (check.patterns) {
        result.passed = check.patterns.some(p => new RegExp(p, 'i').test(code));
        result.details = result.passed ? 'Delay mechanism found' : 'No delay mechanism detected';
      }
      break;

    case 'configurable_timing':
      if (check.patterns) {
        const matches = check.patterns.filter(p => new RegExp(p, 'i').test(code));
        result.passed = matches.length > 0;
        result.details = `Configurable timing: ${matches.length > 0 ? 'Yes' : 'No'}`;
      }
      break;

    case 'sequence_coordination':
      if (check.patterns) {
        const matches = check.patterns.filter(p => new RegExp(p, 'i').test(code));
        result.passed = matches.length >= 2;
        result.details = `Async coordination patterns found: ${matches.join(', ')}`;
      }
      break;

    case 'focus_management':
    case 'focus_verification':
    case 'webview_switching':
      if (check.patterns) {
        result.passed = check.patterns.some(p => new RegExp(p, 'i').test(code));
        result.details = result.passed ? `${check.type} found` : `No ${check.type} detected`;
      }
      break;

    case 'try_catch_blocks':
      const tryCatchCount = (code.match(/try\s*{/gi) || []).length;
      result.passed = tryCatchCount >= (check.min_occurrences || 1);
      result.details = `Found ${tryCatchCount} try-catch blocks (need ${check.min_occurrences || 1})`;
      break;

    case 'specific_error_handling':
      if (check.patterns) {
        const matches = check.patterns.filter(p => new RegExp(p, 'i').test(code));
        result.passed = matches.length >= (check.min_matches || 1);
        result.details = `Error handling for: ${matches.length} specific cases`;
      }
      break;

    case 'error_recovery_logic':
      if (check.patterns) {
        result.passed = check.patterns.some(p => new RegExp(p, 'i').test(code));
        result.details = result.passed ? 'Recovery logic present' : 'No recovery logic found';
      }
      break;

    case 'state_backup':
    case 'rollback_implementation':
    case 'rollback_on_error':
      if (check.patterns) {
        result.passed = check.patterns.some(p => new RegExp(p, 'i').test(code));
        result.details = result.passed ? `${check.type} found` : `No ${check.type} detected`;
      }
      break;

    case 'event_emitter_pattern':
      if (check.patterns) {
        const matches = check.patterns.filter(p => new RegExp(p, 'i').test(code));
        result.passed = matches.length >= (check.min_matches || 1);
        result.details = `EventEmitter patterns: ${matches.length} found`;
      }
      break;

    case 'progress_events':
    case 'renderer_communication':
      if (check.patterns) {
        result.passed = check.patterns.some(p => new RegExp(p, 'i').test(code));
        result.details = result.passed ? `${check.type} found` : `No ${check.type} detected`;
      }
      break;

    case 'ipc_handler_registration':
      const ipcHandlers = (code.match(/ipcMain\.(handle|on)/gi) || []).length;
      result.passed = ipcHandlers >= (check.min_occurrences || 1);
      result.details = `Found ${ipcHandlers} IPC handlers (need ${check.min_occurrences || 1})`;
      break;

    case 'specific_channels':
      if (check.required_channels) {
        const found = check.required_channels.filter(channel =>
          new RegExp(`['"]${channel}['"]`, 'i').test(code)
        );
        result.passed = found.length >= (check.min_matches || check.required_channels.length);
        result.details = `Found ${found.length}/${check.required_channels.length} channels: ${found.join(', ')}`;
      }
      break;

    case 'handler_implementation':
      if (check.patterns) {
        const matches = check.patterns.filter(p => new RegExp(p, 'i').test(code));
        result.passed = matches.length >= (check.min_matches || 1);
        result.details = `Handler implementations: ${matches.length} found`;
      }
      break;

    case 'test_file_exists':
      result.passed = testCode !== undefined && testCode.length > 0;
      result.details = result.passed ? 'Test file exists' : 'No test file found';
      break;

    case 'integration_test_present':
    case 'mock_webviews':
      if (check.patterns && testCode) {
        result.passed = check.patterns.some(p => new RegExp(p, 'i').test(testCode));
        result.details = result.passed ? `${check.type} found in tests` : `No ${check.type} in tests`;
      }
      break;

    case 'timeout_constant':
    case 'timeout_mechanism':
    case 'abort_on_timeout':
    case 'detailed_error_state':
      if (check.patterns) {
        result.passed = check.patterns.some(p => new RegExp(p, 'i').test(code));
        result.details = result.passed ? `${check.type} found` : `No ${check.type} detected`;
      }
      break;

    default:
      result.details = `Unknown check type: ${check.type}`;
  }

  if (result.passed) {
    result.pointsEarned = check.points;
  }

  return result;
}

/**
 * Evaluate a single acceptance criterion
 */
function evaluateAC(ac: AcceptanceCriterion, code: string, testCode?: string): ACResult {
  const checkResults = ac.checks.map(check => evaluateCheck(check, code, testCode));

  const totalPoints = checkResults.reduce((sum, r) => sum + r.pointsEarned, 0);
  const passed = totalPoints >= ac.pass_threshold;

  return {
    acId: ac.id,
    description: ac.description,
    passed,
    score: totalPoints,
    maxScore: ac.max_points,
    checks: checkResults
  };
}

/**
 * Main evaluation function
 */
async function evaluateWorkOrder(criteriaPath: string): Promise<EvaluationResult> {
  // Load criteria
  const criteriaContent = fs.readFileSync(criteriaPath, 'utf-8');
  const criteria: EvaluationCriteria = JSON.parse(criteriaContent);

  console.log(`\n${'='.repeat(100)}`);
  console.log(`🧪 EVALUATING: ${criteria.title}`);
  console.log(`${'='.repeat(100)}\n`);

  // Find implementation files
  const allFiles = await findImplementationFiles(criteria.target_files);

  // Filter to likely implementation files
  const implementationFiles = allFiles.filter(f =>
    f.toLowerCase().includes('clipboard') ||
    f.toLowerCase().includes('coordinator') ||
    f.toLowerCase().includes('coordination') ||
    criteria.target_files.some(target => f.includes(path.basename(target).replace('.ts', '')))
  );

  console.log(`📂 Found ${implementationFiles.length} potential implementation files:`);
  implementationFiles.forEach(f => console.log(`   - ${f}`));

  // Read implementation code
  const code = readImplementationCode(implementationFiles);

  if (!code || code.trim().length === 0) {
    console.log('\n❌ No implementation code found!\n');
    return {
      woId: criteria.wo_id,
      title: criteria.title,
      totalScore: 0,
      maxScore: criteria.scoring.total_possible_points,
      percentage: 0,
      passed: false,
      grade: 'F',
      acResults: [],
      filesEvaluated: [],
      timestamp: new Date().toISOString()
    };
  }

  // Look for test files
  const testFiles = allFiles.filter(f =>
    (f.includes('.test.') || f.includes('.spec.')) &&
    (f.toLowerCase().includes('clipboard') || f.toLowerCase().includes('coordinator'))
  );
  const testCode = readImplementationCode(testFiles);

  console.log(`\n📝 Code size: ${code.length} characters`);
  if (testCode) console.log(`🧪 Test code size: ${testCode.length} characters\n`);

  // Evaluate each acceptance criterion
  console.log(`\n${'='.repeat(100)}`);
  console.log(`ACCEPTANCE CRITERIA EVALUATION\n`);

  const acResults: ACResult[] = [];

  for (const ac of criteria.acceptance_criteria) {
    const result = evaluateAC(ac, code, testCode);
    acResults.push(result);

    const statusIcon = result.passed ? '✅' : '❌';
    console.log(`${statusIcon} ${result.acId}: ${result.description}`);
    console.log(`   Score: ${result.score}/${result.maxScore} (threshold: ${ac.pass_threshold})`);

    result.checks.forEach(check => {
      const checkIcon = check.passed ? '  ✓' : '  ✗';
      console.log(`${checkIcon} ${check.checkId}: ${check.details} [${check.pointsEarned}/${check.pointsPossible} pts]`);
    });
    console.log();
  }

  // Calculate final score
  const totalScore = acResults.reduce((sum, r) => sum + r.score, 0);
  const percentage = (totalScore / criteria.scoring.total_possible_points) * 100;
  const passed = percentage >= criteria.scoring.pass_threshold;

  // Determine grade
  let grade = 'F';
  for (const [g, threshold] of Object.entries(criteria.scoring.grade_scale).reverse()) {
    if (percentage >= threshold) {
      grade = g;
      break;
    }
  }

  console.log(`${'='.repeat(100)}`);
  console.log(`\n📊 FINAL RESULTS:\n`);
  console.log(`   Total Score: ${totalScore}/${criteria.scoring.total_possible_points}`);
  console.log(`   Percentage: ${percentage.toFixed(1)}%`);
  console.log(`   Grade: ${grade}`);
  console.log(`   Status: ${passed ? '✅ PASS' : '❌ FAIL'}\n`);
  console.log(`${'='.repeat(100)}\n`);

  return {
    woId: criteria.wo_id,
    title: criteria.title,
    totalScore,
    maxScore: criteria.scoring.total_possible_points,
    percentage,
    passed,
    grade,
    acResults,
    filesEvaluated: implementationFiles,
    timestamp: new Date().toISOString()
  };
}

// Main execution
const criteriaPath = process.argv[2] ||
  path.join(__dirname, '../tests/acceptance/evaluation-criteria/wo-787c6dd1-clipboard-coordination.json');

evaluateWorkOrder(criteriaPath)
  .then(result => {
    // Save results
    const outputPath = path.join(__dirname, '../tests/acceptance/results', `${result.woId.substring(0, 8)}-evaluation-${Date.now()}.json`);
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, JSON.stringify(result, null, 2));
    console.log(`💾 Results saved to: ${outputPath}\n`);

    process.exit(result.passed ? 0 : 1);
  })
  .catch(error => {
    console.error('❌ Evaluation failed:', error);
    process.exit(1);
  });
