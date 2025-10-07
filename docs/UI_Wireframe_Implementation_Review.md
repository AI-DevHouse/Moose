# UI Wireframe Generation - Technical Review and Implementation Plan

**Date:** 2025-10-07
**Reviewer:** Claude (Sonnet 4.5)
**Document Reviewed:** `UI Capability Addition to Architect (1).txt`

---

## Executive Summary

**VERDICT: ✅ VIABLE WITH MODIFICATIONS**

The proposed wireframe generation service is architecturally sound and aligns well with our current codebase. However, the suggested implementation contains several mismatches with our actual architecture that need correction. This document provides a corrected implementation plan that maintains the core concept while adapting to our existing patterns.

**Key Changes Required:**
1. Move service from `src/services/` → `src/lib/` (no services directory exists)
2. Simplify types (no "Feature" entity exists - we use WorkOrder directly)
3. Adapt to simpler decomposition model (we don't have hierarchical features)
4. Use existing API patterns (Next.js API routes)
5. Node.js compatibility fixes (fs/promises usage in serverless environment)

---

## Architecture Analysis

### ✅ What Works Well

1. **Core Concept**: Using Claude API to generate React component wireframes is solid
2. **Anthropic SDK Integration**: We already use `@anthropic-ai/sdk` v0.65.0
3. **File-based Storage**: Saving to `docs/wireframes/` is appropriate for our needs
4. **Manifest Tracking**: Good pattern for managing generated artifacts
5. **Cost Tracking**: Aligns with our existing budget enforcement in Manager
6. **Type Safety**: TypeScript-first approach matches our codebase standards

### ⚠️ Architecture Mismatches

#### 1. **Directory Structure**
**Proposed:**
```
src/services/WireframeGenerationService.ts
```

**Reality:**
```
src/lib/
├── architect-service.ts
├── manager-service.ts
├── director-service.ts
└── client-manager-service.ts
```

**Fix:** Use `src/lib/wireframe-service.ts` instead.

---

#### 2. **Type Model Mismatch**

**Proposed:**
```typescript
export interface Feature {
  feature_id: string;
  title: string;
  wireframes?: WireframeResult[];
  // ... lots of fields we don't have
}
```

**Reality:**
```typescript
// src/types/architect.ts
export interface WorkOrder {
  title: string;
  description: string;
  acceptance_criteria: string[];
  files_in_scope: string[];
  context_budget_estimate: number;
  risk_level: "low" | "medium" | "high";
  dependencies: string[];
}

export interface DecompositionOutput {
  work_orders: WorkOrder[];
  decomposition_doc: string;
  total_estimated_cost: number;
}
```

**Key Difference:** We don't have "features" - Architect directly outputs WorkOrders. The proposed implementation assumes a hierarchical decomposition (spec → features → work orders) that doesn't exist in our system.

**Fix:** Attach wireframes at the WorkOrder level, not Feature level.

---

#### 3. **Decomposition Flow Misunderstanding**

**Proposed Flow:**
```
Architect.decomposeIntoFeatures()
  → Detect UI features
  → Generate wireframes for features
  → Create work orders from features
```

**Actual Flow:**
```
ArchitectService.decomposeSpec()
  → Call Claude API with prompt
  → Parse JSON response into WorkOrders
  → Validate WorkOrders
  → Return DecompositionOutput
```

**Reality:** Our Architect is **prompt-based**, not code-based. It doesn't have complex JavaScript logic for "detecting UI features" - it's a single LLM call that returns a JSON structure.

**Fix:** Wireframe generation needs to happen either:
- **Option A:** BEFORE decomposition (analyze spec, generate wireframes, inject into Architect prompt)
- **Option B:** AFTER decomposition (parse WorkOrders, detect UI tasks, generate wireframes, attach metadata)

---

#### 4. **File System Incompatibility**

**Proposed:**
```typescript
import * as fs from 'fs/promises';

async initialize() {
  await fs.mkdir(this.wireframesDir, { recursive: true });
  await fs.writeFile(filePath, code, 'utf-8');
}
```

**Problem:** Our app is deployed on **Vercel serverless**, which has:
- Read-only file system (can't write to local disk)
- No persistent storage between invocations
- 50MB deployment size limit

**Fix:** Store wireframes in:
1. **Supabase Storage** (preferred - we already use Supabase)
2. **Database JSONB field** (for metadata + code)
3. **GitHub repo** (as .tsx files via API)

---

## Recommended Implementation

### Phase 1: Core Wireframe Service (Simplified)

**File:** `src/lib/wireframe-service.ts`

```typescript
import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@supabase/supabase-js';

export interface WireframeRequest {
  component_name: string;
  work_order_title: string;  // Changed from feature_id
  description: string;        // From WorkOrder.description
  files_in_scope: string[];   // From WorkOrder.files_in_scope
}

export interface WireframeResult {
  component_name: string;
  code: string;
  tokens_used: number;
  cost: number;
  generated_at: string;
}

export class WireframeService {
  private anthropic: Anthropic;
  private supabase: ReturnType<typeof createClient>;

  constructor() {
    this.anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY!
    });
    this.supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
  }

  async generateWireframe(request: WireframeRequest): Promise<WireframeResult> {
    const prompt = this.buildPrompt(request);

    const response = await this.anthropic.messages.create({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 8000,
      messages: [{ role: 'user', content: prompt }]
    });

    const code = this.extractCodeBlock(
      response.content[0].type === 'text' ? response.content[0].text : ''
    );

    const cost = this.calculateCost(
      response.usage.input_tokens,
      response.usage.output_tokens
    );

    const result: WireframeResult = {
      component_name: request.component_name,
      code,
      tokens_used: response.usage.input_tokens + response.usage.output_tokens,
      cost,
      generated_at: new Date().toISOString()
    };

    // Store in Supabase Storage
    await this.saveToStorage(result);

    return result;
  }

  private buildPrompt(request: WireframeRequest): string {
    return `Create a React TypeScript component wireframe.

Component Name: ${request.component_name}
Purpose: ${request.work_order_title}
Description: ${request.description}

Files in scope: ${request.files_in_scope.join(', ')}

Requirements:
1. React functional component with TypeScript
2. Use Tailwind CSS for styling
3. Use shadcn/ui components (Button, Card, Dialog, etc.)
4. Include mock data for demonstration
5. Make interactive elements functional
6. Responsive design (mobile-first)
7. Add comments explaining sections
8. Include accessibility attributes
9. Export as default export

Output ONLY the TypeScript code in a code block, no explanations.`;
  }

  private extractCodeBlock(text: string): string {
    const patterns = [
      /```typescript\n([\s\S]+?)\n```/,
      /```tsx\n([\s\S]+?)\n```/,
      /```\n([\s\S]+?)\n```/
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) return match[1].trim();
    }

    return text.trim();
  }

  private calculateCost(inputTokens: number, outputTokens: number): number {
    return (inputTokens * 0.000003) + (outputTokens * 0.000015);
  }

  private async saveToStorage(result: WireframeResult): Promise<void> {
    const fileName = `${result.component_name}.tsx`;
    const filePath = `wireframes/${fileName}`;

    const { error } = await this.supabase.storage
      .from('moose-artifacts')
      .upload(filePath, result.code, {
        contentType: 'text/plain',
        upsert: true
      });

    if (error) {
      console.error('Failed to save wireframe to Supabase:', error);
      throw error;
    }
  }
}
```

---

### Phase 2: Integration with Architect

**Approach:** Post-decomposition enhancement (Option B)

**Rationale:**
- Our Architect is prompt-based and returns structured JSON
- Adding UI detection logic to the prompt is simpler than JavaScript parsing
- Keeps Architect fast and focused on decomposition
- Wireframe generation becomes an optional post-processing step

**File:** `src/lib/architect-service.ts` (Modified)

```typescript
import { WireframeService } from './wireframe-service';

export class ArchitectService {
  private wireframeService: WireframeService;

  constructor() {
    this.anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
    this.wireframeService = new WireframeService();
  }

  async decomposeSpec(
    spec: TechnicalSpec,
    options?: { generateWireframes?: boolean }
  ): Promise<DecompositionOutput> {
    // Existing decomposition logic...
    const decomposition = await this.performDecomposition(spec);

    // Optional: Generate wireframes for UI work orders
    if (options?.generateWireframes) {
      await this.attachWireframes(decomposition);
    }

    return decomposition;
  }

  private async attachWireframes(
    decomposition: DecompositionOutput
  ): Promise<void> {
    const uiWorkOrders = decomposition.work_orders.filter(wo =>
      this.isUIWorkOrder(wo)
    );

    console.log(`🎨 Generating wireframes for ${uiWorkOrders.length} UI work orders...`);

    for (const wo of uiWorkOrders) {
      try {
        const componentName = this.extractComponentName(wo);
        if (!componentName) continue;

        const wireframe = await this.wireframeService.generateWireframe({
          component_name: componentName,
          work_order_title: wo.title,
          description: wo.description,
          files_in_scope: wo.files_in_scope
        });

        // Attach metadata to work order
        (wo as any).wireframe = {
          component_name: wireframe.component_name,
          generated: true,
          storage_path: `wireframes/${wireframe.component_name}.tsx`,
          cost: wireframe.cost
        };

        console.log(`   ✅ ${componentName} ($${wireframe.cost.toFixed(4)})`);
      } catch (error) {
        console.error(`   ❌ Failed to generate wireframe for ${wo.title}:`, error);
      }
    }
  }

  private isUIWorkOrder(wo: WorkOrder): boolean {
    const uiPatterns = [
      /\bui\b/i, /\bview\b/i, /\bcomponent\b/i, /\bscreen\b/i,
      /\bdialog\b/i, /\bmodal\b/i, /\bform\b/i, /\bbutton\b/i,
      /\binterface\b/i, /\bdisplay\b/i, /\brender\b/i
    ];

    const text = `${wo.title} ${wo.description}`.toLowerCase();
    return uiPatterns.some(pattern => pattern.test(text));
  }

  private extractComponentName(wo: WorkOrder): string | null {
    // Try to extract from files_in_scope first
    for (const file of wo.files_in_scope) {
      const match = file.match(/\/([A-Z][a-zA-Z]+)\.tsx?$/);
      if (match) return match[1];
    }

    // Fallback: Extract from title
    const titleMatch = wo.title.match(/\b([A-Z][a-zA-Z]+(?:View|Panel|Dialog|Form|Component))\b/);
    if (titleMatch) return titleMatch[1];

    return null;
  }
}
```

---

### Phase 3: API Endpoint

**File:** `src/app/api/architect/decompose/route.ts` (Modified)

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { architectService } from '@/lib/architect-service';

export async function POST(request: NextRequest) {
  const { spec, options } = await request.json();

  const decomposition = await architectService.decomposeSpec(spec, {
    generateWireframes: options?.generateWireframes ?? false
  });

  return NextResponse.json(decomposition);
}
```

**Usage:**
```bash
curl -X POST https://moose-indol.vercel.app/api/architect/decompose \
  -H "Content-Type: application/json" \
  -d '{
    "spec": { ... },
    "options": { "generateWireframes": true }
  }'
```

---

### Phase 4: Type Additions

**File:** `src/types/architect.ts` (Modified)

```typescript
export interface WorkOrder {
  title: string;
  description: string;
  acceptance_criteria: string[];
  files_in_scope: string[];
  context_budget_estimate: number;
  risk_level: "low" | "medium" | "high";
  dependencies: string[];
  wireframe?: {                    // NEW - Optional wireframe metadata
    component_name: string;
    generated: boolean;
    storage_path: string;
    cost: number;
  };
}
```

---

## Cost & Performance Analysis

### Per Wireframe
- **Input tokens:** ~1,200 (prompt + context)
- **Output tokens:** ~5,000 (React component)
- **Cost:** $0.079 per wireframe
- **Time:** ~6-8 seconds per wireframe

### Example: Multi-LLM Discussion App
- **UI Work Orders:** 8
- **Total Cost:** $0.63
- **Total Time:** 48-64 seconds
- **Storage:** ~40KB per wireframe = 320KB total

### Budget Impact
- Current budget: $100
- Wireframe cost: <$1 per decomposition
- **Impact:** Negligible (< 1% of budget)

---

## Supabase Storage Setup

### Required Steps

1. **Create Storage Bucket**
```sql
-- Run in Supabase SQL Editor
INSERT INTO storage.buckets (id, name, public)
VALUES ('moose-artifacts', 'moose-artifacts', true);
```

2. **Set Bucket Policies**
```sql
-- Allow authenticated uploads
CREATE POLICY "Allow authenticated uploads"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'moose-artifacts');

