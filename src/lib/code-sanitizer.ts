/**
 * TypeScript Code Sanitizer
 *
 * Mechanically fixes common syntax issues in AI-generated TypeScript code
 * before TypeScript error checking to prevent wasting refinement cycles.
 *
 * Implementation based on: docs/Sanitizer_Correction_Functions(1).txt
 */

export interface SanitizerResult {
  code: string;
  changed: boolean;
  description: string;
}

export interface SanitizerSummary {
  sanitized: string;
  changes_made: string[];
  telemetry: {
    functions_triggered: number;
    pre_size: number;
    post_size: number;
    pre_hash: string;
    post_hash: string;
  };
}

// ==============================================================================
// 🧹 CORE MECHANICAL FIXES (Priority 1)
// ==============================================================================

/**
 * #1: Replace curly/angled quotes with plain ASCII quotes
 * Fixes: "foo" → "foo", 'bar' → 'bar'
 */
export function fixSmartQuotes(code: string): SanitizerResult {
  const replaced = code
    .replace(/[""]/g, '"')
    .replace(/['']/g, "'");
  return {
    code: replaced,
    changed: replaced !== code,
    description: "Smart quotes → ASCII"
  };
}

/**
 * #2: Quote module names in declare module statements
 * Fixes: declare module foo {} → declare module 'foo' {}
 */
export function fixUnquotedModuleDeclarations(code: string): SanitizerResult {
  const replaced = code.replace(
    /declare\s+module\s+([a-zA-Z0-9_@\-\/\.]+)\s*\{/g,
    (match, moduleName) => {
      // Skip if already quoted
      if (moduleName.startsWith("'") || moduleName.startsWith('"')) {
        return match;
      }
      return `declare module '${moduleName}' {`;
    }
  );
  return {
    code: replaced,
    changed: replaced !== code,
    description: "Unquoted module declarations → quoted"
  };
}

/**
 * #3: Convert em/en dashes and exotic hyphens to standard hyphen
 * Fixes: const a — b → const a - b
 */
export function fixEmDashes(code: string): SanitizerResult {
  const replaced = code
    .replace(/[—–−]/g, '-'); // em-dash, en-dash, minus sign
  return {
    code: replaced,
    changed: replaced !== code,
    description: "Em/en dashes → hyphens"
  };
}

/**
 * #4: Detect odd number of backticks and close with a trailing one
 * Fixes: const s = `Hello ${name} → const s = `Hello ${name}`
 */
export function fixUnclosedTemplateLiterals(code: string): SanitizerResult {
  const lines = code.split('\n');
  let changed = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const backtickCount = (line.match(/`/g) || []).length;

    // If odd number of backticks, likely unclosed template literal
    if (backtickCount % 2 !== 0) {
      // Simple heuristic: add closing backtick at end of line
      lines[i] = line + '`';
      changed = true;
    }
  }

  return {
    code: lines.join('\n'),
    changed,
    description: "Unclosed template literals → closed"
  };
}

/**
 * #5: Remove zero-width spaces, BOMs, and non-ASCII control chars
 * Cleans invisible corruption from copy-pasted code
 */
export function stripZeroWidthChars(code: string): SanitizerResult {
  const replaced = code
    .replace(/[\u200B-\u200D\uFEFF]/g, '') // Zero-width spaces, BOMs
    .replace(/[\u0000-\u0008\u000B-\u000C\u000E-\u001F]/g, ''); // Control chars except \t, \n, \r
  return {
    code: replaced,
    changed: replaced !== code,
    description: "Zero-width/control chars removed"
  };
}

// ==============================================================================
// 🧩 SYNTAX-LEVEL SAFETY FIXES (Priority 2)
// ==============================================================================

/**
 * #6: Balance {}, (), [] counts per file; append missing closers
 * Prevents TS1434, TS1109, TS1127 errors
 */
export function fixDanglingBracesAndParens(code: string): SanitizerResult {
  let braceCount = 0;
  let parenCount = 0;
  let bracketCount = 0;

  // Count opening and closing brackets
  for (const char of code) {
    if (char === '{') braceCount++;
    else if (char === '}') braceCount--;
    else if (char === '(') parenCount++;
    else if (char === ')') parenCount--;
    else if (char === '[') bracketCount++;
    else if (char === ']') bracketCount--;
  }

  let result = code;
  const changes: string[] = [];

  // Append missing closers
  if (braceCount > 0) {
    result += '\n' + '}'.repeat(braceCount);
    changes.push(`${braceCount} closing brace(s)`);
  }
  if (parenCount > 0) {
    result += ')'.repeat(parenCount);
    changes.push(`${parenCount} closing paren(s)`);
  }
  if (bracketCount > 0) {
    result += ']'.repeat(bracketCount);
    changes.push(`${bracketCount} closing bracket(s)`);
  }

  return {
    code: result,
    changed: changes.length > 0,
    description: changes.length > 0 ? `Added ${changes.join(', ')}` : ""
  };
}

/**
 * #7: Remove dangling commas/semicolons before } or EOF
 * Fixes: ,} → }
 */
export function fixTrailingCommasOrSemicolons(code: string): SanitizerResult {
  const replaced = code
    .replace(/[,;]\s*}/g, '}')
    .replace(/[,;]\s*$/gm, ''); // End of line
  return {
    code: replaced,
    changed: replaced !== code,
    description: "Trailing commas/semicolons removed"
  };
}

