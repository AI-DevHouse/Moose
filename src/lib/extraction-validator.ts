/**
 * Extraction Validator
 *
 * Validates that AI-generated code has been properly extracted from markdown
 * and contains no formatting artifacts before sanitization and type checking.
 *
 * This catches extraction issues BEFORE they pollute refinement cycles.
 */

export interface ExtractionValidationResult {
  valid: boolean;
  issues: string[];
  severity: 'critical' | 'warning' | 'clean';
}

/**
 * Validate extracted code for markdown artifacts and formatting issues
 *
 * Critical issues (extraction failure):
 * - Code fence markers (```) present
 * - Explanatory text at start ("Here's", "The solution", etc.)
 * - Invalid first character (not alphanumeric, /, *, or whitespace)
 *
 * Warning issues (may need attention):
 * - Multiple consecutive blank lines
 * - Lines starting with '>' (quoted text)
 *
 * @param code - The extracted code to validate
 * @returns Validation result with issues found
 */
export function validateExtraction(code: string): ExtractionValidationResult {
  const issues: string[] = [];
  let severity: 'critical' | 'warning' | 'clean' = 'clean';

  // Critical: Check for markdown code fence markers
  if (code.includes('```')) {
    issues.push('Code fence markers (```) found - extraction incomplete');
    severity = 'critical';
  }

  // Critical: Check for explanatory text at start
  const firstNonBlankLine = code.split('\n').find(line => line.trim().length > 0);
  if (firstNonBlankLine) {
    const explanatoryPatterns = [
      /^here'?s?\s+/i,
      /^the\s+(solution|code|fix|answer)/i,
      /^i've\s+/i,
      /^this\s+(code|solution|implementation)/i,
      /^let's\s+/i,
      /^to\s+fix/i,
      /^you\s+(can|should)/i
    ];

    for (const pattern of explanatoryPatterns) {
      if (pattern.test(firstNonBlankLine.trim())) {
        issues.push(`Explanatory text detected: "${firstNonBlankLine.trim().substring(0, 50)}..."`);
        severity = 'critical';
        break;
      }
    }

    // Critical: Check for invalid first character
    const firstChar = firstNonBlankLine.trim()[0];
    // Valid first characters: letters, /, *, whitespace, { (for export/destructuring), [ (for arrays)
    // Note: # is NOT valid TypeScript syntax at file level (indicates markdown heading)
    const validFirstChars = /^[a-zA-Z\/\*\s\{\[]/;
    if (!validFirstChars.test(firstChar)) {
      issues.push(`Invalid first character: '${firstChar}' - may be markdown artifact`);
      severity = 'critical';
    }
  }

  // Warning: Check for quoted text (markdown blockquotes)
  const quotedLines = code.split('\n').filter(line => line.trim().startsWith('>'));
  if (quotedLines.length > 0) {
    issues.push(`${quotedLines.length} quoted line(s) found - possible markdown blockquote`);
    if (severity === 'clean') severity = 'warning';
  }

  // Warning: Check for excessive blank lines (possible extraction artifact)
  if (/\n\n\n\n/.test(code)) {
    issues.push('Multiple consecutive blank lines - may indicate extraction gap');
    if (severity === 'clean') severity = 'warning';
  }

  // Warning: Check for partial code fences (single backtick at line start)
  const lines = code.split('\n');
  const partialFences = lines.filter((line, idx) => {
    const trimmed = line.trim();
    return trimmed === '`' || (trimmed.startsWith('`') && trimmed.length < 3);
  });
  if (partialFences.length > 0) {
    issues.push(`${partialFences.length} partial code fence marker(s) - possible extraction error`);
    if (severity === 'clean') severity = 'warning';
  }

  return {
    valid: severity !== 'critical',
    issues,
    severity
  };
}

/**
 * Extract code content from markdown code fences
 *
 * Handles cases where LLM wraps code in ```language...```
 * Returns the content between the first complete code fence block,
 * or the original code if no fences found.
 *
 * @param code - Potentially markdown-wrapped code
 * @returns Extracted code content
 */
export function extractFromMarkdownFence(code: string): string {
  // Pattern: ```optional-lang\ncontent\n```
  // Matches opening fence with optional language, captures content, matches closing fence
  const fencePattern = /^```(?:ts|typescript|javascript|js|json|tsx|jsx)?\s*\n([\s\S]*?)\n```/m;
  const match = code.match(fencePattern);

  if (match && match[1]) {
    return match[1].trim();
  }

  // Try without newline after opening fence (some LLMs do ```typescript\nimport...)
  const tightFencePattern = /```(?:ts|typescript|javascript|js|json|tsx|jsx)?\s*\n([\s\S]*?)```/;
  const tightMatch = code.match(tightFencePattern);

  if (tightMatch && tightMatch[1]) {
    return tightMatch[1].trim();
  }

  // No fence found, return as-is
  return code;
}

/**
 * Attempt to clean critical extraction issues automatically
 *
 * This is a last-resort cleanup for obvious extraction failures.
 * It does NOT replace proper extraction - use this to recover from failures.
 *
 * NOTE: This should be called AFTER extractFromMarkdownFence() for best results.
 *
 * @param code - Code with extraction issues
 * @returns Cleaned code
 */
export function autoCleanExtraction(code: string): string {
  let cleaned = code;

  // STEP 1: Try to extract from markdown fences first
  cleaned = extractFromMarkdownFence(cleaned);

  // STEP 2: Remove any remaining fence markers (incomplete/malformed fences)
  cleaned = cleaned.replace(/^```(?:ts|typescript|javascript|js|json|tsx|jsx)?\s*$/gm, '');
  cleaned = cleaned.replace(/^```\s*$/gm, '');

  // STEP 3: Remove leading explanatory text and markdown headings
  const lines = cleaned.split('\n');
  if (lines.length > 0) {
    const firstLine = lines[0].trim().toLowerCase();
    const explanatoryStarts = ['here', 'the solution', 'i\'ve', 'this code', 'let\'s', 'to fix', 'you can', 'you should'];

    // Remove if matches explanatory patterns OR is a markdown heading (starts with #)
    if (explanatoryStarts.some(start => firstLine.startsWith(start)) || lines[0].trim().startsWith('#')) {
      lines.shift(); // Remove first line
      cleaned = lines.join('\n');
    }
  }

  // STEP 4: Remove markdown blockquote markers
  cleaned = cleaned.split('\n')
    .map(line => line.replace(/^>\s*/, ''))
    .join('\n');

  // STEP 5: Collapse excessive blank lines (4+ newlines → 2 newlines)
  cleaned = cleaned.replace(/\n{4,}/g, '\n\n');

  return cleaned.trim();
}

/**
 * Validate and log extraction issues
 *
 * Use this as a checkpoint before sanitization to catch extraction problems early.
 *
 * @param code - Code to validate
 * @param context - Context string for logging (e.g., "WO abc-123" or "Refinement Cycle 2")
 * @returns Validation result
 */
export function validateAndLogExtraction(code: string, context: string): ExtractionValidationResult {
  const validation = validateExtraction(code);

  if (validation.severity === 'critical') {
    console.error(`[ExtractionValidator] CRITICAL issues in ${context}:`);
    validation.issues.forEach(issue => console.error(`  ❌ ${issue}`));
  } else if (validation.severity === 'warning') {
    console.warn(`[ExtractionValidator] Warnings in ${context}:`);
    validation.issues.forEach(issue => console.warn(`  ⚠️  ${issue}`));
  } else {
    console.log(`[ExtractionValidator] ✅ Clean extraction for ${context}`);
  }

  return validation;
}
