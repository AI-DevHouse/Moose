/**
 * Rate Limiter Middleware
 *
 * Implements token bucket algorithm for rate limiting API requests
 *
 * Usage:
 *   import { createRateLimiter } from '@/lib/rate-limiter';
 *
 *   const limiter = createRateLimiter({
 *     windowMs: 60 * 1000,  // 1 minute
 *     maxRequests: 10,       // 10 requests per minute
 *   });
 *
 *   const { allowed, remaining, resetAt } = await limiter.check(ipAddress);
 *   if (!allowed) {
 *     return new Response('Rate limit exceeded', { status: 429 });
 *   }
 */

import { cache } from '@/lib/cache';

interface RateLimitConfig {
  windowMs: number;      // Time window in milliseconds
  maxRequests: number;   // Max requests per window
}

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
  retryAfter?: number;  // Seconds until reset
}

class RateLimiter {
  private config: RateLimitConfig;
  private store: Map<string, RateLimitEntry>;

  constructor(config: RateLimitConfig) {
    this.config = config;
    this.store = new Map();

    // Cleanup expired entries every minute
    setInterval(() => this.cleanup(), 60 * 1000);
  }

  /**
   * Check if request is allowed for given identifier (usually IP address)
   */
  async check(identifier: string): Promise<RateLimitResult> {
    const now = Date.now();
    const key = `ratelimit:${identifier}`;

    // Get or create entry
    let entry = this.store.get(key);

    if (!entry || entry.resetAt <= now) {
      // Create new entry (window expired or doesn't exist)
      entry = {
        count: 1,
        resetAt: now + this.config.windowMs,
      };
      this.store.set(key, entry);

      return {
        allowed: true,
        remaining: this.config.maxRequests - 1,
        resetAt: entry.resetAt,
      };
    }

    // Increment counter
    entry.count++;

    if (entry.count <= this.config.maxRequests) {
      // Request allowed
      return {
        allowed: true,
        remaining: this.config.maxRequests - entry.count,
        resetAt: entry.resetAt,
      };
    }

    // Rate limit exceeded
    const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
    return {
      allowed: false,
      remaining: 0,
      resetAt: entry.resetAt,
      retryAfter,
    };
  }

  /**
   * Reset rate limit for identifier (useful for testing or manual overrides)
   */
  reset(identifier: string): void {
    const key = `ratelimit:${identifier}`;
    this.store.delete(key);
  }

  /**
   * Cleanup expired entries
   */
  private cleanup(): void {
    const now = Date.now();
    const entries = Array.from(this.store.entries());
    for (const [key, entry] of entries) {
      if (entry.resetAt <= now) {
        this.store.delete(key);
      }
    }
  }

  /**
   * Get current statistics
   */
  stats(): { totalKeys: number; activeKeys: number } {
    const now = Date.now();
    let activeKeys = 0;

    const values = Array.from(this.store.values());
    for (const entry of values) {
      if (entry.resetAt > now) {
        activeKeys++;
      }
    }

    return {
      totalKeys: this.store.size,
      activeKeys,
    };
  }
}

/**
 * Factory function to create rate limiter instances
 */
export function createRateLimiter(config: RateLimitConfig): RateLimiter {
  return new RateLimiter(config);
}

/**
 * Pre-configured rate limiters for different API tiers
 *
 * SINGLE-USER SYSTEM: Rate limits align with LLM API provider limits
 * to prevent hitting external API quotas, not to prevent abuse.
 */

// Claude Sonnet 4.5 Tier 1 Limits: 50 RPM, 30k input TPM, 8k output TPM
export const claudeSonnetLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  maxRequests: 50, // Match Claude's 50 RPM limit
});

// OpenAI GPT-4o Mini Tier 1 Limits: 500 RPM, 500k TPM
export const gpt4oMiniLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  maxRequests: 500, // Match OpenAI's 500 RPM limit
});

// Architect API - Uses Claude Sonnet 4.5
// Claude Sonnet 4.x actual limits: 1,000 RPM, 450k input TPM, 90k output TPM
// Previously set to 4 req/min based on incorrect TPM assumption (30k instead of 450k)
// Setting to 100 req/min (conservative, well below 1000 RPM limit)
// Output TPM (90k) is the real constraint for high-volume use
export const architectApiLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  maxRequests: 100, // Conservative limit, actual API supports 1000 RPM
});

// Proposer API - Mixed (Claude + OpenAI), use lower limit
export const proposerApiLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  maxRequests: 50, // Use Claude's limit (more restrictive)
});

// Internal APIs (no LLM calls) - Generous limit
export const internalApiLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  maxRequests: 1000, // Local database operations, no external API
});

// Legacy aliases (for backward compatibility)
export const publicApiLimiter = architectApiLimiter;
export const authenticatedApiLimiter = internalApiLimiter;
export const adminApiLimiter = internalApiLimiter;

/**
 * Extract IP address from request
 */
export function getClientIP(request: Request): string {
  // Try various headers (Vercel, Cloudflare, etc.)
  const headers = request.headers;

  const forwardedFor = headers.get('x-forwarded-for');
  if (forwardedFor) {
    return forwardedFor.split(',')[0].trim();
  }

  const realIP = headers.get('x-real-ip');
  if (realIP) {
    return realIP;
  }

  const cfConnectingIP = headers.get('cf-connecting-ip');
  if (cfConnectingIP) {
    return cfConnectingIP;
  }

  // Fallback (for local development)
  return 'unknown';
}

/**
 * Middleware helper to apply rate limiting to API routes
 */
export async function withRateLimit(
  request: Request,
  limiter: RateLimiter,
  handler: () => Promise<Response>
): Promise<Response> {
  const ip = getClientIP(request);
  const { allowed, remaining, resetAt, retryAfter } = await limiter.check(ip);

  if (!allowed) {
    return new Response(
      JSON.stringify({
        error: 'Rate limit exceeded',
        message: `Too many requests. Please try again in ${retryAfter} seconds.`,
        retryAfter,
      }),
      {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          'X-RateLimit-Limit': String(limiter['config'].maxRequests),
          'X-RateLimit-Remaining': String(remaining),
          'X-RateLimit-Reset': String(Math.floor(resetAt / 1000)),
          'Retry-After': String(retryAfter),
        },
      }
    );
  }

  // Execute handler
  const response = await handler();

  // Add rate limit headers to response
  const headers = new Headers(response.headers);
  headers.set('X-RateLimit-Limit', String(limiter['config'].maxRequests));
  headers.set('X-RateLimit-Remaining', String(remaining));
  headers.set('X-RateLimit-Reset', String(Math.floor(resetAt / 1000)));

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
