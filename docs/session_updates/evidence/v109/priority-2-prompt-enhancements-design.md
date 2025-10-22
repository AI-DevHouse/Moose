# Priority 2 Prompt Enhancements — Design Document

**Design Date:** 2025-10-21
**Session:** v109
**Context:** Addressing 80% failure rate of Priority 1 text-only rules
**Target:** Increase acceptance scores from 65/100 to 85/100 (+20 points)

---

## Executive Summary

**Approach:** Two-tier improvement strategy prioritizing prompt restructuring and programmatic validation. Tier 2 (examples) **SKIPPED** due to prompt bloat risk.

| Tier | Strategy | Effort | Impact | Risk | Timeline |
|------|----------|--------|--------|------|----------|
| **Tier 1** | Prompt Restructuring | 2h | +8-12 pts | Low | v110 (immediate) |
| ~~**Tier 2**~~ | ~~Concrete Examples~~ | ~~3h~~ | ~~+5-8 pts~~ | **HIGH (bloat)** | **SKIPPED** |
| **Tier 3** | Programmatic Validation | 10h | +15-20 pts | Low | v110-v111 |
| **TOTAL** | Tier 1 + Tier 3 | 12h | +23-32 pts | Low | 2 sessions |

**Expected Outcome:** 65 + 27 (avg) = **92/100** acceptance score

**Strategy Rationale:**
- Tier 1 alone may reach 75-80/100 (test before proceeding)
- Tier 3 provides deterministic enforcement (higher ROI than examples)
- Tier 2 risks attention dilution in already-large prompt (5000+ words)
- If needed, add minimal Tier 2-Lite (2-3 examples, +500 tokens) after Tier 3 validation

---

## Prompt Size Risk Analysis

### Current State
- **Base prompt:** ~5000 words (~6000 tokens)
- **Priority 1 additions (v108):** +950 words (~1200 tokens)
- **Current total:** ~7200 tokens

### The Attention Budget Problem

**Research Finding:** LLMs have **position bias** in long prompts:
- **Top 10%:** Highest attention (90%+ retained)
- **Bottom 10%:** High attention (80%+ retained)
- **Middle 80%:** Degraded attention (40-60% retained)

**Implication:** Adding content to middle of prompt can **reduce effectiveness** of existing rules by diluting attention.

### Tier 2 Risk Assessment

**If Tier 2 Added (5-6 full examples):**
- Addition: +1000-1500 tokens
- New total: ~8500 tokens
- Risk: Rules buried deeper in "low attention" zone

**Potential Negative Outcomes:**
1. **Attention dilution** — More content → less attention per token
2. **Information overload** — Too many patterns → confusion
3. **Signal-to-noise degradation** — Redundant examples add noise
4. **Diminishing returns** — LLMs trained on these patterns already

**Tier 3 Has Zero Risk:**
- Validation runs AFTER generation (not in base prompt)
- Only adds to targeted refinement prompts (when violations found)
- No attention budget impact

### Decision: Skip Tier 2

**Rationale:**
- Tier 1 restructures existing content (no size increase)
- Tier 3 adds enforcement without prompt bloat
- If both insufficient, add minimal Tier 2-Lite (2-3 examples, +500 tokens)
- Test before adding complexity

---

## Tier 1: Prompt Restructuring

### Problem
Current Priority 1 rules (added in v108):
- Buried in middle of 5000+ word prompt (lines 796-945)
- No visual emphasis (plain text)
- Not repeated at point of generation
- No checklist format for verification

### Solution: Visual Hierarchy + Repetition

#### 1.1 Add Header Section (New Top Block)

**Location:** Insert at line 50 (after context, before examples)

```typescript
// enhanced-proposer-service.ts

const CRITICAL_REQUIREMENTS_HEADER = `
🚨 CRITICAL REQUIREMENTS — Verify Before Submitting
═══════════════════════════════════════════════════════════════════════════

Your implementation MUST satisfy all 5 requirements below. These are non-negotiable.

