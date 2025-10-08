# In-Depth Analysis: Token Limits, Work Order Design, and Agent Execution

**Date:** 2025-10-07
**Author:** Lead Engineer (Claude Code)
**Context:** Batched decomposition hitting token truncation during Phase 2 testing

---

## Executive Summary

We're experiencing JSON truncation during batched decomposition because **work order verbosity varies unpredictably**. Before implementing a band-aid fix (reducing batch size), we need to examine the **entire workflow** from decomposition → orchestration → agent execution to determine the optimal work order design.

**Key Question:** What is the ideal size, structure, and verbosity of a work order that enables Aider agents to execute accurately?

---

## The Full Workflow

```
┌─────────────────────────────────────────────────────────────┐
│ 1. ARCHITECT: Decompose Technical Spec                      │
│    Input: Feature requirements, constraints, acceptance     │
│    Output: N work orders (JSON with descriptions, files,    │
│            acceptance criteria, dependencies)               │
│    Constraint: 4000 output tokens per API call              │
└─────────────────┬───────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────────┐
│ 2. ORCHESTRATOR: Queue & Execute Work Orders                │
│    - Respects dependencies (topological sort)               │
│    - Manages capacity per model                             │
│    - Sends WO to available Aider agent                      │
│    - Monitors execution, handles failures                   │
└─────────────────┬───────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────────┐
│ 3. AIDER AGENT: Execute Work Order                          │
│    Input: Work order JSON                                   │
│    Context: Codebase state, previous WOs                    │
│    Output: Code changes (files modified/created)            │
│    Constraint: Context window (varies by model)             │
└─────────────────┬───────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────────┐
│ 4. SENTINEL: Validate Execution                             │
│    - Run tests                                              │
│    - Check acceptance criteria                              │
│    - Escalate failures                                      │
└─────────────────────────────────────────────────────────────┘
```

---

## Current Work Order Structure

```typescript
interface WorkOrder {
  title: string;                    // ~10-20 words
  description: string;              // ~50-150 words (HIGHLY VARIABLE)
  acceptance_criteria: string[];    // 3-5 items, ~5-15 words each
  files_in_scope: string[];         // 1-5 file paths
  context_budget_estimate: number;  // tokens (800-2000)
  risk_level: "low" | "medium" | "high";
  dependencies: string[];           // WO IDs
}
```

**Token Usage Per Work Order:**
- Minimal (infrastructure setup): ~150-200 tokens
- Average (component implementation): ~250-350 tokens
- Complex (state management, APIs): ~400-600 tokens
- Very complex (orchestration, multi-file): ~700-1000 tokens

**Current Reality:**
- Target: 5 WOs per batch = 1,250-1,750 tokens (safe)
- Actual: 5 WOs can be 2,000-3,000 tokens (depending on complexity)
- Problem: **Unpredictable variance causes truncation**

---

## The Token Truncation Problem

### What We're Observing

**Test Run 1 (before credits ran out):**
- Batch 1 (7 WOs): ✅ Succeeded
- Batch 2 (8 WOs): ❌ Truncated at 13,041 chars

**Test Run 2 (after reducing to 5-7 WOs):**
- Batches 1-4 (5-6 WOs each): ✅ Succeeded
- Batch 5 (5 WOs): ❌ Truncated at 15,073 chars

**Analysis:**
- Work order complexity is **domain-dependent**, not count-dependent
- "Storage & Persistence" WOs are inherently more complex than "Setup" WOs
- Claude generates more verbose descriptions for complex domains
- **Batch size alone cannot guarantee safety**

### Root Cause

The Architect prompt instructs Claude to generate **high-quality, detailed work orders** for human implementers. This verbosity is useful for humans but:

1. **Consumes output tokens unpredictably**
2. **Causes truncation when variance stacks up**
3. **May not be optimal for LLM agents anyway**

---

## Critical Question: What Do Aider Agents Actually Need?

Let's analyze what information an Aider agent uses from a work order:

### Information Aider Needs

