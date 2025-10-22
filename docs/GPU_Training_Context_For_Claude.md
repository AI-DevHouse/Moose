# GPU-Accelerated Training Context for 4o-mini Proposer

**Date:** 2025-10-20
**Purpose:** Context document for exploring external GPU training approach to improve proposer code quality
**Target Audience:** Claude (main UI) for brainstorming and technical design

---

## Executive Summary

Moose Mission Control's infrastructure works perfectly (15-concurrent execution, 26× performance improvement), but the code it generates is production-blocking. 20/20 work orders failed acceptance validation with an average score of 3.02/10 (target: >6/10), 100% build failures, and skeletal implementations. The bottleneck is the **gpt-4o-mini proposer** generating low-quality code.

**Proposed Solution:** Train gpt-4o-mini externally using GPU acceleration to run more iterations faster, then integrate the improved model back into the system.

---

## 1. THE PROBLEM: Code Quality Crisis

### Test Results (Session v107, 20 Work Orders)

**Acceptance Scores:**
- Average Overall: **3.02/10** (Target: >6/10) ❌
- Pass Rate: **0%** (0/20 WOs scored ≥7/10) ❌

**Dimension Breakdown:**
```
Architecture:     5.0/10   (Mediocre - structure exists but poor)
Readability:      8.25/10  ✅ (GOOD - code is readable)
Completeness:     2.0/10   ❌ (CRITICAL - skeletal implementations)
Test Coverage:    0.0/10   ❌ (NONE - no tests written)
Build Success:    0.0/10   ❌ (ALL FAILED - every PR breaks builds)
```

### Key Observations

1. **Proposer generates incomplete code** - Completeness score of 2.0/10 suggests it creates file stubs and function signatures but doesn't implement functionality
2. **No test generation** - Despite instructions, zero test coverage across all WOs
3. **Build failures are systematic** - 100% failure rate indicates missing imports, undefined variables, or broken dependencies
4. **Readability is good** - 8.25/10 suggests the code that exists is well-formatted and clear, just incomplete

### Hypothesis

The proposer (gpt-4o-mini) is:
- Not following instructions completely (skips implementation details)
- Generating code too quickly without reasoning through dependencies
- Lacking sufficient context about project structure
- Not self-correcting build errors during refinement cycles

---

## 2. SYSTEM ARCHITECTURE

### High-Level Flow

```
User uploads TechnicalSpec
    ↓
Architect Agent (Claude Sonnet 4.5) decomposes into Work Orders
    ↓
WorkOrderPoller queries approved WOs from Supabase
    ↓
ManagerCoordinator routes to Proposer based on complexity
    ↓
ProposerExecutor calls gpt-4o-mini or Claude Sonnet 4.5
    ↓
    [PROPOSER GENERATES CODE HERE - THIS IS THE PROBLEM]
    ↓
Self-refinement (2 cycles max, checks for quality issues)
    ↓
AiderExecutor applies code via Aider CLI
    ↓
GitHubIntegration creates PR
    ↓
AcceptanceValidator scores the PR (5 dimensions)
    ↓
Status: completed (≥7/10) or needs_review (<7/10)
```

### Current Proposer Configuration

**Location:** `src/lib/proposer-registry.ts`

```typescript
{
  id: '0a78af6a-bfce-4897-8565-0f8700fb06eb',
  name: 'gpt-4o-mini',
  model: 'gpt-4o-mini',
  provider: 'openai',
  complexity_threshold: 3,  // Handles "simple" tasks (1-3)
  aider_model: 'gpt-4o-mini',
  cost_per_1m_input: 0.15,
  cost_per_1m_output: 0.60
}
```

**Routing Logic:**
- Complexity 1-3 (60% of tasks): gpt-4o-mini
- Complexity 4-7 (30% of tasks): Claude Sonnet 4.5
- Complexity 8-10 (10% of tasks): Claude Sonnet 4.5

**Performance:**
- gpt-4o-mini: ~$0.02/WO, 30s avg execution
- Claude Sonnet 4.5: ~$0.15/WO, 60s avg execution

### Proposer System Prompt (Key Excerpts)

**Location:** `src/lib/proposer-system-prompts.ts`

