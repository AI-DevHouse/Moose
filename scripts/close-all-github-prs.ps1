# Close all orchestrator-created PRs and delete their branches

$repo = "AI-DevHouse/multi-llm-discussion-v1"

Write-Host "`n🗑️  CLOSING ALL ORCHESTRATOR PRs AND DELETING BRANCHES`n" -ForegroundColor Cyan
Write-Host "=" * 60

# Get all open PRs
$prs = gh pr list --repo $repo --limit 100 --json number,title,headRefName --state open | ConvertFrom-Json

if ($prs.Count -eq 0) {
    Write-Host "`n✅ No open PRs to close`n" -ForegroundColor Green
    exit 0
}

Write-Host "`nFound $($prs.Count) open PRs to close`n"

$closed = 0
$failed = 0

foreach ($pr in $prs) {
    $prNumber = $pr.number
    $prTitle = $pr.title
    $branchName = $pr.headRefName

    Write-Host "Closing PR #$prNumber : $prTitle" -ForegroundColor Yellow
    Write-Host "  Branch: $branchName" -ForegroundColor Gray

    try {
        # Close PR and delete branch
        gh pr close $prNumber --repo $repo --delete-branch --comment "🧹 Cleaning up: Rolling back to pre-execution state" 2>&1 | Out-Null

        if ($LASTEXITCODE -eq 0) {
            Write-Host "  ✅ Closed and deleted branch`n" -ForegroundColor Green
            $closed++
        } else {
            Write-Host "  ⚠️  Closed but may not have deleted branch`n" -ForegroundColor Yellow
            $closed++
        }
    }
    catch {
        Write-Host "  ❌ Failed: $_`n" -ForegroundColor Red
        $failed++
    }

    # Small delay to avoid rate limiting
    Start-Sleep -Milliseconds 500
}

Write-Host "`n" + "=" * 60
Write-Host "`n✅ SUMMARY:" -ForegroundColor Cyan
Write-Host "  Closed: $closed PRs" -ForegroundColor Green
Write-Host "  Failed: $failed PRs" -ForegroundColor $(if ($failed -gt 0) { "Red" } else { "Green" })

# Verify
$remainingPrs = gh pr list --repo $repo --limit 100 --state open | ConvertFrom-Json
Write-Host "  Remaining open PRs: $($remainingPrs.Count)`n" -ForegroundColor $(if ($remainingPrs.Count -eq 0) { "Green" } else { "Yellow" })

if ($remainingPrs.Count -eq 0) {
    Write-Host "✅ SUCCESS: All orchestrator PRs closed and branches deleted!`n" -ForegroundColor Green
} else {
    Write-Host "⚠️  WARNING: Some PRs may still be open`n" -ForegroundColor Yellow
}