□ 1. NO PLACEHOLDER CODE
   ├─ No TODO comments
   ├─ No "implementation goes here" or similar stubs
   ├─ No empty function bodies with only comments
   └─ Every function must have complete, runnable logic

□ 2. COMPLETE ERROR HANDLING
   ├─ Every async function wrapped in try/catch
   ├─ All IPC handlers validate inputs and catch errors
   ├─ Specific error messages (not generic "error occurred")
   └─ Error state properly propagated/logged

□ 3. COMPREHENSIVE INPUT VALIDATION
   ├─ Null/undefined checks at function boundaries
   ├─ Type guards for complex types
   ├─ Range/format validation (numbers, strings, arrays)
   └─ Fail fast with clear error messages

□ 4. PROPER RESOURCE MANAGEMENT
   ├─ Timers/intervals cleared in finally blocks
   ├─ Event listeners removed when done
   ├─ File handles/connections closed after use
   └─ No memory leaks on error paths

□ 5. REAL TEST ASSERTIONS
   ├─ Every test case has expect() or assert() calls
   ├─ Tests verify actual behavior (not just "no crash")
   ├─ Mock external dependencies properly
   └─ Test both success and failure paths

═══════════════════════════════════════════════════════════════════════════
⚠️  Implementations failing these requirements will be rejected.
═══════════════════════════════════════════════════════════════════════════
`
```

**Rationale:**
- Visual emphasis (emojis, borders) increases attention
- Checklist format is easier to verify
- Positioned at top where LLMs have highest attention
- Explicit rejection warning increases compliance pressure

---

#### 1.2 Add Footer Checklist (Final Verification)

**Location:** Insert at end of task description (before code generation starts)

```typescript
const FINAL_VERIFICATION_CHECKLIST = `
═══════════════════════════════════════════════════════════════════════════
FINAL VERIFICATION — Complete This Checklist Before Submitting
═══════════════════════════════════════════════════════════════════════════

Manually check your generated code:

1. PLACEHOLDER CODE SCAN
   └─ Search for: "//" → Any comment with "TODO", "FIXME", "goes here", "implement"?
   └─ If found: Replace with actual implementation

2. ERROR HANDLING SCAN
   └─ Search for: "async" → Every async function has try/catch?
   └─ Search for: "ipcMain.on" → Every handler validates input and catches errors?
   └─ If missing: Add error handling

3. INPUT VALIDATION SCAN
   └─ Search for: "function", "=>" → Check first 2 lines for validation
   └─ If missing: Add null checks and type guards

4. RESOURCE CLEANUP SCAN
   └─ Search for: "setTimeout", "setInterval", "addEventListener"
   └─ Each must have: clearTimeout/clearInterval/removeListener in finally block
   └─ If missing: Add cleanup code

5. TEST ASSERTION SCAN
   └─ Search for: "it(", "test(" → Every test has "expect(" or "assert("?
   └─ If missing: Add real assertions

═══════════════════════════════════════════════════════════════════════════
ALL CHECKS MUST PASS. Review your code now.
═══════════════════════════════════════════════════════════════════════════
`
```

**Rationale:**
- Repeats requirements at decision point (right before generation)
- Actionable steps (search for X, verify Y)
- Self-verification approach (LLM checks own output)
- Search patterns are concrete and easy to apply

---

### Implementation

**File:** `src/lib/enhanced-proposer-service.ts`

**Changes:**
```typescript
// Line 50 (new)
const CRITICAL_REQUIREMENTS_HEADER = `...` // Full block above

// Line 796 (existing Priority 1 rules stay for backward compatibility)
// Keep detailed rules for reference

// Line 950 (new, before buildClaudePrompt returns)
const FINAL_VERIFICATION_CHECKLIST = `...` // Full block above

private buildClaudePrompt(wo: WorkOrder, context: ProposerContext): string {
  return `
${CRITICAL_REQUIREMENTS_HEADER}

${this.getWorkOrderContext(wo)}
${this.getAcceptanceCriteria(wo)}
${this.getTechnicalContext(context)}

