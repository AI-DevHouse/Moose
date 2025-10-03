# Rate Limit Configuration

**Last Updated:** 2025-10-03
**System Type:** Single-User
**Purpose:** Prevent hitting external LLM API quotas

---

## Overview

Moose Mission Control is a **single-user system**. Rate limiting is configured to **prevent hitting external LLM API provider limits**, not to prevent abuse.

**Key Principle:** Rate limits match the most restrictive upstream API tier.

---

## LLM API Provider Limits (Tier 1)

### Claude Sonnet 4.5 (Anthropic)
```
RPM (Requests Per Minute): 50
Input TPM (Tokens Per Minute): 30,000
Output TPM (Tokens Per Minute): 8,000
```

**Environment Variables:**
```env
CLAUDE_SONNET_45_RPM=50
CLAUDE_SONNET_45_INPUT_TPM=30000
CLAUDE_SONNET_45_OUTPUT_TPM=8000
```

### OpenAI GPT-4o Mini
```
RPM (Requests Per Minute): 500
TPM (Tokens Per Minute): 500,000
```

**Environment Variables:**
```env
GPT4O_MINI_RPM=500
GPT4O_MINI_TPM=500000
```

---

## Rate Limiter Configuration

**File:** `src/lib/rate-limiter.ts`

### API-Specific Limiters

**1. Claude Sonnet Limiter**
```typescript
export const claudeSonnetLimiter = createRateLimiter({
  windowMs: 60 * 1000,   // 1 minute
  maxRequests: 50,       // Claude Tier 1 RPM limit
});
```

**2. GPT-4o Mini Limiter**
```typescript
export const gpt4oMiniLimiter = createRateLimiter({
  windowMs: 60 * 1000,   // 1 minute
  maxRequests: 500,      // OpenAI Tier 1 RPM limit
});
```

**3. Architect API Limiter**
```typescript
// Uses Claude Sonnet 4.5 exclusively
export const architectApiLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  maxRequests: 50,       // Match Claude's limit
});
```

**4. Proposer API Limiter**
```typescript
// Mixed usage (Claude + OpenAI), use more restrictive limit
export const proposerApiLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  maxRequests: 50,       // Use Claude's limit (lower)
});
```

**5. Internal API Limiter**
```typescript
// Local operations only (no external LLM calls)
export const internalApiLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  maxRequests: 1000,     // Generous, database-only operations
});
```

---

## Endpoint Rate Limits

| Endpoint | Limiter | RPM Limit | Reason |
|----------|---------|-----------|--------|
| `/api/architect/decompose` | `architectApiLimiter` | 50 | Claude Sonnet 4.5 API |
| `/api/proposer-enhanced` | `proposerApiLimiter` | 50 | Mixed (Claude + OpenAI) |
| `/api/director/approve` | `internalApiLimiter` | 1000 | Local logic only |
| `/api/manager` | `internalApiLimiter` | 1000 | Local routing logic |
| `/api/client-manager/escalate` | `internalApiLimiter` | 1000 | Local database writes |
| `/api/work-orders` | `internalApiLimiter` | 1000 | Database operations |

---

## Why These Limits?

### Single-User System Context

**NOT protecting against:**
- ❌ Malicious users (single user, trusted)
- ❌ DOS attacks (local environment)
- ❌ Abuse (no public access)

**PROTECTING against:**
- ✅ **Hitting Claude's 50 RPM limit** (429 errors from Anthropic)
- ✅ **Hitting OpenAI's 500 RPM limit** (rate limit errors)
- ✅ **Token-per-minute limits** (input/output quotas)
- ✅ **Accidental runaway loops** (bugs causing infinite requests)

### Example Scenario

**Without Rate Limiting:**
```typescript
// Architect orchestrator accidentally polls every 100ms
for (let i = 0; i < 100; i++) {
  await fetch('/api/architect/decompose', { ... });
}
// Result: 100 requests in 10 seconds = Claude API rejects requests 51-100
```

