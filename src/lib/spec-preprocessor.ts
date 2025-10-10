/**
 * Spec Preprocessor
 *
 * Part of Architect Agent responsibility - handles large unstructured technical specifications
 * by breaking them into logical sections and converting to structured TechnicalSpec format.
 *
 * Purpose: Enable Architect to handle real-world detailed specs (50K+ chars) by:
 * 1. Parsing document structure (section headers)
 * 2. Splitting into manageable chunks
 * 3. Converting each chunk to structured TechnicalSpec
 * 4. Adding cross-section dependencies
 */

import Anthropic from '@anthropic-ai/sdk';
import type { TechnicalSpec } from '@/types/architect';

export interface DocumentSection {
  section_number: string;  // e.g., "4.1", "Phase 1", "##Introduction"
  title: string;
  content: string;
  start_line: number;
  end_line: number;
}

export interface PreprocessedSpec {
  sections: DocumentSection[];
  total_sections: number;
  original_length: number;
  requires_preprocessing: boolean;
}

export interface StructuredSection extends DocumentSection {
  technical_spec: TechnicalSpec;
  dependencies: string[];  // Section numbers this depends on
}

/**
 * SpecPreprocessor handles large unstructured documents
 */
export class SpecPreprocessor {
  private static instance: SpecPreprocessor;
  private anthropic: Anthropic;

  // Threshold: If spec content > 10K chars, preprocess it
  private static readonly PREPROCESSING_THRESHOLD = 10000;

