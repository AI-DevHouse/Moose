# Phase 2 Test Diagnosis Report
**Date:** 2025-10-07
**Issue:** API returning 500 Internal Server Error on `/api/architect/decompose`

---

## Evidence Gathered

### 1. Build & Compilation Status
- ✅ **TypeScript**: 0 errors
- ✅ **Build**: Completes successfully
- ✅ **Route registered**: `/api/architect/decompose` shows in build output

### 2. Server Health
- ✅ **Local dev server**: Running on localhost:3000
- ✅ **Health endpoint (local)**: Returns 200 OK
- ✅ **Health endpoint (deployed)**: Returns 200 OK at `https://moose-indol.vercel.app`

### 3. Environment Variables
- ✅ **ANTHROPIC_API_KEY**: Present in .env.local
- ✅ **NEXT_PUBLIC_SUPABASE_URL**: Present in .env.local
- ✅ **SUPABASE_SERVICE_ROLE_KEY**: Present in .env.local
- ⚠️ **Vercel deployment**: Unknown if env vars configured

### 4. Test Payloads
- **Full payload**: 1528 bytes, includes wireframes + contracts flags
- **Minimal payload**: 99 bytes, basic spec only (no options)
- ❌ **Both fail with 500** (even minimal payload)

### 5. Timing
- Local dev server: ~9 seconds before 500 error
- Deployed server: ~60-68 seconds before 500 error (timeout-like)

---

## Possible Root Causes (Ranked by Likelihood)

### **HIGH PROBABILITY**

#### 1. **Missing/Invalid Environment Variables on Vercel** ⭐⭐⭐⭐⭐
- **Evidence**:
  - Local .env.local has all required vars
  - Vercel deployment status unknown
  - We just pushed new code requiring ANTHROPIC_API_KEY
- **Impact**: Both wireframe-service and contract-service constructors will fail
- **Test**: Check Vercel environment variables in dashboard

#### 2. **Module Import Error** ⭐⭐⭐⭐
- **Evidence**:
  - New imports: `wireframe-service.ts`, `contract-service.ts`
  - Both services initialize in constructors
  - Error happens even with minimal payload (before options checked)
- **Impact**: Service initialization fails at import time
- **Test**: Check if singleton getInstance() is throwing during import

#### 3. **Supabase Client Initialization Failure** ⭐⭐⭐⭐
- **Evidence**:
  - wireframe-service creates Supabase client in constructor
  - Service role key might be invalid/missing
  - Happens even when generateWireframes=false
- **Impact**: Constructor throws, breaks entire module load
- **Test**: Make Supabase client initialization optional/lazy

---

### **MEDIUM PROBABILITY**

#### 4. **Rate Limiting Timing Out** ⭐⭐⭐
- **Evidence**:
  - 60-68 second timeouts on deployed version
  - Rate limiter uses Redis/memory store
- **Impact**: Request hangs waiting for rate limit check
- **Test**: Check if rate limiter is configured correctly

#### 5. **Contract Service Detection Logic** ⭐⭐
- **Evidence**:
  - New contract-service has complex detection logic
  - Runs even when generateContracts=false (in future calls)
- **Impact**: Hangs or throws during work order analysis
- **Test**: Add logging to contract service

---

### **LOW PROBABILITY**

#### 6. **Payload Parsing Issue** ⭐
- **Evidence**:
  - API route has complex payload extraction logic
  - Both formats failing suggests before-parsing issue
- **Impact**: JSON parsing throws
- **Test**: Already ruled out - validation would return 400, not 500

#### 7. **Vercel Deployment Not Complete** ⭐
- **Evidence**:
  - Pushed 3-4 minutes before first test
  - Health endpoint works (suggests deployment complete)
- **Impact**: Running old code without new services
- **Test**: Wait longer, check deployment logs

---

## Key Observations

1. **Error is IMMEDIATE** - happens at module initialization, not during execution
2. **No differentiation between payloads** - minimal and full both fail identically
3. **Local AND deployed both fail** - suggests code issue, not deployment
4. **Health endpoint works** - server is running, routing works
5. **Build succeeds** - no compilation errors

---

## Most Likely Cause: Constructor Initialization Failure

The pattern suggests **services are failing to initialize in their constructors**:

```typescript
// wireframe-service.ts constructor
this.supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,    // ← Might be undefined
  process.env.SUPABASE_SERVICE_ROLE_KEY!    // ← Might be undefined
);

// contract-service.ts constructor
this.anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!    // ← Might be undefined
});
```

If these env vars are undefined:
- Non-null assertion (`!`) doesn't prevent undefined from being passed
- Supabase/Anthropic clients throw during construction
- Entire module import fails
- Server returns 500

---

## Recommended Fix Approach

### **Option A: Defensive Constructor Initialization (RECOMMENDED)** ⭐⭐⭐⭐⭐

Make service initialization safe:

```typescript
// wireframe-service.ts
private constructor() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anthropicKey = process.env.ANTHROPIC_API_KEY;

  if (!anthropicKey) {
    throw new Error('ANTHROPIC_API_KEY environment variable is required');
  }

  this.anthropic = new Anthropic({ apiKey: anthropicKey });

  // Make Supabase optional - only needed if actually generating wireframes
  if (supabaseUrl && supabaseKey) {
    this.supabase = createClient(supabaseUrl, supabaseKey);
  }
}

async generateWireframe(request: WireframeRequest): Promise<WireframeResult> {
  if (!this.supabase) {
    throw new Error('Supabase not configured - cannot generate wireframes');
  }
  // ... rest of implementation
}
```

**Pros:**
- Provides clear error messages
- Allows partial functionality (contracts without wireframes)
- Fails fast with useful info

**Cons:**
- Requires code changes
- Need to redeploy

---

### **Option B: Verify Environment Variables First** ⭐⭐⭐⭐

1. Check Vercel dashboard: Project Settings → Environment Variables
2. Ensure these are set:
   - `ANTHROPIC_API_KEY`
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
3. Redeploy if missing

**Pros:**
- Quick check
- No code changes if vars just missing

**Cons:**
- If vars ARE set, doesn't explain local failure

---

### **Option C: Add Logging/Debugging** ⭐⭐⭐

Add console.log to constructors to see where failure happens:

```typescript
private constructor() {
  console.log('[WireframeService] Initializing...');
  console.log('[WireframeService] ANTHROPIC_API_KEY present:', !!process.env.ANTHROPIC_API_KEY);
  console.log('[WireframeService] SUPABASE_URL present:', !!process.env.NEXT_PUBLIC_SUPABASE_URL);
  // ... rest
}
```

**Pros:**
- Pinpoints exact failure
- Minimal code changes

**Cons:**
- Requires redeploy to see logs
- Still need to fix underlying issue

---

## Recommended Next Steps

1. **Immediate**: Check Vercel environment variables (30 seconds)
2. **If vars missing**: Add them and redeploy (2 minutes)
3. **If vars present**: Implement Option A defensive constructors (10 minutes)
4. **Test**: Use minimal payload first, then full payload (2 minutes)
5. **If still failing**: Add debug logging (Option C) and analyze (15 minutes)

---

## Questions for User

1. **Are environment variables set in Vercel dashboard?**
2. **Should we proceed with defensive constructor approach?**
3. **Or would you prefer to investigate Vercel logs first?**