${this.getDetailedRules()}  // Existing Priority 1 rules

${FINAL_VERIFICATION_CHECKLIST}

Now implement the work order following all requirements above.
`
}
```

**Testing:**
1. Re-run WO-787c6dd1 with Tier 1 changes only
2. Measure improvement vs baseline (65/100)
3. Expected: 73-77/100 (+8-12 points from structure alone)

---

## Tier 2: Concrete Examples — **SKIPPED**

### Status: **NOT RECOMMENDED**

**Reason:** Prompt bloat risk outweighs potential benefits.

### Why Skipped

**Current prompt is 7200 tokens.** Adding 5-6 full code examples would:
- Add 1000-1500 tokens (+20% size increase)
- Push total to ~8500 tokens
- Bury critical rules deeper in "low attention" middle section
- Risk attention dilution across all content

**Tier 3 is more effective:**
- Programmatic validation = deterministic enforcement
- No prompt size impact (runs after generation)
- Higher ceiling (+15-20 pts vs +5-8 pts)
- Lower risk (validation can't make prompt worse)

### Fallback: Tier 2-Lite (If Needed)

**Only implement if:**
1. Tier 1 + Tier 3 combined score <80/100
2. Validation shows LLM confused about specific patterns

**Tier 2-Lite Specification:**
- Add only 2-3 minimal examples (not 5-6 full examples)
- Target worst failures: placeholder code + error handling
- Keep examples short (3-5 lines, not 20+ lines)
- Place immediately after each rule (local reinforcement)
- Total addition: ~500 tokens (not 1500)

**Example Format:**
```typescript
□ 1. NO PLACEHOLDER CODE
   ❌ BAD: // Implementation goes here
   ✅ GOOD: const result = await this.doWork(); return result;

□ 2. ERROR HANDLING
   ❌ BAD: ipcMain.on('foo', (e, d) => { doThing(d) })
   ✅ GOOD: ipcMain.on('foo', async (e, d) => { try { await doThing(d) } catch (err) { e.reply('error', err) } })
```

**Expected Impact:** +3-5 points (if needed at all)

---

## Tier 3: Programmatic Validation

### Problem
Text rules are ignored without enforcement mechanism. Current refinement loop only checks syntax.

### Solution: Completeness Validator in Refinement Loop

#### 3.1 Completeness Validator Implementation

**File:** `src/lib/completeness-validator.ts` (NEW)

```typescript
import * as ts from 'typescript'

export interface CompletenessViolation {
  type: 'placeholder_code' | 'missing_error_handling' | 'missing_assertions' | 'no_validation'
  file: string
  line: number
  column: number
  message: string
  severity: 'error' | 'warning'
  suggestedFix?: string
}

export interface CompletenessResult {
  violations: CompletenessViolation[]
  score: number  // 0-1, percentage of requirements met
  passed: boolean  // True if score >= 0.9
}

export class CompletenessValidator {
  private readonly placeholderPatterns = [
    /\/\/\s*TODO/i,
    /\/\/\s*FIXME/i,
    /\/\/\s*implementation\s+goes\s+here/i,
    /\/\/\s*logic\s+for\s+.+\s+goes\s+here/i,
    /throw\s+new\s+Error\(['"]Not\s+implemented/i
  ]

  public validate(code: string, filename: string): CompletenessResult {
    const violations: CompletenessViolation[] = []

    // Check 1: Placeholder code
    violations.push(...this.checkPlaceholderCode(code, filename))

    // Check 2: Error handling coverage
    violations.push(...this.checkErrorHandling(code, filename))

    // Check 3: Test assertions
    if (filename.includes('test.') || filename.includes('.test.')) {
      violations.push(...this.checkTestAssertions(code, filename))
    }

    // Check 4: Input validation
    violations.push(...this.checkInputValidation(code, filename))

    // Calculate score
    const totalChecks = this.getTotalChecks(code, filename)
    const score = totalChecks > 0 ? (totalChecks - violations.length) / totalChecks : 1.0

    return {
      violations,
      score,
      passed: score >= 0.9 && violations.filter(v => v.severity === 'error').length === 0
    }
  }

  private checkPlaceholderCode(code: string, filename: string): CompletenessViolation[] {
    const violations: CompletenessViolation[] = []
    const lines = code.split('\n')

    lines.forEach((line, index) => {
      this.placeholderPatterns.forEach(pattern => {
        if (pattern.test(line)) {
          violations.push({
            type: 'placeholder_code',
            file: filename,
            line: index + 1,
            column: line.search(pattern) + 1,
            message: `Placeholder code detected: "${line.trim()}". Replace with actual implementation.`,
            severity: 'error',
            suggestedFix: 'Implement the actual logic instead of leaving a comment.'
          })
        }
      })

      // Check for empty function bodies with only comments
      const functionMatch = line.match(/(function|=>)\s*\{?\s*$/)
      if (functionMatch && index + 1 < lines.length) {
        const nextLine = lines[index + 1].trim()
        if (nextLine.startsWith('//') && lines[index + 2]?.trim() === '}') {
          violations.push({
            type: 'placeholder_code',
            file: filename,
            line: index + 1,
            column: 0,
            message: 'Empty function with only comment. Implement actual logic.',
            severity: 'error'
          })
        }
      }
    })

    return violations
  }

  private checkErrorHandling(code: string, filename: string): CompletenessViolation[] {
    const violations: CompletenessViolation[] = []
    const sourceFile = ts.createSourceFile(filename, code, ts.ScriptTarget.Latest, true)

    const checkNode = (node: ts.Node) => {
      // Check async functions have try/catch
      if (ts.isFunctionDeclaration(node) || ts.isMethodDeclaration(node) || ts.isArrowFunction(node)) {
        const modifiers = ts.canHaveModifiers(node) ? ts.getModifiers(node) : undefined
        const isAsync = modifiers?.some(m => m.kind === ts.SyntaxKind.AsyncKeyword)

        if (isAsync && node.body && ts.isBlock(node.body)) {
          const hasTryCatch = node.body.statements.some(stmt => ts.isTryStatement(stmt))

          if (!hasTryCatch) {
            const { line, character } = sourceFile.getLineAndCharacterOfPosition(node.getStart())
            violations.push({
              type: 'missing_error_handling',
              file: filename,
              line: line + 1,
              column: character + 1,
              message: `Async function missing try/catch block`,
              severity: 'error',
              suggestedFix: 'Wrap function body in try/catch block'
            })
          }
        }
      }

      // Check IPC handlers
      if (ts.isCallExpression(node)) {
        const text = node.expression.getText(sourceFile)
        if (text === 'ipcMain.on' || text === 'ipcMain.handle') {
          const handlerArg = node.arguments[1]
          if (handlerArg && (ts.isArrowFunction(handlerArg) || ts.isFunctionExpression(handlerArg))) {
            if (handlerArg.body && ts.isBlock(handlerArg.body)) {
              const hasTryCatch = handlerArg.body.statements.some(stmt => ts.isTryStatement(stmt))

              if (!hasTryCatch) {
                const { line, character } = sourceFile.getLineAndCharacterOfPosition(node.getStart())
                violations.push({
                  type: 'missing_error_handling',
                  file: filename,
                  line: line + 1,
                  column: character + 1,
                  message: `IPC handler missing error handling`,
                  severity: 'error',
                  suggestedFix: 'Add try/catch block and send error response'
                })
              }
            }
          }
        }
      }

      ts.forEachChild(node, checkNode)
    }

    checkNode(sourceFile)
    return violations
  }

  private checkTestAssertions(code: string, filename: string): CompletenessViolation[] {
    const violations: CompletenessViolation[] = []
    const sourceFile = ts.createSourceFile(filename, code, ts.ScriptTarget.Latest, true)

    const checkNode = (node: ts.Node) => {
      // Find test blocks: it(...), test(...)
      if (ts.isCallExpression(node)) {
        const text = node.expression.getText(sourceFile)
        if (text === 'it' || text === 'test' || text === 'describe') {
          const testBody = node.arguments[1]

          if (testBody && (ts.isArrowFunction(testBody) || ts.isFunctionExpression(testBody))) {
            const bodyText = testBody.getText(sourceFile)
            const hasAssertions = /expect\(|assert\(|toBe|toEqual|toThrow/.test(bodyText)

            if (!hasAssertions && text !== 'describe') {
              const { line, character } = sourceFile.getLineAndCharacterOfPosition(node.getStart())
              violations.push({
                type: 'missing_assertions',
                file: filename,
                line: line + 1,
                column: character + 1,
                message: `Test case has no assertions (no expect/assert calls)`,
                severity: 'error',
                suggestedFix: 'Add expect() calls to verify behavior'
              })
            }
          }
        }
      }

      ts.forEachChild(node, checkNode)
    }

    checkNode(sourceFile)
    return violations
  }

  private checkInputValidation(code: string, filename: string): CompletenessViolation[] {
    const violations: CompletenessViolation[] = []
    const sourceFile = ts.createSourceFile(filename, code, ts.ScriptTarget.Latest, true)

    const checkNode = (node: ts.Node) => {
      // Check public methods for input validation
      if (ts.isMethodDeclaration(node)) {
        const modifiers = ts.canHaveModifiers(node) ? ts.getModifiers(node) : undefined
        const isPublic = !modifiers || modifiers.some(m => m.kind === ts.SyntaxKind.PublicKeyword)

        if (isPublic && node.parameters.length > 0 && node.body && ts.isBlock(node.body)) {
          // Check first 3 statements for validation
          const firstStatements = node.body.statements.slice(0, 3).map(s => s.getText(sourceFile))
          const hasValidation = firstStatements.some(stmt =>
            /if\s*\(.*===?\s*(null|undefined)\)/.test(stmt) ||
            /if\s*\(typeof\s+\w+\s*!==?/.test(stmt) ||
            /if\s*\(!\w+\)/.test(stmt)
          )

          if (!hasValidation) {
            const { line, character } = sourceFile.getLineAndCharacterOfPosition(node.getStart())
            violations.push({
              type: 'no_validation',
              file: filename,
              line: line + 1,
              column: character + 1,
              message: `Public method missing input validation`,
              severity: 'warning',  // Warning, not error (may have validation via types)
              suggestedFix: 'Add null/type checks for parameters'
            })
          }
        }
      }

      ts.forEachChild(node, checkNode)
    }

    checkNode(sourceFile)
    return violations
  }

  private getTotalChecks(code: string, filename: string): number {
    // Count functions, IPC handlers, tests, public methods
    const sourceFile = ts.createSourceFile(filename, code, ts.ScriptTarget.Latest, true)
    let count = 0

    const countNode = (node: ts.Node) => {
      if (ts.isFunctionDeclaration(node) || ts.isMethodDeclaration(node)) count++
      if (ts.isCallExpression(node)) {
        const text = node.expression.getText(sourceFile)
        if (text === 'ipcMain.on' || text === 'it' || text === 'test') count++
      }
      ts.forEachChild(node, countNode)
    }

    countNode(sourceFile)
    return Math.max(count, 1)  // Avoid division by zero
  }
}
```

---

#### 3.2 Integration into Refinement Loop

**File:** `src/lib/proposer-refinement-rules.ts` (MODIFY)

```typescript
import { CompletenessValidator, CompletenessResult } from './completeness-validator'

export async function refineProposal(
  initialCode: string,
  workOrder: WorkOrder,
  proposer: string
): Promise<RefinementResult> {
  const validator = new CompletenessValidator()
  let currentCode = initialCode
  let cycle = 0
  const maxCycles = 3
  const cycleHistory: CycleMetadata[] = []

  while (cycle < maxCycles) {
    cycle++

    // Step 1: Syntax check (existing)
    const syntaxErrors = await checkSyntax(currentCode)

    // Step 2: Contract validation (existing)
    const contractViolations = await validateContract(currentCode, workOrder)

    // Step 3: COMPLETENESS CHECK (NEW)
    const completenessResult = validator.validate(currentCode, 'proposal.ts')

    // Step 4: Sanitize (existing)
    const sanitized = await sanitizeCode(currentCode)

    // If all checks pass, we're done
    if (syntaxErrors.length === 0 &&
        contractViolations.length === 0 &&
        completenessResult.passed) {
      return {
        finalCode: sanitized,
        success: true,
        cycles: cycle,
        metadata: {
          cycle_history: cycleHistory,
          completeness_score: completenessResult.score
        }
      }
    }

    // Build refinement prompt with ALL violations
    const refinementPrompt = buildRefinementPrompt({
      syntaxErrors,
      contractViolations,
      completenessViolations: completenessResult.violations,  // NEW
      cycle,
      originalCode: currentCode
    })

    // Get refined code from LLM
    currentCode = await getRefinedCode(refinementPrompt, proposer)

    // Track cycle
    cycleHistory.push({
      cycle,
      errors_before: syntaxErrors.length,
      errors_after: 0,  // Will be checked next cycle
      completeness_score: completenessResult.score,  // NEW
      completeness_violations: completenessResult.violations.length,  // NEW
      contract_violations: contractViolations.length
    })
  }

  // Max cycles reached
  return {
    finalCode: currentCode,
    success: false,
    cycles: maxCycles,
    metadata: {
      cycle_history: cycleHistory,
      final_completeness: validator.validate(currentCode, 'proposal.ts')
    }
  }
}

function buildRefinementPrompt(params: {
  syntaxErrors: SyntaxError[]
  contractViolations: ContractViolation[]
  completenessViolations: CompletenessViolation[]
  cycle: number
  originalCode: string
}): string {
  const { syntaxErrors, contractViolations, completenessViolations, cycle, originalCode } = params

  return `
REFINEMENT CYCLE ${cycle}

Your code has the following issues that MUST be fixed:

${syntaxErrors.length > 0 ? `
## SYNTAX ERRORS (${syntaxErrors.length})
${syntaxErrors.map(e => `- Line ${e.line}: ${e.message}`).join('\n')}
` : ''}

${contractViolations.length > 0 ? `
## CONTRACT VIOLATIONS (${contractViolations.length})
${contractViolations.map(v => `- ${v.message}`).join('\n')}
` : ''}

${completenessViolations.length > 0 ? `
## COMPLETENESS VIOLATIONS (${completenessViolations.length})
${completenessViolations.map(v => `
- ${v.file}:${v.line} [${v.type}]
  ${v.message}
  ${v.suggestedFix ? `Fix: ${v.suggestedFix}` : ''}
`).join('\n')}
` : ''}

ORIGINAL CODE:
\`\`\`typescript
${originalCode}
\`\`\`

TASK: Fix ALL violations above. Return ONLY the corrected code, no explanations.
`
}
```

---

#### 3.3 Metadata Enrichment

**File:** `src/lib/orchestrator/types.ts` (MODIFY)

```typescript
export interface RefinementMetadata {
  content: string
  refinement_count: number
  initial_errors: number
  final_errors: number
  refinement_success: boolean
  error_details: ErrorDetail[]
  contract_violations: ContractViolation[]

