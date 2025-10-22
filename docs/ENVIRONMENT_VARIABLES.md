# Moose Mission Control - Environment Variables

This document lists all environment variables used in Moose Mission Control.

**Setup:** Create a `.env.local` file in the project root with these variables. DO NOT commit `.env.local` to version control.

---

## Required Variables

### Supabase Configuration

Get these from your Supabase project settings: https://app.supabase.com/project/_/settings/api

- **NEXT_PUBLIC_SUPABASE_URL** - Your Supabase project URL
  - Example: `https://xxxxx.supabase.co`

- **NEXT_PUBLIC_SUPABASE_ANON_KEY** - Your Supabase anonymous key
  - Used for client-side operations

- **SUPABASE_SERVICE_ROLE_KEY** - Your Supabase service role key
  - Used for server-side operations with elevated permissions

### LLM API Keys

- **ANTHROPIC_API_KEY** - Anthropic API key for Claude models
  - Get from: https://console.anthropic.com/settings/keys
  - Used by proposer for code generation

- **OPENAI_API_KEY** - OpenAI API key for GPT models
  - Get from: https://platform.openai.com/api-keys
  - Used by proposer for code generation

---

## Optional Variables

### Application Configuration

- **NEXT_PUBLIC_SITE_URL**
  - Default: `http://localhost:3000`
  - Production: Set to your deployed domain (e.g., `https://moose.example.com`)
  - Used for API endpoint construction

- **NODE_ENV**
  - Default: `development`
  - Options: `development`, `production`, `test`

### Orchestrator Configuration

- **ORCHESTRATOR_MAX_CONCURRENT_EXECUTIONS**
  - Default: `15`
  - Maximum number of work orders executing simultaneously
  - Recommendation: Set based on system resources and API rate limits

### Worktree Pool Configuration

Controls isolated concurrent execution system.

- **WORKTREE_POOL_ENABLED**
  - Default: `true` (recommended for production)
  - Set to `false` to use shared directory mode (legacy)
  - Enables isolated git worktrees for concurrent WO execution

- **WORKTREE_POOL_SIZE**
  - Default: `15`
  - Number of worktrees to create in the pool
  - Must be >= `ORCHESTRATOR_MAX_CONCURRENT_EXECUTIONS`

- **WORKTREE_CLEANUP_ON_STARTUP**
  - Default: `false`
  - Set to `true` for production to auto-recover from crashes
  - Cleans up stale worktrees when daemon starts

### Bootstrap System Configuration

Controls automatic WO-0 generation for greenfield projects.

- **DISABLE_BOOTSTRAP_INJECTION**
  - Default: `false` (bootstrap enabled)
  - Set to `true` to disable bootstrap WO-0 injection
  - Use cases:
    - Emergency rollback if bootstrap system causes issues
    - Debugging greenfield detection logic
    - Established-projects-only mode
    - Temporary disable during system maintenance

### Aider Execution Configuration

Controls Aider code generation process behavior.

- **AIDER_TIMEOUT_MS**
  - Default: `300000` (5 minutes)
  - Maximum time in milliseconds for Aider to complete code generation
  - Increase for complex WOs that require more time
  - Recommendation:
    - Simple WOs: 300000 (5 min)
    - Complex UI/multi-file WOs: 600000 (10 min)
    - Large refactoring: 900000 (15 min)
  - If timeout occurs, exit code will be `null` and error indicates timeout

---

## Example .env.local

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=(your key here)
SUPABASE_SERVICE_ROLE_KEY=(your key here)

# LLM APIs
ANTHROPIC_API_KEY=(your key here)
OPENAI_API_KEY=(your key here)

# Application
NEXT_PUBLIC_SITE_URL=http://localhost:3000
NODE_ENV=development

# Orchestrator
ORCHESTRATOR_MAX_CONCURRENT_EXECUTIONS=15

# Worktree Pool
WORKTREE_POOL_ENABLED=true
WORKTREE_POOL_SIZE=15
WORKTREE_CLEANUP_ON_STARTUP=false

# Bootstrap System
DISABLE_BOOTSTRAP_INJECTION=false

# Aider Execution
AIDER_TIMEOUT_MS=300000
```

---

## Security Notes

1. **Never commit `.env.local`** to version control
2. **Never commit actual API keys** to the repository
3. **Use different API keys** for development and production
4. **Rotate API keys regularly** for security
5. **Service role keys** have elevated permissions - keep secure

---

## Troubleshooting

### Bootstrap not injecting WO-0

Check if `DISABLE_BOOTSTRAP_INJECTION=true` is set in your `.env.local`.

### Worktree pool not initializing

Check if `WORKTREE_POOL_ENABLED=false` is set. Set to `true` for concurrent execution.

### API rate limits reached

Reduce `ORCHESTRATOR_MAX_CONCURRENT_EXECUTIONS` to lower concurrent API calls.

### Stale worktrees after crash

Set `WORKTREE_CLEANUP_ON_STARTUP=true` to auto-cleanup on daemon restart.

---

Last updated: 2025-10-22 (Session v121)
