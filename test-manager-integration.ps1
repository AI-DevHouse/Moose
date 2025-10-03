# Test Manager Integration with Proposer Service
# Tests: Manager API → Proposer Service flow

Write-Host "`n=== Manager Integration Test ===" -ForegroundColor Cyan
Write-Host "Testing: Director -> Manager -> Proposer flow`n" -ForegroundColor Cyan

$testsPassed = 0
$testsFailed = 0

# Test 1: Direct Manager API call (low complexity)
Write-Host "Test 1: Manager API - Low complexity task..." -ForegroundColor Yellow
try {
    $managerRequest = @{
        work_order_id = "test-wo-001"
        task_description = "Add a simple validation function to check if email is valid"
        context_requirements = @("src/lib/validators.ts")
        complexity_score = 0.2
        approved_by_director = $true
    } | ConvertTo-Json

    $managerResponse = Invoke-RestMethod -Uri "http://localhost:3000/api/manager" `
        -Method POST `
        -ContentType "application/json" `
        -Body $managerRequest `
        -ErrorAction Stop

    if ($managerResponse.success -and $managerResponse.routing_decision) {
        Write-Host "  [PASS] Manager routing successful" -ForegroundColor Green
        Write-Host "    Selected: $($managerResponse.routing_decision.selected_proposer)" -ForegroundColor Gray
        Write-Host "    Reason: $($managerResponse.routing_decision.reason)" -ForegroundColor Gray
        $testsPassed++
    } else {
        Write-Host "  [FAIL] Manager routing failed" -ForegroundColor Red
        $testsFailed++
    }
} catch {
    Write-Host "  [FAIL] Manager API error: $($_.Exception.Message)" -ForegroundColor Red
    $testsFailed++
}

# Test 2: Direct Manager API call (high complexity)
Write-Host "`nTest 2: Manager API - High complexity task..." -ForegroundColor Yellow
try {
    $managerRequest = @{
        work_order_id = "test-wo-002"
        task_description = "Implement OAuth 2.0 authentication flow with JWT token refresh and role-based access control"
        context_requirements = @("src/lib/auth.ts", "src/types/auth.ts")
        complexity_score = 0.9
        approved_by_director = $true
    } | ConvertTo-Json

    $managerResponse = Invoke-RestMethod -Uri "http://localhost:3000/api/manager" `
        -Method POST `
        -ContentType "application/json" `
        -Body $managerRequest `
        -ErrorAction Stop

    if ($managerResponse.success -and $managerResponse.routing_decision) {
        Write-Host "  [PASS] Manager routing successful" -ForegroundColor Green
        Write-Host "    Selected: $($managerResponse.routing_decision.selected_proposer)" -ForegroundColor Gray
        Write-Host "    Reason: $($managerResponse.routing_decision.reason)" -ForegroundColor Gray
        $testsPassed++
    } else {
        Write-Host "  [FAIL] Manager routing failed" -ForegroundColor Red
        $testsFailed++
    }
} catch {
    Write-Host "  [FAIL] Manager API error: $($_.Exception.Message)" -ForegroundColor Red
    $testsFailed++
}

# Test 3: Manager API call with Hard Stop keyword
Write-Host "`nTest 3: Manager API - Hard Stop detection (security)..." -ForegroundColor Yellow
try {
    $managerRequest = @{
        work_order_id = "test-wo-003"
        task_description = "Fix SQL injection vulnerability in user authentication endpoint"
        context_requirements = @("src/app/api/auth/login.ts")
        complexity_score = 0.6
        approved_by_director = $true
    } | ConvertTo-Json

    $managerResponse = Invoke-RestMethod -Uri "http://localhost:3000/api/manager" `
        -Method POST `
        -ContentType "application/json" `
        -Body $managerRequest `
        -ErrorAction Stop

    if ($managerResponse.success -and $managerResponse.routing_decision) {
        $isHardStop = $managerResponse.routing_decision.routing_metadata.hard_stop_required
        $selectedProposer = $managerResponse.routing_decision.selected_proposer

        if ($isHardStop -and $selectedProposer -eq "claude-sonnet-4-5") {
            Write-Host "  [PASS] Hard Stop detected, forced claude-sonnet-4-5" -ForegroundColor Green
            Write-Host "    Reason: $($managerResponse.routing_decision.reason)" -ForegroundColor Gray
            $testsPassed++
        } else {
            Write-Host "  [FAIL] Hard Stop not enforced (selected: $selectedProposer)" -ForegroundColor Red
            $testsFailed++
        }
    } else {
        Write-Host "  [FAIL] Manager routing failed" -ForegroundColor Red
        $testsFailed++
    }
} catch {
    Write-Host "  [FAIL] Manager API error: $($_.Exception.Message)" -ForegroundColor Red
    $testsFailed++
}

# Test 4: Proposer Service with Manager integration (via API)
Write-Host "`nTest 4: Proposer Service to Manager integration..." -ForegroundColor Yellow
try {
    $proposerRequest = @{
        task_description = "Create a utility function to format dates"
        context = @("src/lib/utils.ts")
        expected_output_type = "code"
        priority = "low"
    } | ConvertTo-Json

    $proposerResponse = Invoke-RestMethod -Uri "http://localhost:3000/api/proposer-enhanced" `
        -Method POST `
        -ContentType "application/json" `
        -Body $proposerRequest `
        -ErrorAction Stop

    if ($proposerResponse.success -and $proposerResponse.routing_decision) {
        Write-Host "  [PASS] Proposer service successfully called Manager" -ForegroundColor Green
        Write-Host "    Proposer used: $($proposerResponse.proposer_used)" -ForegroundColor Gray
        Write-Host "    Routing reason: $($proposerResponse.routing_decision.reason)" -ForegroundColor Gray
        $testsPassed++
    } else {
        Write-Host "  [FAIL] Proposer service failed" -ForegroundColor Red
        $testsFailed++
    }
} catch {
    Write-Host "  [FAIL] Proposer API error: $($_.Exception.Message)" -ForegroundColor Red
    $testsFailed++
}

# Summary
Write-Host "`n=== Test Summary ===" -ForegroundColor Cyan
Write-Host "Passed: $testsPassed" -ForegroundColor Green
Write-Host "Failed: $testsFailed" -ForegroundColor $(if ($testsFailed -eq 0) { "Green" } else { "Red" })

if ($testsFailed -eq 0) {
    Write-Host "`nManager integration complete!" -ForegroundColor Green
    exit 0
} else {
    Write-Host "`nSome tests failed" -ForegroundColor Red
    exit 1
}