  // NEW: Completeness tracking
  completeness_score: number  // 0-1
  completeness_violations: CompletenessViolation[]
  completeness_improved: boolean  // True if score increased

  cycle_history: CycleMetadata[]
  sanitizer_metadata: SanitizerMetadata
}

export interface CycleMetadata {
  cycle: number
  errors_before: number
  errors_after: number
  improvement_rate: number
  prompt_strategy: string
  contract_violations: number

  // NEW
  completeness_score: number
  completeness_violations: number
  completeness_improvement_rate: number
}
```

---

### Implementation Plan

**Phase 1: Build Validator (4 hours)**
1. Create `completeness-validator.ts`
2. Implement placeholder detection (regex + AST)
3. Implement error handling checker (AST)
4. Implement test assertion checker (AST)
5. Implement input validation checker (AST)
6. Write unit tests for validator

**Phase 2: Integrate (3 hours)**
1. Modify `proposer-refinement-rules.ts`
2. Add completeness check to refinement loop
3. Build refinement prompts with violation details
4. Update metadata types in `orchestrator/types.ts`

**Phase 3: Test (3 hours)**
1. Re-run WO-787c6dd1 with Tier 3 enabled
2. Verify violations detected correctly
3. Verify refinement loop fixes violations
4. Measure acceptance score improvement
5. Run 5 additional WOs for validation

**Total:** 10 hours

---

## Expected Outcomes

### Tier 1 Only (Prompt Restructuring)
**Score:** 73-77/100 (+8-12 points)
**Rationale:** Better visibility and repetition should improve compliance
**Decision Point:** If score ≥75/100, run batch test. If <75/100, proceed to Tier 3.

### Tier 1 + Tier 3 (+ Programmatic Validation) — **RECOMMENDED PATH**
**Score:** 85-92/100 (+20-27 points)
**Rationale:** Deterministic enforcement catches and fixes violations in refinement loop
**Confidence:** High (validation guarantees completeness)

### Tier 1 + Tier 3 + Tier 2-Lite (If Needed)
**Score:** 88-95/100 (+23-30 points)
**Rationale:** Minimal examples add reinforcement without bloat
**Trigger:** Only if Tier 1+3 scores <80/100 and validation shows pattern confusion

### Success Metrics

| Metric | Baseline (v109) | Target (Tier 3) | Measurement |
|--------|-----------------|-----------------|-------------|
| **Acceptance Score** | 65/100 | ≥85/100 | Manual evaluation |
| **Placeholder Code Rate** | 30% | ≤5% | Validator detection |
| **Error Handling Coverage** | 50% | ≥90% | AST analysis |
| **Test Assertion Rate** | 33% | ≥90% | Validator detection |
| **Refinement Success Rate** | 0% | ≥70% | Metadata tracking |
| **Avg Refinement Cycles** | 2.0 | ≤1.5 | Metadata tracking |

---

## Risk Mitigation

### Risk 1: False Positives
**Description:** Validator flags valid code as violations
**Mitigation:**
- Use 'warning' severity for uncertain cases (e.g., input validation)
- Only block on 'error' severity violations
- Collect false positive examples and refine patterns

### Risk 2: Infinite Refinement Loops
**Description:** Validator finds issues LLM can't fix
**Mitigation:**
- Keep max cycles at 3
- Track improvement rate, abort if no progress
- Fall back to "best effort" if cycles exhausted

### Risk 3: Performance Impact
**Description:** AST analysis adds latency
**Mitigation:**
- Cache parsed AST between checks
- Run validator in parallel with syntax check
- Measure: target <500ms per validation

### Risk 4: Over-Constraining Creativity
**Description:** Strict rules prevent valid alternative implementations
**Mitigation:**
- Rules focus on "must not" (no placeholders) vs "must be exactly"
- Allow multiple valid patterns (e.g., different error handling styles)
- Monitor for decreased code quality metrics

---

## Rollout Plan — Revised Strategy

### Phase 1 (v110): Tier 1 Implementation & Testing (1 day)
1. **Morning:** Implement Tier 1 (prompt restructuring, 2h)
   - Move rules to top with visual emphasis
   - Add footer checklist
   - No prompt size increase (restructure only)
2. **Afternoon:** Test on WO-787c6dd1 (30min)
   - Compare score vs baseline (65/100)
   - Target: 73-77/100
3. **Decision Point:**
   - If score ≥75/100 → Run batch test on 5 WOs, document success
   - If score <75/100 → Proceed to Phase 2 (Tier 3)

### Phase 2 (v110-v111): Tier 3 Implementation (2-3 days)
**Only if Tier 1 insufficient (<75/100)**

1. **Day 1 (4h):** Build completeness validator
   - Placeholder code detector (regex + AST)
   - Error handling checker (AST)
   - Test assertion checker (AST)
   - Input validation checker (AST)
   - Unit tests for validator

2. **Day 2 (3h):** Integration
   - Modify refinement loop
   - Add completeness check step
   - Build refinement prompts with violations
   - Update metadata types

3. **Day 3 (3h):** Testing & Validation
   - Test on WO-787c6dd1
   - Verify violations detected
   - Verify refinement fixes issues
   - Target: 85-92/100

### Phase 3 (v111-v112): Batch Validation (2-3 days)
1. **Day 1:** Run batch test on 10 WOs
2. **Day 2:** Analyze results, collect false positives
3. **Day 3:** Refine validator patterns if needed

### Phase 4 (Optional): Tier 2-Lite (0.5 day)
**Only if Phase 2+3 results <80/100**

1. Add 2-3 minimal examples (~500 tokens)
2. Test on 3 WOs
3. Measure marginal improvement

### Timeline Summary
- **Minimum Path:** 1 day (Tier 1 only, if successful)
- **Recommended Path:** 4 days (Tier 1 + Tier 3 + batch test)
- **Maximum Path:** 5 days (all tiers + tuning)

---

## Phase 2 Learning Integration

### Data Collection
**Completeness metadata** enables supervised learning:

```json
{
  "work_order_id": "787c6dd1...",
  "completeness_timeline": [
    {"cycle": 0, "score": 0.65, "violations": 12},
    {"cycle": 1, "score": 0.82, "violations": 5},
    {"cycle": 2, "score": 0.94, "violations": 1}
  ],
  "violation_patterns": [
    {"type": "placeholder_code", "location": "FocusManager.ts:3", "fixed_in_cycle": 1},
    {"type": "missing_error_handling", "location": "handlers.ts:5", "fixed_in_cycle": 2}
  ]
}
```

### Learning Signals
1. **Violation → Fix pairs** for few-shot prompt building
2. **Improvement rates** for proposer selection
3. **Recurring violations** for prompt enhancement
4. **Successful fix patterns** for automated refinement templates

### Feedback Loop
```
WO Execution
  → Completeness Validation
  → Violations Logged
  → Refinement Applied
  → Learning Data Stored
  → Proposer Prompts Updated
  → Next WO Benefits