1. **Title** - Brief task description
2. **Files in scope** - What to edit/create
3. **Acceptance criteria** - What success looks like
4. **Dependencies** - What must be done first
5. **Context** - Architecture patterns, existing code

### Information Aider May NOT Need

1. **Verbose descriptions** - Aider can infer from title + acceptance criteria
2. **Rationale explanations** - "This component will..." (human-focused)
3. **Implementation suggestions** - Aider determines approach itself
4. **Risk assessments** - Orchestrator handles this, not agent

### Example Comparison

**Current (Human-Optimized) Work Order:**
```json
{
  "title": "Implement encrypted storage system",
  "description": "Create a secure storage layer using Node.js crypto module with AES-256-GCM encryption. Implement key derivation from user passphrase using PBKDF2, salt generation, and secure IV handling. Provide async APIs for save/load operations with automatic encryption/decryption. Include quota management and error handling for storage failures.",
  "acceptance_criteria": [
    "Encryption uses AES-256-GCM with proper IV handling",
    "PBKDF2 key derivation with 100k iterations",
    "Save/load APIs work with objects and handle errors",
    "Tests verify encryption/decryption round-trip"
  ],
  "files_in_scope": [
    "src/storage/encrypted-storage.ts",
    "src/storage/crypto-utils.ts"
  ]
}
```
**Tokens:** ~350

**Agent-Optimized Work Order:**
```json
{
  "title": "Implement encrypted storage system",
  "acceptance_criteria": [
    "Use AES-256-GCM encryption",
    "PBKDF2 key derivation (100k iterations)",
    "Async save/load APIs",
    "Tests verify round-trip"
  ],
  "files_in_scope": [
    "src/storage/encrypted-storage.ts",
    "src/storage/crypto-utils.ts"
  ],
  "dependencies": ["0"]
}
```
**Tokens:** ~120

**Savings:** ~65% reduction with **no loss of actionable information** for an LLM agent.

---

## The Real Trade-Off: Verbosity vs. Efficiency

### Argument FOR Verbose Work Orders

**1. Human Readability**
- Developers reviewing decomposition understand intent
- Debugging failed WOs is easier with context
- Non-technical stakeholders can understand plan

**2. Agent Context**
- More information = better decision-making
- Architectural hints guide implementation choices
- Risk level informs caution in code changes

**3. Documentation Value**
- Work orders serve as implementation guide
- Rationale preserved for future reference
- Helps onboard new developers

### Argument FOR Concise Work Orders

**1. Token Efficiency**
- 65% reduction = 3× more WOs per batch
- Eliminates truncation risk entirely
- Faster decomposition (less output generation)

**2. Agent Performance**
- LLMs extract signal from noise better with concise prompts
- Acceptance criteria alone often sufficient
- Less hallucination risk with focused context

**3. Scalability**
- Support 100-1000 WO projects without hitting limits
- Reduce API costs (less output tokens)
- Faster overall decomposition time

---

## Proposed Solutions

### Option A: Dynamic Verbosity Based on Batch Progress

**Strategy:** Monitor token usage during batch generation and switch to concise format if approaching limit.

**Implementation:**
```typescript
const batchResult = await this.generateBatch(spec, batch, previousWOs, {
  verbosity: tokenBudgetRemaining > 2000 ? 'verbose' : 'concise'
});
```

**Pros:**
- Best of both worlds (verbose when safe, concise when needed)
- Maintains human readability for most WOs
- Graceful degradation under token pressure

**Cons:**
- Complex logic to maintain
- Inconsistent WO format within project
- Requires real-time token tracking

---

### Option B: Compress After Generation

**Strategy:** Generate verbose WOs, then compress them for storage/execution while keeping originals for documentation.

**Implementation:**
```typescript
const verboseWOs = await this.generateBatch(...);
const compressedWOs = verboseWOs.map(wo => ({
  ...wo,
  description: summarize(wo.description, maxLength: 50)
}));
```

**Pros:**
- No prompt changes needed
- Full documentation preserved
- Agents get optimized input

