Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "PHASE 1-2 COMPREHENSIVE INTEGRATION TEST" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

$passed = 0
$failed = 0
$warnings = 0

function Test-Endpoint {
    param($Name, $Expected, $ScriptBlock)
    Write-Host "Testing: $Name" -ForegroundColor Yellow
    try {
        $result = & $ScriptBlock
        if ($result) {
            Write-Host "  V PASS" -ForegroundColor Green
            $script:passed++
            return $result
        } else {
            Write-Host "  X FAIL: $Expected" -ForegroundColor Red
            $script:failed++
            return $null
        }
    } catch {
        Write-Host "  X ERROR: $_" -ForegroundColor Red
        $script:failed++
        return $null
    }
}

Write-Host "`n=== PHASE 1.1: Mission Control ===" -ForegroundColor Cyan
Test-Endpoint "System Heartbeat" "200 OK" {
    $r = Invoke-RestMethod -Uri http://localhost:3000/api/system-heartbeat
    $r.status -eq "success"
}

Write-Host "`n=== PHASE 1.2: Data Infrastructure ===" -ForegroundColor Cyan
Test-Endpoint "Contract Validation Service" "operational" {
    $r = Invoke-RestMethod -Uri http://localhost:3000/api/contracts/validate
    $r.status -eq "operational"
}

Test-Endpoint "GitHub Events Database" "events retrievable" {
    $r = Invoke-RestMethod -Uri http://localhost:3000/api/github-events
    $r.success -eq $true
}

Write-Host "`n=== PHASE 1.3: GitHub Integration ===" -ForegroundColor Cyan
Test-Endpoint "GitHub API Connection" "authenticated" {
    $r = Invoke-RestMethod -Uri http://localhost:3000/api/github
    $r.success -eq $true
}

Test-Endpoint "Webhook Processing" "PR event processed" {
    $r = Invoke-RestMethod -Uri "http://localhost:3000/api/github/webhook" -Method POST -ContentType "application/json" -Headers @{"x-github-event"="pull_request"} -Body '{"action":"opened","pull_request":{"number":999},"repository":{"full_name":"AI-DevHouse/Moose","id":12345}}'
    $r.received -eq $true -and $r.processed -eq $true
}

Write-Host "`n=== PHASE 2.1: Manager LLM Service ===" -ForegroundColor Cyan
Test-Endpoint "LLM Service Basic" "work order generation" {
    $r = Invoke-RestMethod -Uri http://localhost:3000/api/llm-test
    $r.test_results.work_order_generation -eq "PASSED"
}

Write-Host "`n=== PHASE 2.2: Proposer Registry & Routing ===" -ForegroundColor Cyan
Test-Endpoint "Proposer Registry" "2 active proposers" {
    $r = Invoke-RestMethod -Uri http://localhost:3000/api/proposers
    $r.proposers.Count -eq 2
}

Test-Endpoint "Proposer Thresholds Correct" "claude=1.0, gpt=0.3" {
    $r = Invoke-RestMethod -Uri http://localhost:3000/api/proposers
    $claude = $r.proposers | Where-Object { $_.name -eq "claude-sonnet-4-5" }
    $gpt = $r.proposers | Where-Object { $_.name -eq "gpt-4o-mini" }
    $claude.complexity_threshold -eq 1.0 -and $gpt.complexity_threshold -eq 0.3
}

Test-Endpoint "Simple Task Routing" "gpt-4o-mini selected" {
    $r = Invoke-RestMethod -Uri "http://localhost:3000/api/proposer-enhanced" -Method POST -ContentType "application/json" -Body '{"task_description":"Create hello world","expected_output_type":"code","context":["test"]}'
    $r.data.proposer_used -eq "gpt-4o-mini" -and $r.data.complexity_analysis.score -lt 0.3
}

Test-Endpoint "Complexity Detection" "7 factors analyzed" {
    $r = Invoke-RestMethod -Uri "http://localhost:3000/api/proposer-enhanced" -Method POST -ContentType "application/json" -Body '{"task_description":"Test task","expected_output_type":"code","context":["test"]}'
    @($r.data.complexity_analysis.factors.PSObject.Properties).Count -eq 7
}

Write-Host "`n=== PHASE 2.2.5: Budget Management & Hard Stops ===" -ForegroundColor Cyan
Test-Endpoint "Config API - GET" "budget limits retrieved" {
    $r = Invoke-RestMethod -Uri http://localhost:3000/api/config
    $r.success -eq $true -and $r.data.daily_hard_cap -ne $null
}

Test-Endpoint "Budget Status Monitoring" "spend tracked" {
    $r = Invoke-RestMethod -Uri http://localhost:3000/api/budget-status
    $r.success -eq $true -and $r.daily.status -ne $null
}

