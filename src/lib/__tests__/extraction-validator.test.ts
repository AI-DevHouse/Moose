// src/lib/__tests__/extraction-validator.test.ts
// Unit tests for Extraction Validator

import { describe, it, expect } from 'vitest';
import {
  validateExtraction,
  autoCleanExtraction,
  type ExtractionValidationResult
} from '../extraction-validator';

describe('ExtractionValidator', () => {
  describe('validateExtraction', () => {
    it('should pass clean TypeScript code', () => {
      const code = `import React from 'react';

export const Component: React.FC = () => {
  return <div>Hello World</div>;
};`;

      const result = validateExtraction(code);
      expect(result.valid).toBe(true);
      expect(result.severity).toBe('clean');
      expect(result.issues).toHaveLength(0);
    });

    it('should detect code fence markers as critical', () => {
      const code = `\`\`\`typescript
const foo = 'bar';
\`\`\``;

      const result = validateExtraction(code);
      expect(result.valid).toBe(false);
      expect(result.severity).toBe('critical');
      expect(result.issues.some(i => i.includes('Code fence'))).toBe(true);
    });

    it('should detect explanatory text at start as critical', () => {
      const code = `Here's the solution:
const foo = 'bar';`;

      const result = validateExtraction(code);
      expect(result.valid).toBe(false);
      expect(result.severity).toBe('critical');
      expect(result.issues.some(i => i.includes('Explanatory text'))).toBe(true);
    });

    it('should detect invalid first character as critical', () => {
      const code = `> const foo = 'bar';`;

      const result = validateExtraction(code);
      expect(result.valid).toBe(false);
      expect(result.severity).toBe('critical');
      expect(result.issues.some(i => i.includes('Invalid first character'))).toBe(true);
    });

    it('should detect quoted lines as warning', () => {
      const code = `const foo = 'bar';
> This is quoted
const baz = 'qux';`;

      const result = validateExtraction(code);
      expect(result.valid).toBe(true); // Warnings don't invalidate
      expect(result.severity).toBe('warning');
      expect(result.issues.some(i => i.includes('quoted line'))).toBe(true);
    });

    it('should detect excessive blank lines as warning', () => {
      const code = `const foo = 'bar';



const baz = 'qux';`;

      const result = validateExtraction(code);
      expect(result.valid).toBe(true);
      expect(result.severity).toBe('warning');
      expect(result.issues.some(i => i.includes('blank lines'))).toBe(true);
    });

    it('should allow template literals with backticks', () => {
      const code = `const message = \`Hello \${name}\`;`;

      const result = validateExtraction(code);
      expect(result.valid).toBe(true);
      expect(result.severity).toBe('clean');
    });

    it('should allow code starting with comments', () => {
      const code = `// Component implementation
import React from 'react';`;

      const result = validateExtraction(code);
      expect(result.valid).toBe(true);
      expect(result.severity).toBe('clean');
    });
  });

  describe('autoCleanExtraction', () => {
    it('should remove code fence markers', () => {
      const code = `\`\`\`typescript
const foo = 'bar';
\`\`\``;

      const cleaned = autoCleanExtraction(code);
      expect(cleaned).not.toContain('```');
      expect(cleaned).toContain('const foo');
    });

    it('should remove explanatory first line', () => {
      const code = `Here's the solution:
const foo = 'bar';`;

      const cleaned = autoCleanExtraction(code);
      expect(cleaned).not.toContain("Here's");
      expect(cleaned.trim()).toBe("const foo = 'bar';");
    });

    it('should remove markdown blockquote markers', () => {
      const code = `> const foo = 'bar';
> const baz = 'qux';`;

      const cleaned = autoCleanExtraction(code);
      expect(cleaned).not.toContain('>');
      expect(cleaned).toContain('const foo');
      expect(cleaned).toContain('const baz');
    });

    it('should collapse excessive blank lines', () => {
      const code = `const foo = 'bar';



const baz = 'qux';`;

      const cleaned = autoCleanExtraction(code);
      const blankLineCount = (cleaned.match(/\n\n/g) || []).length;
      expect(blankLineCount).toBeLessThanOrEqual(1);
    });

    it('should preserve valid TypeScript code', () => {
      const code = `import React from 'react';

export const Component: React.FC = () => {
  const message = \`Hello \${name}\`;
  return <div>{message}</div>;
};`;

      const cleaned = autoCleanExtraction(code);
      expect(cleaned).toBe(code.trim());
    });

    it('should handle multiple issues at once', () => {
      const code = `Here's the code:
\`\`\`typescript
> const foo = 'bar';



const baz = 'qux';
\`\`\``;

      const cleaned = autoCleanExtraction(code);
      expect(cleaned).not.toContain("Here's");
      expect(cleaned).not.toContain('```');
      expect(cleaned).not.toContain('>');
      expect(cleaned).toContain('const foo');
      expect(cleaned).toContain('const baz');
    });
  });

  describe('Integration scenarios', () => {
    it('should handle Line 1 TS1005 error scenario', () => {
      // Simulates: `;' expected` at line 1 due to markdown artifact
      const code = `\`\`\`ts
const foo = 'bar';`;

      const result = validateExtraction(code);
      expect(result.valid).toBe(false);

      const cleaned = autoCleanExtraction(code);
      const revalidated = validateExtraction(cleaned);
      expect(revalidated.valid).toBe(true);
    });

    it('should handle nested backtick collision scenario', () => {
      // Simulates: Template literals with markdown confusion
      const code = `const template = \`Hello \${name}\`;`; // This should be fine
      const result = validateExtraction(code);
      expect(result.valid).toBe(true);
    });
  });
});