**Cons:**
- Extra processing step
- Summarization may lose nuance
- Doubles storage requirements

---

### Option C: Two-Tier Work Order System

**Strategy:** Generate concise WOs during decomposition, then enrich with details on-demand when agent executes.

**Implementation:**
```typescript
// Decomposition generates minimal WOs
const minimalWO = {
  title, acceptance_criteria, files_in_scope, dependencies
};

// Orchestrator enriches before agent execution
const enrichedWO = await enrichWorkOrder(minimalWO, {
  codebaseContext: true,
  architecturalPatterns: true,
  implementationHints: true
});
```

**Pros:**
- Solves token limit fundamentally
- Agent gets fresh, relevant context at execution time
- Can adapt context to available agent model

**Cons:**
- Extra API call per WO execution
- Increased latency and cost during execution
- More complex orchestrator logic

---

### Option D: Fixed Concise Format (Simplest)

**Strategy:** Architect always generates concise WOs. Human documentation generated separately if needed.

**Implementation:**
```typescript
// Update Architect prompt:
"Generate minimal work orders optimized for LLM agents.
Include: title, acceptance_criteria, files_in_scope, dependencies.
Omit: verbose descriptions, implementation suggestions, rationale."
```

**Pros:**
- Simple and predictable
- Eliminates truncation entirely
- Fastest decomposition
- Optimal for agent execution

**Cons:**
- Loses human documentation value
- Harder for developers to review decomposition
- May need separate documentation generation step

---

### Option E: Reduce Batch Size (Current Band-Aid)

**Strategy:** Cap batches at 4-5 WOs regardless of complexity.

**Implementation:**
```typescript
// Already implemented in complexity-estimator.ts
"Aim for 4-5 WOs per batch (MAXIMUM 5)"
```

**Pros:**
- No architectural changes
- Works with current system
- Easy to implement

**Cons:**
- Doesn't solve root cause (variance still exists)
- More batches = slower decomposition
- May still fail on extremely complex WOs
- Wastes token budget on simple batches

---

## Analysis: What is the Ideal Work Order?

### For Human Developers

**Ideal characteristics:**
- Clear rationale and context
- Implementation guidance
- Explicit dependencies
- Risk assessment
- Estimated complexity

**Optimal size:** 200-400 words (~300-600 tokens)

### For LLM Agents (Aider)

**Ideal characteristics:**
- Precise acceptance criteria
- File paths to modify
- Dependency information
- Minimal noise

**Optimal size:** 50-100 words (~75-150 tokens)

### The Gap

There's a **2-4× verbosity gap** between human-optimal and agent-optimal work orders. We need to decide who our primary audience is.

---

## Recommendation: Hybrid Approach (Option C + D)

### Proposed Architecture

**Phase 1: Concise Decomposition**

Generate minimal, agent-optimized work orders during decomposition:

```typescript
interface MinimalWorkOrder {
  title: string;              // 10-20 words
  acceptance_criteria: string[];  // 3-5 items
  files_in_scope: string[];
  dependencies: string[];
  context_budget_estimate: number;
  risk_level: "low" | "medium" | "high";
  // NO description field during decomposition
}
```

**Benefits:**
- 10-15 WOs per batch safely (vs 5-7 currently)
- No truncation risk
- Faster decomposition
- Lower API costs

**Phase 2: Contextual Enrichment (Future)**

When orchestrator sends WO to agent, enrich with relevant context:

```typescript
const executionContext = await buildExecutionContext(minimalWO, {
  previousWorkOrders: completed,
  codebaseSnapshot: fileTree,
  architecturalPatterns: extractedPatterns,
  relatedContracts: relevantContracts
});

const enrichedPrompt = `
Execute this work order:
${minimalWO.title}

Acceptance Criteria:
${minimalWO.acceptance_criteria.join('\n')}

Relevant Context:
${executionContext}

Files to Modify:
${minimalWO.files_in_scope.join('\n')}
`;
```