**With Rate Limiting (50 RPM):**
```typescript
// Same bug, but rate limiter prevents API quota breach
for (let i = 0; i < 100; i++) {
  await fetch('/api/architect/decompose', { ... });
}
// Result: First 50 succeed, requests 51-100 get 429 from rate limiter
// Claude API never sees the excess requests, quota preserved
```

---

## Upgrading API Tiers

### If You Upgrade to Higher Tiers

**Claude Sonnet 4.5 - Tier 2 Limits:**
```
RPM: 1,000
Input TPM: 80,000
Output TPM: 16,000
```

**Update Configuration:**
```typescript
// src/lib/rate-limiter.ts
export const architectApiLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  maxRequests: 1000,  // Updated from 50
});
```

**OpenAI GPT-4o Mini - Tier 2 Limits:**
```
RPM: 5,000
TPM: 2,000,000
```

**Update Configuration:**
```typescript
export const gpt4oMiniLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  maxRequests: 5000,  // Updated from 500
});
```

---

## Token-Per-Minute (TPM) Limits

**Current Implementation:** Only tracks RPM (requests per minute)

**Future Enhancement:** Track TPM (tokens per minute) for more accurate quota management

**Why Not Implemented Yet:**
- RPM is simpler and covers most use cases
- Token counting requires estimating prompt + completion tokens
- Claude Sonnet 4.5's 30k input TPM / 50 RPM = ~600 tokens per request average
- Architect calls use ~7500 tokens/request, well within limits (7500 * 50 = 375k < 30k? NO!)

**⚠️ ISSUE IDENTIFIED:** Architect decomposition uses ~7500 input tokens per call. At 50 RPM, that's 375,000 tokens/minute, which **exceeds Claude's 30k input TPM limit**.

**Recommended Fix:**
```typescript
// Adjust Architect limiter to respect TPM limit
export const architectApiLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  maxRequests: 4,  // 30,000 TPM / 7,500 tokens per request = 4 RPM
});
```

---

## Monitoring Rate Limits

### Check Current Usage

```typescript
import { architectApiLimiter } from '@/lib/rate-limiter';

const stats = architectApiLimiter.stats();
console.log(stats);
// { totalKeys: 1, activeKeys: 1 }
```

### Reset Rate Limit (Testing)

```typescript
import { architectApiLimiter } from '@/lib/rate-limiter';

// Reset for specific identifier (IP address)
architectApiLimiter.reset('127.0.0.1');
```

---

## Response Headers

**All rate-limited responses include:**
```
X-RateLimit-Limit: 50
X-RateLimit-Remaining: 42
X-RateLimit-Reset: 1696348920
```

**429 Too Many Requests Response:**
```json
{
  "error": "Rate limit exceeded",
  "message": "Too many requests. Please try again in 15 seconds.",
  "retryAfter": 15
}
```

---

## Recommended Configuration Updates

### Critical: Architect API TPM Limit

**Current (INCORRECT):**
```typescript
maxRequests: 50  // Exceeds 30k TPM limit
```

**Recommended (CORRECT):**
```typescript
maxRequests: 4   // 4 requests * 7500 tokens = 30k TPM
```

**Alternative:** Reduce prompt size to fit more requests
- Reduce Architect prompt from 7500 to 600 tokens
- Allows 50 requests * 600 tokens = 30k TPM

---

## Summary

**Rate Limiting Purpose:** Prevent hitting external LLM API quotas (single-user system)

**Current Configuration:**
- Architect API: 50 RPM (⚠️ EXCEEDS TPM, needs adjustment)
- Proposer API: 50 RPM (mixed Claude + OpenAI)
- Internal APIs: 1000 RPM (no LLM calls)

**Action Required:**
1. Reduce Architect API limiter to 4 RPM (respect TPM limit)
2. Monitor actual token usage per request
3. Adjust limits based on real usage patterns

---

**Last Updated:** 2025-10-03
**Next Review:** After first production deployment