The proposer receives:
1. Work order title, description, acceptance criteria
2. File tree of target project
3. Dependency analysis (external packages needed)
4. Routing decision rationale
5. Contract/wireframe (if applicable)

**Instructions include:**
- "Generate complete, production-ready implementations"
- "Include comprehensive error handling"
- "Write tests for all new functionality"
- "Ensure code builds without errors"
- "Follow project conventions and style"

**Self-Refinement Rules:** `src/lib/proposer-refinement-rules.ts`

After generation, the system checks for:
- Contract violations (missing required interfaces)
- TODO/FIXME comments (incomplete work)
- Console.log statements (debug code left in)
- Missing error handling
- Build/type errors

If issues found → trigger refinement cycle (max 2 cycles).

### Why Self-Refinement Isn't Working

Current hypothesis:
1. **Refinement is too shallow** - It only checks for obvious markers (TODOs, console.logs) but doesn't validate actual functionality
2. **No build validation** - System doesn't run `npm run build` during refinement, so type errors go undetected until acceptance phase
3. **No execution testing** - Code is never run or tested before being committed
4. **Context loss** - Each refinement cycle loses some context, making it harder to fix complex issues

---

## 3. PLANNED PHASE 2: Supervised Learning (Original Design)

### Goal

Iteratively improve proposer quality through human-supervised feedback loops until acceptance scores reach >7/10 average.

### Planned Components

**Database Schema Extensions:**
```sql
-- Track learning samples
complexity_learning_samples (
  id uuid,
  work_order_id uuid,
  complexity_score integer,
  actual_difficulty integer,  -- human rating
  features jsonb,              -- code metrics
  created_at timestamp
)

-- Track routing decisions
routing_decisions (
  id uuid,
  work_order_id uuid,
  proposed_route text,
  actual_route text,
  confidence float,
  created_at timestamp
)
```

**Scripts (Not Yet Implemented):**
1. `cleanup-iteration.ts` - Reset DB, close PRs, clean branches
2. `run-iteration.ts` - Execute full test cycle (init → execute → test)
3. `score-iteration.ts` - Run acceptance validation on all WOs
4. `supervised-loop.ts` - Main orchestrator:
   ```
   Loop:
     1. Run iteration (5-10 WOs)
     2. Score results
     3. Analyze failures (IterationAnalyzer)
     4. Generate improvement proposals (ProposalGenerator)
     5. Human reviews proposals
     6. Apply approved changes to proposer prompt/rules
     7. Repeat until >7/10 avg score achieved
   ```

**IterationAnalyzer** (Planned):
- Identify patterns in failures (common missing imports, typical errors)
- Classify failure types (build errors, missing tests, incomplete logic)
- Generate root cause hypotheses

**ProposalGenerator** (Planned):
- Suggest specific prompt changes ("Add instruction: 'Always import React'")
- Recommend refinement rule additions ("Check for missing return statements")
- Propose complexity threshold adjustments

### Why External GPU Training Makes Sense

**Original Plan Issues:**
1. **Slow iteration** - Each iteration takes ~30-60 minutes (pool init, execution, validation)
2. **Limited samples** - Only 5-10 WOs per iteration = slow learning
3. **System coupling** - Changes require redeploying entire orchestrator
4. **Human bottleneck** - Requires human approval between each iteration

**GPU Training Advantages:**
1. **Faster iterations** - Train on thousands of samples in hours vs. days
2. **Batch processing** - Test many prompt variations simultaneously
3. **Isolated experimentation** - No risk to production system
4. **Richer dataset** - Can use synthetic data, public repos, or previous runs

---

## 4. CURRENT SYSTEM CAPABILITIES

### What Works Perfectly ✅

1. **Worktree Pool** - 15-concurrent execution, 26× faster initialization (57s vs 25min)
2. **Extraction Validator** - 0 validation errors, handles markdown-wrapped code perfectly
3. **Acceptance Validator** - 5-dimension scoring (Architecture, Readability, Completeness, Test Coverage, Build Success)
4. **PR Creation** - Automated GitHub integration, closes/reopens, branch management
5. **Infrastructure** - Supabase database, work order lifecycle, dependency resolution, polling

