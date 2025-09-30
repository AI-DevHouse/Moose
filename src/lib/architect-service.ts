// src/lib/architect-service.ts
import Anthropic from '@anthropic-ai/sdk';
import type { TechnicalSpec, DecompositionOutput } from '@/types/architect';

export class ArchitectService {
  private static instance: ArchitectService;
  private anthropic: Anthropic;

  private constructor() {
    this.anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY!
    });
  }

  static getInstance(): ArchitectService {
    if (!ArchitectService.instance) {
      ArchitectService.instance = new ArchitectService();
    }
    return ArchitectService.instance;
  }

  async decomposeSpec(spec: TechnicalSpec): Promise<DecompositionOutput> {
    const prompt = this.buildArchitectPrompt(spec);
    
    const response = await this.anthropic.messages.create({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 4000,
      messages: [{ role: 'user', content: prompt }]
    });

    const content = response.content[0].type === 'text' ? response.content[0].text : '';
    
    // Strip markdown code blocks if present
    const cleanContent = content
      .replace(/^```json\s*\n?/i, '')
      .replace(/\n?```\s*$/i, '')
      .trim();
    
    const decomposition = JSON.parse(cleanContent);
    
    // Validate
    if (decomposition.work_orders.length < 3 || decomposition.work_orders.length > 8) {
      throw new Error(`Invalid WO count: ${decomposition.work_orders.length}. Must be 3-8.`);
    }

    try {
      this.validateDependencies(decomposition.work_orders);
    } catch (error: any) {
      console.warn('Dependency validation warning:', error.message);
      // Continue anyway - let human review dependencies in UI
    }

    return decomposition;
  }

  private buildArchitectPrompt(spec: TechnicalSpec): string {
    return `You are an expert technical architect decomposing specifications into Work Orders.

INPUT:
Feature: ${spec.feature_name}
Objectives:
${spec.objectives.map(o => `- ${o}`).join('\n')}

Constraints:
${spec.constraints.map(c => `- ${c}`).join('\n')}

Acceptance Criteria:
${spec.acceptance_criteria.map(a => `- ${a}`).join('\n')}

YOUR TASK:
1. Analyze complexity and scope
2. Decompose into 3-8 Work Orders
3. Identify sequential dependencies (A must complete before B)
4. Estimate tokens per WO (warn if >4000)
5. Assess risk level (low/medium/high) per WO
6. Generate decomposition documentation

OUTPUT FORMAT (valid JSON):
{
  "work_orders": [
    {
      "title": "Implement OAuth provider config",
      "description": "Create configuration for Google/GitHub OAuth providers",
      "acceptance_criteria": ["Config file created", "Provider credentials validated"],
      "files_in_scope": ["config/oauth.ts", "types/auth.ts"],
      "context_budget_estimate": 800,
      "risk_level": "low",
      "dependencies": []
    },
    {
      "title": "Create session management",
      "description": "Redis-backed session storage with user profile sync",
      "acceptance_criteria": ["Sessions persist", "User data syncs"],
      "files_in_scope": ["lib/session.ts", "lib/redis.ts"],
      "context_budget_estimate": 1500,
      "risk_level": "medium",
      "dependencies": ["0"]
    }
  ],
  "decomposition_doc": "# Implementation Plan\\n## Dependencies\\nWO-0 (OAuth config) → WO-1 (Sessions)\\n## Rationale\\n[Explain chunking strategy]",
  "total_estimated_cost": 25.50
}

ESTIMATION RULES:
- Low complexity (CRUD, config): 500-1000 tokens
- Medium complexity (business logic, API): 1000-2000 tokens
- High complexity (architecture, security): 2000-4000 tokens
- Flag if estimate >4000 (suggest splitting)

COST CALCULATION:
- Sum all context_budget_estimate values from all work orders
- Divide by 1000 to get approximate dollar cost (assume $0.001 per 1K tokens)
- Example: If work orders total 13000 tokens, cost = 13000 / 1000 = $13.00
- Return as number with 2 decimal places (13.00, not 13000)

DEPENDENCY RULES:
- Only sequential dependencies (A→B→C)
- No parallel work yet
- No circular dependencies
- Use array indices for dependencies (e.g., "0" for first WO)

Return ONLY valid JSON, no markdown, no explanation.`;
  }

  private validateDependencies(workOrders: any[]): void {
    const visited = new Set<string>();
    const recursionStack = new Set<string>();

    const hasCycle = (index: string): boolean => {
      if (recursionStack.has(index)) return true;
      if (visited.has(index)) return false;

      visited.add(index);
      recursionStack.add(index);

      const wo = workOrders[parseInt(index)];
      for (const dep of wo.dependencies || []) {
        if (hasCycle(dep)) return true;
      }

      recursionStack.delete(index);
      return false;
    };

    for (let i = 0; i < workOrders.length; i++) {
      if (hasCycle(i.toString())) {
        throw new Error('Circular dependency detected in work orders');
      }
    }
  }
}

export const architectService = ArchitectService.getInstance();