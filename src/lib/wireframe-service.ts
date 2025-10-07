// src/lib/wireframe-service.ts
// Service for generating UI wireframes using Claude API

import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@supabase/supabase-js';
import type { WireframeRequest, WireframeResult } from '@/types/wireframe';

export class WireframeService {
  private static instance: WireframeService;
  private anthropic: Anthropic;
  private supabase: ReturnType<typeof createClient>;

  private constructor() {
    this.anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY!
    });
    this.supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
  }

  static getInstance(): WireframeService {
    if (!WireframeService.instance) {
      WireframeService.instance = new WireframeService();
    }
    return WireframeService.instance;
  }

  /**
   * Generate a wireframe for a UI component
   */
  async generateWireframe(request: WireframeRequest): Promise<WireframeResult> {
    console.log(`🎨 Generating wireframe: ${request.component_name}...`);

    const startTime = Date.now();
    const prompt = this.buildPrompt(request);

    // Call Claude API
    const response = await this.anthropic.messages.create({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 8000,
      messages: [{ role: 'user', content: prompt }]
    });

    const duration = Date.now() - startTime;

    // Extract code from response
    const code = this.extractCodeBlock(
      response.content[0].type === 'text' ? response.content[0].text : ''
    );

    // Calculate cost
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
    try {
      await this.saveToStorage(result);
      result.storage_path = `wireframes/${result.component_name}.tsx`;
    } catch (error) {
      console.warn('⚠️  Failed to save to Supabase storage:', error);
      // Continue even if storage fails - code is still in result
    }

    console.log(
      `   ✅ ${request.component_name} (${duration}ms, $${cost.toFixed(4)}, ${response.usage.output_tokens} tokens)`
    );

    return result;
  }

  /**
   * Generate multiple wireframes in batch
   */
  async generateBatch(requests: WireframeRequest[]): Promise<WireframeResult[]> {
    console.log(`📐 Generating ${requests.length} wireframes...`);

    const results: WireframeResult[] = [];

    for (const request of requests) {
      try {
        const result = await this.generateWireframe(request);
        results.push(result);
      } catch (error: any) {
        console.error(`   ❌ Failed to generate ${request.component_name}:`, error.message);
        // Continue with other wireframes
      }
    }

    const totalCost = results.reduce((sum, r) => sum + r.cost, 0);
    console.log(`✅ Generated ${results.length}/${requests.length} wireframes (total: $${totalCost.toFixed(2)})`);

    return results;
  }

  /**
   * Build detailed prompt for Claude
   */
  private buildPrompt(request: WireframeRequest): string {
    const acceptanceCriteria = request.acceptance_criteria
      ? `\n\nAcceptance Criteria:\n${request.acceptance_criteria.map(c => `- ${c}`).join('\n')}`
      : '';

    return `Create a React TypeScript component wireframe.

Component Name: ${request.component_name}
Purpose: ${request.work_order_title}
Description: ${request.description}

Files in scope: ${request.files_in_scope.join(', ')}${acceptanceCriteria}

Requirements:
1. Create as a React functional component using TypeScript
2. Use Tailwind CSS for styling (utility classes only)
3. Use shadcn/ui components where applicable (Button, Card, Dialog, Input, Select, etc.)
4. Include mock/sample data so the wireframe is fully functional and demonstrable
5. Make all interactive elements functional (buttons, inputs, tabs, etc.)
6. Ensure responsive design (mobile-first, works on all screen sizes)
7. Add clear comments explaining each major section
8. Use modern React patterns (hooks, proper TypeScript types)
9. Include proper accessibility attributes (aria-label, role, etc.)
10. Export as default export

Output Format:
Return ONLY the complete component code in a single TypeScript code block.
Do NOT include explanations, markdown headings, or additional text outside the code block.
The code should be production-ready and self-contained.

Example structure:
\`\`\`typescript
import React from 'react';
// ... other imports

interface ${request.component_name}Props {
  // props
}

const ${request.component_name}: React.FC<${request.component_name}Props> = (props) => {
  // component implementation
};

export default ${request.component_name};
\`\`\``;
  }

  /**
   * Extract code block from Claude's response
   */
  private extractCodeBlock(text: string): string {
    // Try to match code blocks with various language tags
    const patterns = [
      /```typescript\n([\s\S]+?)\n```/,
      /```tsx\n([\s\S]+?)\n```/,
      /```react\n([\s\S]+?)\n```/,
      /```jsx\n([\s\S]+?)\n```/,
      /```\n([\s\S]+?)\n```/
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        return match[1].trim();
      }
    }

    // If no code block found, return entire text (fallback)
    console.warn('⚠️  No code block found in response, using raw text');
    return text.trim();
  }

  /**
   * Calculate cost based on Claude Sonnet 4.5 pricing
   * Input: $3 per million tokens
   * Output: $15 per million tokens
   */
  private calculateCost(inputTokens: number, outputTokens: number): number {
    const INPUT_COST_PER_TOKEN = 0.000003;
    const OUTPUT_COST_PER_TOKEN = 0.000015;

    return (inputTokens * INPUT_COST_PER_TOKEN) + (outputTokens * OUTPUT_COST_PER_TOKEN);
  }

  /**
   * Save wireframe to Supabase Storage
   */
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
      throw new Error(`Supabase storage error: ${error.message}`);
    }
  }

  /**
   * Retrieve a wireframe from Supabase Storage
   */
  async getWireframe(componentName: string): Promise<string | null> {
    const filePath = `wireframes/${componentName}.tsx`;

    const { data, error } = await this.supabase.storage
      .from('moose-artifacts')
      .download(filePath);

    if (error) {
      console.error('Failed to download wireframe:', error);
      return null;
    }

    return await data.text();
  }

  /**
   * List all wireframes in storage
   */
  async listWireframes(): Promise<string[]> {
    const { data, error } = await this.supabase.storage
      .from('moose-artifacts')
      .list('wireframes');

    if (error) {
      console.error('Failed to list wireframes:', error);
      return [];
    }

    return data.map(file => file.name);
  }
}

export const wireframeService = WireframeService.getInstance();