### What's Available for Training

**Historical Data:**
- 57 pending WOs in database (various complexity levels)
- Session logs from v65-v107 (43 sessions archived)
- Previous test runs with acceptance scores
- GitHub PRs with actual code generated

**Acceptance Validation Results:**
- Structured JSON output for each WO:
  ```json
  {
    "acceptance_score": 3.02,
    "dimension_scores": {
      "architecture": 5,
      "readability": 8,
      "completeness": 2,
      "test_coverage": 0,
      "build_success": 0
    },
    "build_passed": false,
    "tests_passed": false,
    "todo_count": 1,
    "lint_errors": 0
  }
  ```

**System Prompt & Rules:**
- Current proposer system prompt (src/lib/proposer-system-prompts.ts)
- Refinement rules (src/lib/proposer-refinement-rules.ts)
- Proposer registry configuration (src/lib/proposer-registry.ts)

### Database Schema (Relevant Tables)

```sql
-- Work orders with full metadata
work_orders (
  id uuid PRIMARY KEY,
  title text,
  description text,
  acceptance_criteria text[],
  complexity_score integer,      -- 1-10 rating
  status text,                   -- pending/approved/in_progress/completed/failed
  github_pr_url text,
  github_pr_number integer,
  acceptance_result jsonb,       -- Full validation scores
  actual_cost decimal,
  metadata jsonb                 -- Routing decisions, refinement history
)

-- Projects (target codebases)
projects (
  id uuid PRIMARY KEY,
  name text,
  github_org text,
  github_repo_name text,
  local_path text,
  language text,
  framework text
)

-- Proposers (LLM configurations)
proposers (
  id uuid PRIMARY KEY,
  name text,
  model text,
  provider text,
  complexity_threshold integer,
  system_prompt_template text,  -- Could store trained prompts here
  active boolean
)
```

---

## 5. TECHNICAL CONSTRAINTS & CONSIDERATIONS

### Model Limitations

**gpt-4o-mini:**
- Context window: 128K tokens
- Training cutoff: October 2023
- Cannot be fine-tuned via OpenAI API (no longer supported)
- Must rely on prompt engineering + few-shot examples

**Alternative: Claude Sonnet 4.5**
- Currently used for complex tasks (4-7 complexity)
- More expensive but higher quality
- Could train gpt-4o-mini to match Claude's performance on simple tasks

### System Integration Points

**Where trained model would plug in:**
1. **Proposer Registry** (`src/lib/proposer-registry.ts`) - Add new proposer entry with improved prompt
2. **System Prompt** (`src/lib/proposer-system-prompts.ts`) - Replace with trained prompt
3. **Refinement Rules** (`src/lib/proposer-refinement-rules.ts`) - Add learned validation rules
4. **Routing Logic** (`src/lib/orchestrator/manager-coordinator.ts`) - Adjust complexity thresholds

**No code changes needed** - System already supports:
- Multiple proposers with different configurations
- Dynamic prompt templates via database
- A/B testing (route subset of WOs to new proposer)

### Current Prompt Structure

**User Message Format:**
```
Work Order: [title]

Description:
[full description]

Acceptance Criteria:
1. [criterion 1]
2. [criterion 2]
...

Project Context:
[file tree, dependencies, routing decision]

Generate production-ready code that satisfies all acceptance criteria.
```

**System Message** (simplified):
```
You are an expert software engineer generating production code.

Guidelines:
- Write complete implementations (no TODOs)
- Include comprehensive error handling
- Write tests for all functionality
- Follow project conventions
- Ensure code builds without errors
- Use proper TypeScript types

Output format:
Provide code in markdown fences with file paths as headers.
```

---

## 6. GPU TRAINING APPROACH (PROPOSED)

### Hypothesis

By training gpt-4o-mini externally on a GPU with:
1. **More iterations** - 1000+ training examples vs. 5-10 per iteration in-system
2. **Faster feedback** - Seconds per iteration vs. 30-60 minutes
3. **Richer supervision** - Detailed error analysis, build logs, diff comparisons
4. **Prompt optimization** - Automated search over prompt variations

We can achieve >7/10 acceptance scores without modifying the core system.

### Training Data Sources

