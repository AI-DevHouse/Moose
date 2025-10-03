/**
 * Input Sanitization Utilities
 *
 * Protects against common injection attacks and malicious input
 *
 * Usage:
 *   import { sanitizeString, sanitizeJSON, validateWorkOrder } from '@/lib/input-sanitizer';
 *
 *   const cleanTitle = sanitizeString(userInput.title);
 *   const cleanSpec = sanitizeJSON(userInput.spec);
 */

/**
 * Sanitize string input - removes dangerous characters and limits length
 */
export function sanitizeString(
  input: string,
  maxLength: number = 1000
): string {
  if (typeof input !== 'string') {
    throw new Error('Input must be a string');
  }

  // Trim whitespace
  let sanitized = input.trim();

  // Remove null bytes (can cause issues in some contexts)
  sanitized = sanitized.replace(/\0/g, '');

  // Remove control characters except newlines and tabs
  sanitized = sanitized.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');

  // Limit length
  if (sanitized.length > maxLength) {
    sanitized = sanitized.substring(0, maxLength);
  }

  return sanitized;
}

/**
 * Sanitize HTML - escape dangerous characters
 */
export function sanitizeHTML(input: string): string {
  if (typeof input !== 'string') {
    throw new Error('Input must be a string');
  }

  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
}

/**
 * Sanitize JSON object - recursively sanitize strings in object
 */
export function sanitizeJSON(obj: any, maxDepth: number = 10): any {
  if (maxDepth <= 0) {
    throw new Error('Maximum recursion depth exceeded');
  }

  if (obj === null || obj === undefined) {
    return obj;
  }

  if (typeof obj === 'string') {
    return sanitizeString(obj, 10000); // Allow longer strings in JSON
  }

  if (typeof obj === 'number' || typeof obj === 'boolean') {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => sanitizeJSON(item, maxDepth - 1));
  }

  if (typeof obj === 'object') {
    const sanitized: any = {};
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        // Sanitize key
        const cleanKey = sanitizeString(key, 100);
        // Sanitize value
        sanitized[cleanKey] = sanitizeJSON(obj[key], maxDepth - 1);
      }
    }
    return sanitized;
  }

  // Unknown type, return as-is
  return obj;
}

/**
 * Validate email format (basic validation)
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Validate URL format and check for dangerous protocols
 */