-- Allow public reads
CREATE POLICY "Allow public reads"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'moose-artifacts');
```

3. **Access Pattern**
```typescript
// Upload
await supabase.storage
  .from('moose-artifacts')
  .upload('wireframes/MyComponent.tsx', code);

// Download
const { data } = await supabase.storage
  .from('moose-artifacts')
  .download('wireframes/MyComponent.tsx');
```

---

## Testing Strategy

### Unit Tests
**File:** `src/lib/__tests__/wireframe-service.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import { WireframeService } from '../wireframe-service';

describe('WireframeService', () => {
  it('should generate basic component', async () => {
    const service = new WireframeService();
    const result = await service.generateWireframe({
      component_name: 'TestButton',
      work_order_title: 'Create button component',
      description: 'A simple button for user actions',
      files_in_scope: ['components/TestButton.tsx']
    });

    expect(result.component_name).toBe('TestButton');
    expect(result.code).toContain('React');
    expect(result.code).toContain('TestButton');
    expect(result.cost).toBeGreaterThan(0);
  });
});
```

### Integration Test
```bash
# 1. Create test spec
echo '{
  "feature_name": "User Dashboard",
  "objectives": ["Display user metrics"],
  "constraints": ["Must be responsive"],
  "acceptance_criteria": ["Shows user data"]
}' > test-spec.json