**Option 1: Synthetic Generation**
- Generate work orders for common patterns (CRUD operations, API endpoints, UI components)
- Use Claude Sonnet 4.5 to create "gold standard" implementations
- Train gpt-4o-mini to match Claude's output

**Option 2: Historical Runs**
- Use 20 failed WOs from v107 as negative examples
- Extract successful WOs from earlier sessions as positive examples
- Build dataset of (work_order, code, acceptance_score) tuples

**Option 3: Public Repositories**
- Extract work orders from GitHub issues/PRs
- Use actual merged code as training targets
- Focus on TypeScript/React projects similar to target domain

### Evaluation Metrics

**During Training:**
- Perplexity on held-out work orders
- Build success rate (run `npm run build` on generated code)
- Test coverage percentage
- Completeness score (manual or automated analysis)

**Post-Integration:**
- Acceptance score distribution (target: >7/10 avg)
- Pass rate (target: >70% of WOs score ≥7/10)
- Build failure rate (target: <20%)
- Cost per WO (maintain <$0.05)

### Integration Strategy

**Phase 1: Offline Validation**
1. Train improved prompt on GPU
2. Run through 10-20 test WOs locally
3. Measure acceptance scores without system integration
4. Iterate until >7/10 avg achieved

**Phase 2: A/B Testing**
1. Add new proposer to registry as "gpt-4o-mini-v2"
2. Route 20% of WOs to new proposer
3. Compare acceptance scores: old vs. new
4. If new > old + 2 points → full rollout

**Phase 3: Full Deployment**
1. Replace default gpt-4o-mini configuration
2. Monitor acceptance scores over 50+ WOs
3. Revert if scores drop below 6/10
4. Continue refinement if needed

---

## 7. OPEN QUESTIONS FOR CLAUDE

### Training Approach

1. **Prompt Engineering vs. Fine-Tuning**
   - Since gpt-4o-mini can't be fine-tuned via API, should we focus on optimal prompts?
   - Can we simulate fine-tuning effects with retrieval-augmented generation (RAG)?
   - Should we use few-shot examples (5-10 examples in prompt) vs. zero-shot?