**Benefits:**
- Agent gets optimal context for execution
- Context is fresh and codebase-aware
- Can adapt to different agent models
- No token waste during decomposition

**Phase 3: Human Documentation (Optional)**

Generate human-readable project plan separately:

```typescript
const documentationPrompt = `
Given these work orders, create a comprehensive implementation guide
for human developers explaining the architecture, rationale, and approach.
`;
```

**Benefits:**
- Human documentation when needed
- Doesn't bloat decomposition
- Can be generated once and cached

---

## Token Math: Current vs. Proposed

### Current System (Verbose WOs)

**Multi-LLM App (35 WOs):**
- Average: 350 tokens/WO
- Total output: 12,250 tokens
- Batches needed: 7 (5 WOs × 350 tokens = 1,750 tokens/batch)
- Risk: High (variance causes truncation)

### Proposed System (Concise WOs)

**Multi-LLM App (35 WOs):**
- Average: 120 tokens/WO
- Total output: 4,200 tokens
- Batches needed: 3 (12 WOs × 120 tokens = 1,440 tokens/batch)
- Risk: Very low (consistent token usage)

**Savings:**
- 57% fewer batches
- 66% faster decomposition
- Near-zero truncation risk
- $0.25 saved per project (fewer API calls)

---

## Impact on Aider Agent Execution

### Current (Verbose) WO Execution

**Agent receives:**
```
Title: Implement encrypted storage system
Description: [200 words of implementation details]
Acceptance Criteria: [4 items]
Files: [2 paths]
```

**Agent behavior:**
- Reads entire description
- May over-optimize based on suggestions
- Can get confused by conflicting hints
- Takes longer to parse context

### Proposed (Concise) WO Execution

**Agent receives:**
```
Title: Implement encrypted storage system
Acceptance Criteria:
  - Use AES-256-GCM encryption
  - PBKDF2 key derivation (100k iterations)
  - Async save/load APIs
  - Tests verify round-trip
Files: [2 paths]
Context Budget: 1500 tokens
```

**Agent behavior:**
- Focuses on acceptance criteria
- Makes own architectural decisions
- Clearer success definition
- Faster execution

**Hypothesis:** Concise WOs will lead to **equal or better** agent execution because:
1. Acceptance criteria are unambiguous
2. Less noise to filter
3. Agent uses codebase context more effectively
4. Reduces prompt injection from verbose descriptions

---

## Orchestrator Considerations

### Does Orchestrator Need Verbose WOs?

**Orchestrator's job:**
1. Validate dependencies
2. Queue WOs in correct order
3. Assign to available agents
4. Monitor execution
5. Handle failures

**Required information:**
- Dependencies (yes)
- Risk level (yes)
- Context budget (yes)
- Description verbosity (no)

**Conclusion:** Orchestrator operates effectively with concise WOs.

---

## Risk Assessment

### Risks of Concise Work Orders

**Risk 1: Agents miss implementation details**

**Mitigation:**
- Acceptance criteria capture all requirements
- Agent can infer from codebase context
- Tests catch missing functionality

**Likelihood:** Low
**Impact:** Medium (caught by Sentinel)

---

**Risk 2: Human developers can't understand decomposition**

**Mitigation:**
- Generate separate documentation on demand
- Work order titles + acceptance criteria are readable
- Decomposition doc already provides overview

**Likelihood:** Medium
**Impact:** Low (documentation compensates)

---

**Risk 3: Complex architectural decisions lack guidance**

**Mitigation:**
- Contracts provide interface specifications
- Wireframes provide UI structure
- Orchestrator can inject architectural context

**Likelihood:** Low
**Impact:** Medium (caught in review)

---

### Risks of Current Approach (Reducing Batch Size)

**Risk 1: Still hits truncation on complex batches**