export function isValidURL(url: string): boolean {
  try {
    const parsed = new URL(url);
    // Only allow http and https protocols
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Sanitize file path - prevent directory traversal attacks
 */
export function sanitizeFilePath(path: string): string {
  // Remove null bytes
  let sanitized = path.replace(/\0/g, '');

  // Remove directory traversal sequences
  sanitized = sanitized.replace(/\.\./g, '');
  sanitized = sanitized.replace(/\\/g, '/'); // Normalize slashes

  // Remove leading slashes
  sanitized = sanitized.replace(/^\/+/, '');

  return sanitized;
}

/**
 * Validate and sanitize work order input
 */
export interface WorkOrderInput {
  title: string;
  description: string;
  acceptance_criteria?: string[];
  files_in_scope?: string[];
}

export function validateWorkOrder(input: any): WorkOrderInput {
  if (!input || typeof input !== 'object') {
    throw new Error('Invalid work order input');
  }

  // Required fields
  if (!input.title || typeof input.title !== 'string') {
    throw new Error('Work order title is required');
  }

  if (!input.description || typeof input.description !== 'string') {
    throw new Error('Work order description is required');
  }

  // Sanitize and validate
  const sanitized: WorkOrderInput = {
    title: sanitizeString(input.title, 200),
    description: sanitizeString(input.description, 5000),
  };

  // Optional fields
  if (input.acceptance_criteria) {
    if (!Array.isArray(input.acceptance_criteria)) {
      throw new Error('acceptance_criteria must be an array');
    }
    sanitized.acceptance_criteria = input.acceptance_criteria.map((ac: any) =>
      sanitizeString(String(ac), 500)
    );
  }

  if (input.files_in_scope) {
    if (!Array.isArray(input.files_in_scope)) {
      throw new Error('files_in_scope must be an array');
    }
    sanitized.files_in_scope = input.files_in_scope.map((file: any) =>
      sanitizeFilePath(String(file))
    );
  }

  // Validate title length
  if (sanitized.title.length < 5) {
    throw new Error('Title must be at least 5 characters');
  }

  // Validate description length
  if (sanitized.description.length < 10) {
    throw new Error('Description must be at least 10 characters');
  }

  return sanitized;
}

/**
 * Validate and sanitize technical spec input (for Architect)
 */
export interface TechnicalSpecInput {
  feature_name: string;
  objectives: string[];
  constraints: string[];
  acceptance_criteria: string[];
}

export function validateTechnicalSpec(input: any): TechnicalSpecInput {
  if (!input || typeof input !== 'object') {
    throw new Error('Invalid technical spec input');
  }

  // Required fields
  if (!input.feature_name || typeof input.feature_name !== 'string') {
    throw new Error('feature_name is required');
  }

  if (!Array.isArray(input.objectives) || input.objectives.length === 0) {
    throw new Error('objectives must be a non-empty array');
  }

  if (!Array.isArray(input.constraints)) {
    throw new Error('constraints must be an array');
  }

  if (!Array.isArray(input.acceptance_criteria) || input.acceptance_criteria.length === 0) {
    throw new Error('acceptance_criteria must be a non-empty array');
  }

  // Sanitize
  const sanitized: TechnicalSpecInput = {
    feature_name: sanitizeString(input.feature_name, 200),
    objectives: input.objectives.map((obj: any) =>
      sanitizeString(String(obj), 1000)
    ),
    constraints: input.constraints.map((con: any) =>
      sanitizeString(String(con), 1000)
    ),
    acceptance_criteria: input.acceptance_criteria.map((ac: any) =>
      sanitizeString(String(ac), 1000)
    ),
  };

  // Validate lengths
  if (sanitized.feature_name.length < 3) {
    throw new Error('feature_name must be at least 3 characters');
  }

  if (sanitized.objectives.length > 20) {
    throw new Error('Too many objectives (max 20)');
  }

  if (sanitized.constraints.length > 20) {
    throw new Error('Too many constraints (max 20)');
  }

  if (sanitized.acceptance_criteria.length > 20) {
    throw new Error('Too many acceptance criteria (max 20)');
  }

  return sanitized;
}

/**
 * Check for SQL injection patterns (basic detection)
 */
export function containsSQLInjection(input: string): boolean {
  const sqlPatterns = [
    /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|UNION)\b)/i,
    /(--|\;|\/\*|\*\/)/,
    /('|('')|(--)|(;)|(\|\|))/,
  ];

  return sqlPatterns.some((pattern) => pattern.test(input));
}

/**
 * Check for XSS patterns (basic detection)
 */
export function containsXSS(input: string): boolean {
  const xssPatterns = [
    /<script[^>]*>.*?<\/script>/gi,
    /javascript:/gi,
    /on\w+\s*=/gi, // onclick, onload, etc.
    /<iframe/gi,
    /<object/gi,
    /<embed/gi,
  ];

  return xssPatterns.some((pattern) => pattern.test(input));
}

/**
 * Comprehensive security check
 */
export function securityCheck(input: string): {
  safe: boolean;
  threats: string[];
} {
  const threats: string[] = [];

  if (containsSQLInjection(input)) {
    threats.push('SQL injection');
  }

  if (containsXSS(input)) {
    threats.push('XSS');
  }

  // Check for path traversal
  if (input.includes('../') || input.includes('..\\')) {
    threats.push('Path traversal');
  }

  // Check for null bytes
  if (input.includes('\0')) {
    threats.push('Null byte injection');
  }

  return {
    safe: threats.length === 0,
    threats,
  };
}
