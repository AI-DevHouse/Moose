# Session Start Automation Script
# Run this at the start of every session

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "SESSION START: Moose Mission Control" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

$errors = 0

# 1. Regenerate Supabase types
Write-Host "1. Regenerating Supabase types from live database..." -ForegroundColor Yellow
try {
    npx supabase gen types typescript --project-id qclxdnbvoruvqnhsshjr > src/types/supabase.ts
    if ($LASTEXITCODE -eq 0) {
        Write-Host "   V Types regenerated successfully" -ForegroundColor Green
    } else {
        Write-Host "   X Type regeneration failed (exit code: $LASTEXITCODE)" -ForegroundColor Red
        $errors++
    }
} catch {
    Write-Host "   X Type regeneration error: $_" -ForegroundColor Red
    $errors++
}

# 2. TypeScript compilation check
Write-Host "`n2. Checking TypeScript compilation..." -ForegroundColor Yellow
try {
    $tsOutput = npx tsc --noEmit 2>&1 | Out-String
    $errorMatch = $tsOutput | Select-String "Found (\d+) errors?"

    if ($errorMatch) {
        $errorCount = $errorMatch.Matches.Groups[1].Value
        Write-Host "   X TypeScript errors found: $errorCount" -ForegroundColor Red
        Write-Host "   Run 'npx tsc --noEmit' to see details" -ForegroundColor Yellow
        $errors++
    } else {
        Write-Host "   V 0 TypeScript errors" -ForegroundColor Green
    }
} catch {
    Write-Host "   X TypeScript check error: $_" -ForegroundColor Red
    $errors++
}

# 3. Git status
Write-Host "`n3. Git status:" -ForegroundColor Yellow
git status --short
Write-Host "`nRecent commits:" -ForegroundColor Yellow
git log --oneline -5

# Summary
Write-Host "`n========================================" -ForegroundColor Cyan
if ($errors -eq 0) {
    Write-Host "V READY TO START WORK" -ForegroundColor Green
    Write-Host "========================================`n" -ForegroundColor Cyan
    Write-Host "Next steps:" -ForegroundColor White
    Write-Host "1. Run integration tests: .\phase1-2-integration-test.ps1" -ForegroundColor White
    Write-Host "2. Answer verification questions in docs/session-state.md" -ForegroundColor White
    Write-Host "3. Review docs/known-issues.md for active problems`n" -ForegroundColor White
} else {
    Write-Host "X $errors ERRORS DETECTED" -ForegroundColor Red
    Write-Host "========================================`n" -ForegroundColor Cyan
    Write-Host "Fix errors above before proceeding`n" -ForegroundColor Yellow
}