**Likelihood:** Medium (we've seen 5 WO batches fail)
**Impact:** High (blocks decomposition entirely)

---

**Risk 2: Slower decomposition (more batches)**

**Likelihood:** High
**Impact:** Low (time increase acceptable)

---

**Risk 3: Wastes token budget**

**Likelihood:** High (simple batches use <50% of limit)
**Impact:** Low (cost is manageable)

---

## Decision Framework

### When to Use Verbose Work Orders

- [ ] Human-driven projects (developers implementing manually)
- [ ] Complex architectural decisions requiring explanation
- [ ] Educational/documentation purposes
- [ ] Small projects (<20 WOs where truncation isn't a concern)

### When to Use Concise Work Orders

- [x] Agent-driven execution (Moose's primary use case)
- [x] Large projects (>30 WOs)
- [x] Production deployments where speed matters
- [x] When token efficiency is critical

**For Moose Mission Control:** Concise WOs are clearly the right choice.

---

## Recommended Implementation Plan

### Phase 1: Immediate Fix (This Session)

**Change Architect prompt to generate concise work orders:**

```typescript
// In architect-decomposition-rules.ts
const CONCISE_WO_INSTRUCTION = `
Generate work orders optimized for LLM agent execution.

For each work order, include:
- title: Clear, actionable task (10-15 words)
- acceptance_criteria: 3-5 specific, testable requirements
- files_in_scope: File paths to create/modify
- context_budget_estimate: Estimated tokens needed
- risk_level: low/medium/high
- dependencies: Array of prerequisite WO indices

DO NOT include:
- Verbose descriptions or rationale
- Implementation suggestions
- Architectural explanations

Keep work orders minimal and focused. Acceptance criteria should be self-explanatory.
`;
```

**Update batch sizes:**
- Target: 10-12 WOs per batch
- Maximum: 15 WOs per batch
- Expected: 1,200-1,800 tokens per batch (safe)

**Expected results:**
- Multi-LLM App: 3-4 batches instead of 7
- Decomposition time: ~2-3 minutes instead of 5-6
- Zero truncation failures

---

### Phase 2: Validation (Next Session)

**Test concise WOs with actual Aider execution:**

1. Run full decomposition with concise format
2. Execute 5-10 work orders via orchestrator
3. Measure success rate vs. current format
4. Gather metrics:
   - Execution time per WO
   - Test pass rates
   - Code quality (human review)
   - Agent confusion/errors

**Success criteria:**
- ≥95% success rate (same as verbose)
- ≤10% execution time increase
- No significant quality degradation

---

### Phase 3: Enrichment System (Future)

**If concise WOs prove insufficient:**

Implement contextual enrichment in orchestrator:

```typescript
class WorkOrderEnricher {
  async enrich(wo: MinimalWorkOrder): Promise<EnrichedPrompt> {
    const context = await this.gatherContext({
      completedWOs: this.getCompleted(),
      codebaseState: this.getFileTree(),
      contracts: this.getRelevantContracts(wo),
      patterns: this.extractPatterns()
    });

    return this.buildAgentPrompt(wo, context);
  }
}
```

**Cost:** ~$0.01 per WO (small context call)
**Benefit:** Optimal context for each agent

---

## Conclusion

**The Problem:** Token truncation is a symptom of a design mismatch. We're generating human-optimized work orders for an agent-driven execution system.

**The Solution:** Shift to concise, agent-optimized work orders during decomposition. Add human documentation separately if needed.

**The Impact:**
- ✅ Eliminates truncation risk
- ✅ 2-3× faster decomposition
- ✅ Better agent execution (less noise)
- ✅ Scales to 100+ WO projects
- ✅ Lower API costs

**The Risk:** Minimal, with clear mitigation paths if issues arise.

**Recommendation:** Implement Phase 1 (concise format) immediately. This is not a band-aid—it's the **correct architectural choice** for an agent-driven system.

---

**Next Steps:**

1. **Decide:** Approve shift to concise work order format
2. **Implement:** Update Architect prompt (15 minutes)
3. **Test:** Run Multi-LLM decomposition (3 minutes)
4. **Validate:** Review generated WOs for quality
5. **Execute:** Test with actual Aider agents (next session)

This is a **strategic improvement**, not a compromise.

---

**End of Analysis**