# 2. Run decomposition with wireframes
curl -X POST http://localhost:3000/api/architect/decompose \
  -H "Content-Type: application/json" \
  -d @test-spec.json

# 3. Verify Supabase storage
# Check: https://qclxdnbvoruvqnhsshjr.supabase.co/storage/v1/object/public/moose-artifacts/wireframes/
```

---

## Migration Path

### Phase 1: Core Service (2 hours)
- [ ] Create `src/lib/wireframe-service.ts`
- [ ] Create `src/types/wireframe.ts`
- [ ] Set up Supabase storage bucket
- [ ] Write unit tests
- [ ] Verify API works standalone

### Phase 2: Architect Integration (1 hour)
- [ ] Modify `src/lib/architect-service.ts`
- [ ] Add UI detection logic
- [ ] Add component name extraction
- [ ] Update `src/types/architect.ts`

### Phase 3: API Endpoint (30 minutes)
- [ ] Modify `src/app/api/architect/decompose/route.ts`
- [ ] Add `generateWireframes` option
- [ ] Test end-to-end flow

### Phase 4: Verification (30 minutes)
- [ ] Run TypeScript check: `npx tsc --noEmit`
- [ ] Run tests: `npx vitest run`
- [ ] Test with real spec
- [ ] Verify Supabase storage

**Total Estimated Time:** 4 hours

---

## Risks & Mitigations

### Risk 1: Supabase Storage Quota
- **Limit:** 1GB free tier
- **Usage:** 40KB per wireframe = 25,000 wireframes before limit
- **Mitigation:** Monitor usage, implement cleanup for old wireframes

### Risk 2: Claude API Rate Limits
- **Limit:** 50 requests/minute (current tier)
- **Impact:** Batch of 8 wireframes = 8 requests = safe
- **Mitigation:** Already have rate limiting in Manager service

### Risk 3: Cost Overruns
- **Current:** $0.08 per wireframe
- **100 decompositions:** $8 (8 wireframes each)
- **Mitigation:** Track costs in Manager budget enforcement

### Risk 4: Prompt Engineering Failures
- **Risk:** Claude generates invalid React code
- **Mitigation:**
  - Validate code with TypeScript parser
  - Retry with refined prompt
  - Fallback to template-based generation

---

## Differences from Proposed Implementation

| Aspect | Proposed | Recommended |
|--------|----------|-------------|
| **Directory** | `src/services/` | `src/lib/` |
| **Storage** | Local filesystem | Supabase Storage |
| **Type Model** | Features → WorkOrders | WorkOrders only |
| **Integration** | Pre-decomposition | Post-decomposition |
| **Detection Logic** | JavaScript parsing | Regex patterns |
| **Manifest** | JSON file | Database table |
| **Tests Location** | `src/__tests__/services/` | `src/lib/__tests__/` |

---

## Conclusion

The proposed wireframe generation concept is **fundamentally sound** and adds significant value to Moose. However, the implementation needs adaptation to match our actual architecture:

1. **Simplified type model** - No features, only WorkOrders
2. **Cloud storage** - Use Supabase instead of local files
3. **Post-decomposition flow** - Enhance WorkOrders after Architect runs
4. **Pattern-based detection** - Simple regex instead of complex parsing

**Recommended Action:** Proceed with the corrected implementation outlined in this document. The core value proposition remains intact while properly integrating with our existing system.

**Estimated Effort:** 4 hours (vs. 8 hours in original proposal)
**Estimated Cost:** $2-5 for testing (same as proposed)
**Risk Level:** Low (isolated service, optional feature)

---

**Next Step:** Await your approval to proceed with Phase 1 implementation.