/**
 * #8: Strip accidental markdown code fences
 * Fixes: ```ts ... ``` → raw code
 */
export function removeBacktickFences(code: string): SanitizerResult {
  const replaced = code
    .replace(/^```(?:ts|typescript|javascript|js)?\n/gm, '')
    .replace(/^```\s*$/gm, '');
  return {
    code: replaced,
    changed: replaced !== code,
    description: "Markdown code fences removed"
  };
}

/**
 * #9: Convert mixed tabs/spaces to 2 spaces
 * Prevents parse issues in nested JSX
 */
export function normalizeIndentation(code: string): SanitizerResult {
  const replaced = code.replace(/\t/g, '  '); // Tab → 2 spaces
  return {
    code: replaced,
    changed: replaced !== code,
    description: "Indentation normalized (tabs → 2 spaces)"
  };
}

/**
 * #10: Quote bare module specifiers with / or @
 * Fixes: import x from types/react → import x from 'types/react'
 */
export function ensureValidImportSyntax(code: string): SanitizerResult {
  const replaced = code.replace(
    /import\s+(.+?)\s+from\s+([a-zA-Z0-9_@\-\/\.]+)(?=\s|;|$)/g,
    (match, imports, moduleName) => {
      // Skip if already quoted
      if (moduleName.startsWith("'") || moduleName.startsWith('"')) {
        return match;
      }
      // Quote if contains / or @
      if (moduleName.includes('/') || moduleName.includes('@')) {
        return `import ${imports} from '${moduleName}'`;
      }
      return match;
    }
  );
  return {
    code: replaced,
    changed: replaced !== code,
    description: "Import paths quoted"
  };
}

// ==============================================================================
// 🧠 SEMANTIC-ASSIST FIXES (Priority 3 - Optional)
// ==============================================================================

/**
 * #11: Detect patterns like SomeType() and comment them out if likely invalid
 * Prevents TS2349 (Cannot invoke expression whose type lacks call signature)
 */
export function fixNamespaceCallables(code: string): SanitizerResult {
  // Simple heuristic: PascalCase identifiers followed by ()
  const replaced = code.replace(
    /\b([A-Z][a-zA-Z0-9]*)\(\)/g,
    (match, typeName) => {
      // Common valid patterns to skip
      const validCallables = ['React', 'Component', 'Object', 'Array', 'String', 'Number', 'Boolean', 'Date'];
      if (validCallables.includes(typeName)) {
        return match;
      }
      // Comment out suspicious ones
      return `/* ${match} */`;
    }
  );
  return {
    code: replaced,
    changed: replaced !== code,
    description: "Suspicious type calls commented out"
  };
}

/**
 * #12: Remove consecutive identical export statements
 */
export function stripDuplicateExports(code: string): SanitizerResult {
  const lines = code.split('\n');
  const seen = new Set<string>();
  const filtered: string[] = [];
  let changed = false;

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('export ')) {
      if (seen.has(trimmed)) {
        changed = true;
        continue; // Skip duplicate
      }
      seen.add(trimmed);
    }
    filtered.push(line);
  }

  return {
    code: filtered.join('\n'),
    changed,
    description: "Duplicate exports removed"
  };
}

/**
 * #13: Replace nested backticks like `Hello` with single backtick literal
 */
export function collapseNestedBackticks(code: string): SanitizerResult {
  // Look for patterns like `...`...` or `...`text`...`
  const replaced = code.replace(/`([^`]*)`([^`]*)`/g, '`$1$2`');
  return {
    code: replaced,
    changed: replaced !== code,
    description: "Nested backticks collapsed"
  };
}

// ==============================================================================
// MAIN SANITIZER
// ==============================================================================

/**
 * Run all sanitizer functions in priority order
 * Returns sanitized code + telemetry
 */
export function sanitizeTypeScript(code: string): SanitizerSummary {
  const changes: string[] = [];
  const preHash = simpleHash(code);
  const preSize = code.length;

  // Priority 1: Core mechanical fixes (always run)
  const coreFixes = [
    fixSmartQuotes,
    fixUnquotedModuleDeclarations,
    fixEmDashes,
    fixUnclosedTemplateLiterals,
    stripZeroWidthChars,
  ];

  // Priority 2: Syntax-level safety fixes
  const syntaxFixes = [
    removeBacktickFences,
    fixDanglingBracesAndParens,
    fixTrailingCommasOrSemicolons,
    normalizeIndentation,
    ensureValidImportSyntax,
  ];

  // Priority 3: Semantic-assist fixes (optional, lower priority)
  const semanticFixes = [
    stripDuplicateExports,
    collapseNestedBackticks,
    // fixNamespaceCallables, // Disabled by default - too aggressive
  ];

  const allFixes = [...coreFixes, ...syntaxFixes, ...semanticFixes];

  for (const fn of allFixes) {
    const result = fn(code);
    if (result.changed) {
      code = result.code;
      changes.push(result.description);
    }
  }

  const postHash = simpleHash(code);
  const postSize = code.length;

  return {
    sanitized: code,
    changes_made: changes,
    telemetry: {
      functions_triggered: changes.length,
      pre_size: preSize,
      post_size: postSize,
      pre_hash: preHash,
      post_hash: postHash,
    }
  };
}

/**
 * Simple hash function for telemetry
 */
function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return hash.toString(16);
}