2. **Dataset Construction**
   - What's the minimum dataset size for meaningful prompt improvement? (100? 1000?)
   - How do we balance positive examples (good code) vs. negative examples (failures)?
   - Should we weight by acceptance dimension (e.g., focus on completeness since it's lowest)?

3. **GPU Acceleration**
   - What GPU setup is needed for fast iteration on 128K context models?
   - Can we use existing frameworks (HuggingFace, LangChain) or need custom code?
   - How do we parallelize prompt evaluation across multiple work orders?

### Evaluation & Metrics

4. **Acceptance Score Proxies**
   - Can we approximate acceptance scoring without full system integration?
   - What lightweight checks predict build success (static analysis, type checking)?
   - How do we measure "completeness" without human review?

5. **Build Validation**
   - Should we run `npm run build` as part of training feedback loop?
   - How do we handle long build times (30s-2min per WO)?
   - Can we cache build results or use incremental compilation?

### Integration

6. **Backward Compatibility**
   - How do we ensure new prompts work with existing system architecture?
   - Should we version proposer configurations in database?
   - What's the rollback strategy if trained model performs worse?

7. **Cost Optimization**
   - Current: gpt-4o-mini ~$0.02/WO, Claude Sonnet 4.5 ~$0.15/WO
   - Target: Keep gpt-4o-mini under $0.05/WO while improving quality
   - Trade-off: Longer prompts (few-shot examples) vs. quality improvement

### Iterative Improvement

8. **Feedback Loop Design**
   - How many training iterations before diminishing returns?
   - Should we retrain periodically as system evolves?
   - Can we automate proposal generation (no human in loop)?

9. **Domain Adaptation**
   - Current system targets TypeScript/React/Next.js projects
   - How do we generalize to other languages/frameworks?
   - Should we train separate proposers per domain?

---

## 8. SUCCESS CRITERIA

### Minimum Viable Improvement

- Average acceptance score: **>6/10** (current: 3.02/10)
- Pass rate: **>50%** (current: 0%)
- Build success rate: **>80%** (current: 0%)
- Cost per WO: **<$0.05** (current: ~$0.02)

### Stretch Goals

- Average acceptance score: **>7/10**
- Pass rate: **>70%**
- Build success rate: **>90%**
- Match Claude Sonnet 4.5 quality at 1/7th the cost

### Timeline

- **Week 1:** Dataset construction + training infrastructure setup
- **Week 2:** Prompt optimization + offline evaluation
- **Week 3:** System integration + A/B testing
- **Week 4:** Full deployment + monitoring

---

## 9. RELEVANT FILE PATHS

### Configuration
- `src/lib/proposer-registry.ts` - Proposer definitions
- `src/lib/proposer-system-prompts.ts` - System prompts
- `src/lib/proposer-refinement-rules.ts` - Validation rules
- `.env.local` - API keys, model configurations

### Orchestrator
- `src/lib/orchestrator/orchestrator-service.ts` - Main pipeline
- `src/lib/orchestrator/manager-coordinator.ts` - Routing logic
- `src/lib/orchestrator/proposer-executor.ts` - LLM invocation
- `src/lib/enhanced-proposer-service.ts` - Self-refinement logic

### Validation
- `src/lib/acceptance-validator.ts` - 5-dimension scoring
- `src/lib/extraction-validator.ts` - Code extraction from markdown
- `src/lib/iteration-scorer.ts` - Quality rubrics (planned)

### Database
- `supabase/migrations/` - Schema definitions
- Migration files show evolution of work_orders, proposers tables

### Scripts
- `scripts/check-acceptance-results.ts` - Query acceptance scores
- `scripts/monitor-execution.ts` - Real-time execution monitoring
- `scripts/full-system-reset.ts` - Clean up test runs

### Documentation
- `docs/session_updates/SOURCE_OF_TRUTH_Moose_Workflow.md` - Complete system architecture
- `docs/session_updates/PRODUCTION_READINESS_ASSESSMENT_20251017.md` - Production gaps analysis
- `docs/session_updates/TECHNICAL_PLAN_Learning_System.md` - Original Phase 2 design

---

## 10. CURRENT SYSTEM STATE

**Infrastructure:** Production-ready ✅
- 15-concurrent execution validated
- Worktree pool optimization complete (26× faster)
- Extraction validation working perfectly (0 errors)
- Acceptance validation framework operational

**Code Quality:** Production-blocking ❌
- 0% acceptance pass rate
- 100% build failure rate
- Completeness score 2.0/10 (skeletal implementations)

**Next Action:** Improve gpt-4o-mini proposer quality to unblock production deployment.

**Recommendation:** External GPU training is the fastest path to production-ready code quality.

---

## APPENDIX: Example Work Order

**Title:** Add TypeScript strict mode configuration

**Description:**
Enable TypeScript strict mode in the project to catch more type errors during development. Update tsconfig.json with strict compiler options and fix any type errors that arise.

**Acceptance Criteria:**
1. tsconfig.json has "strict": true enabled
2. All strict mode sub-options are explicitly configured
3. No TypeScript errors after enabling strict mode
4. Build passes successfully
5. Existing tests continue to pass

**Project Context:**
- TypeScript 5.x
- Next.js 14.x
- ~50 source files
- Existing tsconfig.json with some strict options

**gpt-4o-mini Generated (v107):**
```typescript
// tsconfig.json
{
  "compilerOptions": {
    "strict": true,
    // TODO: Add other strict options
  }
}
```

**Acceptance Result:**
- Overall: 3.3/10
- Completeness: 2/10 (only added "strict": true, missing explicit sub-options)
- Build Success: 0/10 (didn't fix type errors that arose)
- Test Coverage: 0/10 (no tests)

**Expected Output (Claude Sonnet 4.5 quality):**
```typescript
// tsconfig.json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "strictFunctionTypes": true,
    "strictBindCallApply": true,
    "strictPropertyInitialization": true,
    "noImplicitThis": true,
    "alwaysStrict": true
  }
}
```
Plus:
- Fix ~10 type errors in existing files
- Add types to previously untyped functions
- Update test files with proper types
- Verify build passes
- Document breaking changes in PR description

---

**End of Context Document**
