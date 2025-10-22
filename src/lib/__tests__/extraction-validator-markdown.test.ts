/**
 * Tests for markdown extraction functionality
 * Validates fix for gpt-4o-mini markdown wrapping issues
 */

import { extractFromMarkdownFence, validateExtraction, autoCleanExtraction } from '../extraction-validator';

describe('extractFromMarkdownFence', () => {
  test('extracts code from typescript fence', () => {
    const input = `\`\`\`typescript
export const foo = 'bar';
export function test() {
  return 42;
}
\`\`\``;

    const result = extractFromMarkdownFence(input);

    expect(result).toBe(`export const foo = 'bar';
export function test() {
  return 42;
}`);
  });

  test('extracts code from json fence', () => {
    const input = `\`\`\`json
{
  "name": "test",
  "value": 123
}
\`\`\``;

    const result = extractFromMarkdownFence(input);

    expect(result).toContain('"name": "test"');
    expect(result).toContain('"value": 123');
  });

  test('extracts code from fence with no language identifier', () => {
    const input = `\`\`\`
import React from 'react';
export default App;
\`\`\``;

    const result = extractFromMarkdownFence(input);

    expect(result).toContain('import React');
    expect(result).toContain('export default App');
  });

  test('handles code with leading/trailing text', () => {
    const input = `Here's the corrected code:

\`\`\`typescript
export const fixed = true;
\`\`\`

This should work now!`;

    const result = extractFromMarkdownFence(input);

    // Should extract only the code, ignoring surrounding text
    expect(result).toBe('export const fixed = true;');
    expect(result).not.toContain('Here\'s');
    expect(result).not.toContain('This should');
  });

  test('returns original if no fence found', () => {
    const input = 'export const noFence = true;';
    const result = extractFromMarkdownFence(input);

    expect(result).toBe(input);
  });

  test('handles multiple code blocks by extracting first', () => {
    const input = `\`\`\`typescript
const first = 1;
\`\`\`

Some text

\`\`\`typescript
const second = 2;
\`\`\``;

    const result = extractFromMarkdownFence(input);

    // Should extract only the first block
    expect(result).toContain('const first = 1');
    expect(result).not.toContain('const second = 2');
  });

  test('handles tight fence pattern (no newline after opening)', () => {
    const input = `\`\`\`typescript
const tight = true;\`\`\``;

    const result = extractFromMarkdownFence(input);

    expect(result).toContain('const tight = true');
  });
});

describe('validateExtraction - updated validation', () => {
  test('allows { as first character (export statement)', () => {
    const code = `export { foo, bar } from './module';`;
    const result = validateExtraction(code);

    expect(result.valid).toBe(true);
    expect(result.severity).toBe('clean');
  });

  test('allows [ as first character (array export)', () => {
    const code = `[1, 2, 3].forEach(console.log);`;
    const result = validateExtraction(code);

    expect(result.valid).toBe(true);
    expect(result.severity).toBe('clean');
  });

  test('rejects # as first character (markdown heading)', () => {
    const code = `# Heading
export const foo = 'bar';`;
    const result = validateExtraction(code);

    expect(result.valid).toBe(false);
    expect(result.severity).toBe('critical');
    expect(result.issues).toContain(expect.stringContaining('Invalid first character'));
  });

  test('detects code fence markers', () => {
    const code = `\`\`\`typescript
export const foo = 'bar';
\`\`\``;
    const result = validateExtraction(code);

    expect(result.valid).toBe(false);
    expect(result.severity).toBe('critical');
    expect(result.issues).toContain(expect.stringContaining('Code fence markers'));
  });
});

describe('autoCleanExtraction - integrated extraction', () => {
  test('extracts from fence and validates clean', () => {
    const input = `\`\`\`typescript
export const clean = true;
\`\`\``;

    const cleaned = autoCleanExtraction(input);
    const validation = validateExtraction(cleaned);

    expect(cleaned).toBe('export const clean = true;');
    expect(validation.valid).toBe(true);
  });

  test('extracts JSON fence and handles { first character', () => {
    const input = `\`\`\`json
{
  "key": "value"
}
\`\`\``;

    const cleaned = autoCleanExtraction(input);

    // After extraction, should just be the JSON content
    expect(cleaned).toContain('"key": "value"');
    expect(cleaned).not.toContain('```');
  });

  test('handles gpt-4o-mini style response with markdown', () => {
    const input = `Here's the corrected code:

\`\`\`typescript
import React from 'react';

export function Component() {
  return <div>Hello</div>;
}
\`\`\`

This fixes the issue!`;

    const cleaned = autoCleanExtraction(input);
    const validation = validateExtraction(cleaned);

    expect(cleaned).toContain('import React');
    expect(cleaned).toContain('export function Component');
    expect(cleaned).not.toContain('Here\'s');
    expect(cleaned).not.toContain('This fixes');
    expect(validation.valid).toBe(true);
  });

  test('removes markdown heading artifact', () => {
    const input = `# TypeScript Code

export const code = true;`;

    const cleaned = autoCleanExtraction(input);
    const validation = validateExtraction(cleaned);

    // Should remove the heading
    expect(cleaned).toContain('export const code');
    expect(cleaned).not.toContain('# TypeScript');
    expect(validation.valid).toBe(true);
  });

  test('collapses excessive blank lines', () => {
    const input = `export const a = 1;



export const b = 2;`;

    const cleaned = autoCleanExtraction(input);

    // Should collapse 3+ newlines to 2
    expect(cleaned).not.toMatch(/\n{4,}/);
  });
});