```

---

## Conclusion

**Recommended Strategy: Tier 1 → Test → Tier 3**

**Phase 1 (Immediate):**
1. Implement Tier 1 only (2h) — Restructure existing prompt, zero bloat risk
2. Test on WO-787c6dd1 (30min)
3. Decision point:
   - Score ≥75/100 → Success, run batch test
   - Score <75/100 → Proceed to Tier 3

**Phase 2 (If Needed):**
1. Implement Tier 3 validator (10h) — Deterministic enforcement, high ROI
2. Test on WO-787c6dd1, target 85-92/100
3. Batch test on 10 WOs

**Tier 2 SKIPPED:**
- Prompt bloat risk (7200→8500 tokens) outweighs benefit
- Examples have lower ROI than validation
- Only add minimal Tier 2-Lite if both Tier 1+3 insufficient

**Expected Results:**
- **Best case:** Tier 1 alone reaches 75-77/100 (1 day effort)
- **Likely case:** Tier 1+3 reaches 85-92/100 (4 days effort)
- **Worst case:** All tiers reach 88-95/100 (5 days effort)

**Long-term Value:**
- Completeness validation provides rich metadata for Phase 2 supervised learning
- Violation → fix pairs enable automated prompt improvement
- Foundation for self-improving proposer system

---

**Version:** v109-revised
**Designer:** Claude Code (Sonnet 4.5)
**Date:** 2025-10-21
**Revision:** Removed Tier 2 due to prompt bloat risk, prioritized Tier 3 validation
**Status:** Ready for Implementation