Test-Endpoint "Hard Stop - Security" "forces claude-sonnet-4-5" {
    $r = Invoke-RestMethod -Uri "http://localhost:3000/api/proposer-enhanced" -Method POST -ContentType "application/json" -Body '{"task_description":"Fix SQL injection vulnerability","expected_output_type":"code","context":["security"]}'
    $r.data.proposer_used -eq "claude-sonnet-4-5" -and $r.data.complexity_analysis.hard_stop_required -eq $true
}

Test-Endpoint "Hard Stop - Architecture" "forces claude-sonnet-4-5" {
    $r = Invoke-RestMethod -Uri "http://localhost:3000/api/proposer-enhanced" -Method POST -ContentType "application/json" -Body '{"task_description":"Design API contract for authentication","expected_output_type":"planning","context":["architecture"]}'
    $r.data.proposer_used -eq "claude-sonnet-4-5" -and $r.data.complexity_analysis.hard_stop_required -eq $true
}

Write-Host "`n=== PHASE 2.2.6: Self-Refinement (3-Cycle) ===" -ForegroundColor Cyan
Test-Endpoint "Refinement Metadata Present" "refinement_metadata exists" {
    $r = Invoke-RestMethod -Uri "http://localhost:3000/api/proposer-enhanced" -Method POST -ContentType "application/json" -Body '{"task_description":"Create a TypeScript function","expected_output_type":"code","context":["test"]}' -TimeoutSec 180
    $null -ne $r.data.refinement_metadata
}

Test-Endpoint "Refinement Uses 1-3 Cycles" "cycle count valid" {
    $r = Invoke-RestMethod -Uri "http://localhost:3000/api/proposer-enhanced" -Method POST -ContentType "application/json" -Body '{"task_description":"Write a React component","expected_output_type":"code","context":["TypeScript"]}' -TimeoutSec 180
    $r.data.refinement_metadata.refinement_count -ge 1 -and $r.data.refinement_metadata.refinement_count -le 3
}

Test-Endpoint "Refinement Reduces Errors" "improves code quality" {
    $r = Invoke-RestMethod -Uri "http://localhost:3000/api/proposer-enhanced" -Method POST -ContentType "application/json" -Body '{"task_description":"Create a utility function","expected_output_type":"code","context":["test"]}' -TimeoutSec 180
    $rm = $r.data.refinement_metadata
    ($rm.initial_errors -eq 0) -or ($rm.final_errors -lt $rm.initial_errors)
}

Write-Host "`n=== PHASE 2.3: Orchestrator ===" -ForegroundColor Cyan
Test-Endpoint "Orchestrator Status API" "status endpoint available" {
    $r = Invoke-RestMethod -Uri http://localhost:3000/api/orchestrator
    $r.success -eq $true -and $null -ne $r.status
}

Test-Endpoint "Orchestrator Health Check" "orchestrator inactive on startup" {
    $r = Invoke-RestMethod -Uri http://localhost:3000/api/orchestrator
    $r.status.polling -eq $false -and $r.status.executing_count -eq 0
}

Write-Host "`n=== PHASE 3.1: Sentinel ===" -ForegroundColor Cyan
Test-Endpoint "Health Check Endpoint" "health endpoint returns ok" {
    $r = Invoke-RestMethod -Uri http://localhost:3000/api/health
    $r.status -eq "ok" -and $null -ne $r.timestamp
}

Test-Endpoint "Sentinel Webhook Auth" "rejects unauthenticated requests" {
    try {
        Invoke-RestMethod -Uri http://localhost:3000/api/sentinel -Method POST -ContentType "application/json" -Body '{"test":"data"}' -ErrorAction Stop
        $false
    } catch {
        $_.Exception.Response.StatusCode -eq 401
    }
}

Write-Host "`n=== CROSS-PHASE INTEGRATION ===" -ForegroundColor Cyan
Test-Endpoint "End-to-End Flow" "complete integration" {
    $r = Invoke-RestMethod -Uri "http://localhost:3000/api/proposer-enhanced" -Method POST -ContentType "application/json" -Body '{"task_description":"Integration test","expected_output_type":"code","context":["test"]}' -TimeoutSec 180
    $r.success -eq $true -and $r.data.proposer_used -ne $null -and $r.data.cost -ne $null
}

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "TEST SUMMARY" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "PASSED:   $passed" -ForegroundColor Green
Write-Host "FAILED:   $failed" -ForegroundColor Red
Write-Host "TOTAL:    $($passed + $failed)" -ForegroundColor Cyan

if ($failed -eq 0) {
    Write-Host "`nV ALL TESTS PASSED - System Ready for Phase 3" -ForegroundColor Green
} else {
    Write-Host "`nX SOME TESTS FAILED - Review errors above" -ForegroundColor Red
}

Read-Host "`nPress Enter to exit"