  private constructor() {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error('ANTHROPIC_API_KEY required for SpecPreprocessor');
    }
    this.anthropic = new Anthropic({ apiKey });
  }

  static getInstance(): SpecPreprocessor {
    if (!SpecPreprocessor.instance) {
      SpecPreprocessor.instance = new SpecPreprocessor();
    }
    return SpecPreprocessor.instance;
  }

  /**
   * Determine if a spec needs preprocessing
   */
  needsPreprocessing(content: string): boolean {
    // If it's already a structured TechnicalSpec object, no preprocessing needed
    if (typeof content !== 'string') {
      return false;
    }

    // If it's short enough, no preprocessing needed
    if (content.length < SpecPreprocessor.PREPROCESSING_THRESHOLD) {
      return false;
    }

    return true;
  }

  /**
   * Parse document into sections using AI (Claude Sonnet 4.5)
   * This is more robust than regex-based parsing
   */
  async parseDocumentStructure(content: string): Promise<PreprocessedSpec> {
    // Normalize line endings (handle both \r\n and \n)
    const normalizedContent = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    const lines = normalizedContent.split('\n');

    console.log('   Using AI to parse document structure...');

    // Ask Claude to intelligently parse the document into sections
    const prompt = `You are analyzing a technical specification document to identify its logical sections for implementation.

**Document Content:**
${normalizedContent}

---

**Your Task:**

Analyze this technical specification and identify all major sections that should be implemented as separate work packages. Look for:
- Numbered sections (e.g., "1. Executive Summary", "2.1 Architecture")
- Major component descriptions
- Feature specifications
- Architecture sections
- Technology stack details
- Implementation phases

**Output Format (JSON only):**

\`\`\`json
{
  "sections": [
    {
      "section_number": "1",
      "title": "Executive Summary",
      "start_marker": "1. Executive Summary",
      "end_marker": "2. System Architecture"
    },
    {
      "section_number": "2",
      "title": "System Architecture",
      "start_marker": "2. System Architecture",
      "end_marker": "3. Technology Stack"
    },
    ...
  ]
}
\`\`\`

**Guidelines:**
- Identify 5-15 major sections (not too granular, not too coarse)
- Each section should be substantial enough to generate 2-10 work orders
- Use the actual section numbers/identifiers from the document
- start_marker: The exact text that begins this section
- end_marker: The exact text that begins the NEXT section (or "END OF DOCUMENT" for last section)
- Focus on implementation-relevant sections (skip table of contents, change logs, etc.)

Provide the JSON now:`;

    const response = await this.anthropic.messages.create({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 4000,
      messages: [{ role: 'user', content: prompt }]
    });

    const responseContent = response.content[0].type === 'text' ? response.content[0].text : '';

    // Parse JSON response
    let cleanContent = responseContent
      .replace(/```json\s*/g, '')
      .replace(/```\s*/g, '')
      .trim();

    // Extract just the JSON object
    const firstBrace = cleanContent.indexOf('{');
    const lastBrace = cleanContent.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      cleanContent = cleanContent.substring(firstBrace, lastBrace + 1);
    }

    let parsedSections: any[];
    try {
      const parsed = JSON.parse(cleanContent);
      parsedSections = parsed.sections || [];
    } catch (error: any) {
      console.error('Failed to parse AI section response:', error.message);
      throw new Error('AI failed to parse document structure');
    }

    // Extract content for each section based on AI-identified boundaries
    const sections: DocumentSection[] = [];

    for (let i = 0; i < parsedSections.length; i++) {
      const section = parsedSections[i];
      const startMarker = section.start_marker;
      const endMarker = section.end_marker;

      // Find start and end positions in content
      const startIdx = normalizedContent.indexOf(startMarker);
      let endIdx = normalizedContent.indexOf(endMarker, startIdx + 1);

      if (startIdx === -1) {
        console.warn(`Warning: Could not find start marker for section: ${section.title}`);
        continue;
      }

      if (endIdx === -1 || endMarker === 'END OF DOCUMENT') {
        endIdx = normalizedContent.length;
      }

      // Extract content between markers
      const sectionContent = normalizedContent.substring(startIdx, endIdx).trim();

      // Calculate line numbers
      const contentBeforeStart = normalizedContent.substring(0, startIdx);
      const start_line = contentBeforeStart.split('\n').length - 1;
      const end_line = start_line + sectionContent.split('\n').length - 1;

      sections.push({
        section_number: section.section_number,
        title: section.title,
        content: sectionContent,
        start_line,
        end_line
      });
    }

    console.log(`   AI identified ${sections.length} sections`);

    return {
      sections,
      total_sections: sections.length,
      original_length: content.length,
      requires_preprocessing: sections.length > 1
    };
  }

  /**
   * Convert a document section to structured TechnicalSpec using LLM
   */
  async convertSectionToSpec(
    section: DocumentSection,
    context: {
      document_title?: string;
      total_sections: number;
      section_index: number;
    }
  ): Promise<TechnicalSpec> {
    const prompt = `You are analyzing a section from a larger technical specification document.

**Document Context:**
- Title: ${context.document_title || 'Technical Specification'}
- Section ${context.section_index + 1} of ${context.total_sections}
- Section Number: ${section.section_number}
- Section Title: ${section.title}

**Section Content:**
${section.content}

---

**Your Task:**

Extract a structured technical specification from this section. Focus on what this specific section describes.

**Output Format (JSON only):**

\`\`\`json
{
  "feature_name": "Brief name for this section's feature/component",
  "objectives": [
    "Specific goal 1 from this section",
    "Specific goal 2 from this section",
    ...
  ],
  "constraints": [
    "Technical constraint 1",
    "Technology/framework requirement",
    "Performance/security requirement",
    ...
  ],
  "acceptance_criteria": [
    "Testable success criterion 1",
    "Testable success criterion 2",
    ...
  ],
  "budget_estimate": <number or null>,
  "time_estimate": "<string or null>"
}
\`\`\`

**Important Guidelines:**
- Extract 3-10 objectives (specific to this section)
- Extract 3-10 constraints (technology, performance, security requirements)
- Extract 3-10 acceptance criteria (testable outcomes)
- Be specific - reference exact technologies/frameworks mentioned
- If budget/time not mentioned, use null
- Focus ONLY on what this section covers (not the whole document)

Provide the JSON now:`;

    const response = await this.anthropic.messages.create({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 2000,
      messages: [{ role: 'user', content: prompt }]
    });

    const content = response.content[0].type === 'text' ? response.content[0].text : '';

    // Parse JSON response
    let cleanContent = content
      .replace(/```json\s*/g, '')
      .replace(/```\s*/g, '')
      .trim();

    // Extract just the JSON object (from first { to last })
    const firstBrace = cleanContent.indexOf('{');
    const lastBrace = cleanContent.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      cleanContent = cleanContent.substring(firstBrace, lastBrace + 1);
    }

    try {
      const parsed = JSON.parse(cleanContent);

      return {
        feature_name: parsed.feature_name,
        objectives: parsed.objectives || [],
        constraints: parsed.constraints || [],
        acceptance_criteria: parsed.acceptance_criteria || [],
        budget_estimate: parsed.budget_estimate,
        time_estimate: parsed.time_estimate
      };
    } catch (error: any) {
      console.error('Failed to parse section spec:', error.message);
      console.error('Content:', cleanContent);
      throw new Error(`Failed to parse section ${section.section_number}: ${error.message}`);
    }
  }

  /**
   * Analyze dependencies between sections
   */
  async analyzeDependencies(
    sections: DocumentSection[]
  ): Promise<Map<string, string[]>> {
    // Simple heuristic: earlier sections are dependencies for later ones
    // For MVP, assume sequential dependencies
    const dependencies = new Map<string, string[]>();

    for (let i = 0; i < sections.length; i++) {
      const section = sections[i];
      const deps: string[] = [];

      // Depend on previous section (if exists)
      if (i > 0) {
        deps.push(sections[i - 1].section_number);
      }

      dependencies.set(section.section_number, deps);
    }

    return dependencies;
  }

  /**
   * Main preprocessing pipeline
   */
  async preprocess(
    rawContent: string,
    options?: {
      document_title?: string;
      force_sequential?: boolean;  // Force sequential dependencies
    }
  ): Promise<StructuredSection[]> {
    console.log('📄 SpecPreprocessor: Starting preprocessing...');

    // Step 1: Parse document structure using AI
    const parsed = await this.parseDocumentStructure(rawContent);
    console.log(`   Found ${parsed.total_sections} sections`);

    if (parsed.sections.length === 0) {
      throw new Error('No sections found in document. Cannot preprocess.');
    }

    // Step 2: Convert each section to TechnicalSpec
    const structuredSections: StructuredSection[] = [];

    for (let i = 0; i < parsed.sections.length; i++) {
      const section = parsed.sections[i];

      console.log(`   Processing section ${i + 1}/${parsed.sections.length}: ${section.title}`);

      const technicalSpec = await this.convertSectionToSpec(section, {
        document_title: options?.document_title,
        total_sections: parsed.total_sections,
        section_index: i
      });

      structuredSections.push({
        ...section,
        technical_spec: technicalSpec,
        dependencies: []  // Will be filled in next step
      });
    }

    // Step 3: Analyze dependencies
    const dependencyMap = await this.analyzeDependencies(parsed.sections);

    for (const structuredSection of structuredSections) {
      structuredSection.dependencies = dependencyMap.get(structuredSection.section_number) || [];
    }

    console.log('✅ SpecPreprocessor: Complete\n');

    return structuredSections;
  }
}

export const specPreprocessor = SpecPreprocessor.getInstance();
