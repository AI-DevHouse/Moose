# Test Manager Service - Phase 4.1
# Tests the new Manager routing without affecting existing code

Write-Host "========================================"
Write-Host "MANAGER SERVICE TEST"
Write-Host "========================================"
Write-Host ""

$baseUrl = "http://localhost:3000"

# Test 1: Simple routing (low complexity)
Write-Host "=== Test 1: Simple Task Routing ===" -ForegroundColor Cyan
$simpleTask = @{
    work_order_id = "wo-test-001"
    task_description = "Create a simple hello world function"
    context_requirements = @("src/utils")
    complexity_score = 0.15
    approved_by_director = $true
} | ConvertTo-Json

try {
    $result1 = Invoke-RestMethod -Uri "$baseUrl/api/manager" -Method POST -ContentType "application/json" -Body $simpleTask
    Write-Host "  ✓ PASS: Simple task routed" -ForegroundColor Green
    Write-Host "  Selected: $($result1.routing_decision.selected_proposer)"
    Write-Host "  Reason: $($result1.routing_decision.reason)"
} catch {
    Write-Host "  X FAIL: $($_.Exception.Message)" -ForegroundColor Red
}
Write-Host ""

# Test 2: Hard Stop detection (security keyword)
Write-Host "=== Test 2: Hard Stop - Security ===" -ForegroundColor Cyan
$securityTask = @{
    work_order_id = "wo-test-002"
    task_description = "Fix SQL injection vulnerability in authentication"
    context_requirements = @("src/auth")
    complexity_score = 0.25
    approved_by_director = $true
} | ConvertTo-Json

try {
    $result2 = Invoke-RestMethod -Uri "$baseUrl/api/manager" -Method POST -ContentType "application/json" -Body $securityTask
    Write-Host "  ✓ PASS: Security task detected" -ForegroundColor Green
    Write-Host "  Selected: $($result2.routing_decision.selected_proposer)"
    Write-Host "  Hard Stop: $($result2.routing_decision.routing_metadata.hard_stop_required)"

    if ($result2.routing_decision.selected_proposer -eq "claude-sonnet-4-5") {
        Write-Host "  ✓ Correct model forced (claude-sonnet-4-5)" -ForegroundColor Green
    } else {
        Write-Host "  X Wrong model selected: $($result2.routing_decision.selected_proposer)" -ForegroundColor Red
    }
} catch {
    Write-Host "  X FAIL: $($_.Exception.Message)" -ForegroundColor Red
}
Write-Host ""

# Test 3: Hard Stop detection (architecture keyword)
Write-Host "=== Test 3: Hard Stop - Architecture ===" -ForegroundColor Cyan
$archTask = @{
    work_order_id = "wo-test-003"
    task_description = "Design API contract for breaking change"
    context_requirements = @("src/api")
    complexity_score = 0.3
    approved_by_director = $true
} | ConvertTo-Json

try {
    $result3 = Invoke-RestMethod -Uri "$baseUrl/api/manager" -Method POST -ContentType "application/json" -Body $archTask
    Write-Host "  ✓ PASS: Architecture task detected" -ForegroundColor Green
    Write-Host "  Selected: $($result3.routing_decision.selected_proposer)"
    Write-Host "  Hard Stop: $($result3.routing_decision.routing_metadata.hard_stop_required)"

    if ($result3.routing_decision.selected_proposer -eq "claude-sonnet-4-5") {
        Write-Host "  ✓ Correct model forced (claude-sonnet-4-5)" -ForegroundColor Green
    } else {
        Write-Host "  X Wrong model selected: $($result3.routing_decision.selected_proposer)" -ForegroundColor Red
    }
} catch {
    Write-Host "  X FAIL: $($_.Exception.Message)" -ForegroundColor Red
}
Write-Host ""

# Test 4: High complexity routing
Write-Host "=== Test 4: High Complexity Task ===" -ForegroundColor Cyan
$complexTask = @{
    work_order_id = "wo-test-004"
    task_description = "Refactor complex state management system"
    context_requirements = @("src/state", "src/actions", "src/reducers")
    complexity_score = 0.85
    approved_by_director = $true
} | ConvertTo-Json

try {
    $result4 = Invoke-RestMethod -Uri "$baseUrl/api/manager" -Method POST -ContentType "application/json" -Body $complexTask
    Write-Host "  ✓ PASS: Complex task routed" -ForegroundColor Green
    Write-Host "  Selected: $($result4.routing_decision.selected_proposer)"
    Write-Host "  Reason: $($result4.routing_decision.reason)"
} catch {
    Write-Host "  X FAIL: $($_.Exception.Message)" -ForegroundColor Red
}
Write-Host ""

# Test 5: Retry strategy
Write-Host "=== Test 5: Retry Strategy ===" -ForegroundColor Cyan
try {
    $retryUrl1 = "$baseUrl/api/manager/retry?work_order_id=wo-test-005`&current_proposer=gpt-4o-mini`&attempt=1`&failure_reason=timeout"
    $retry1 = Invoke-RestMethod -Uri $retryUrl1
    Write-Host "  ✓ PASS: Attempt 1 retry strategy" -ForegroundColor Green
    Write-Host "  Strategy: $($retry1.strategy)"
    Write-Host "  Should retry: $($retry1.should_retry)"
    Write-Host "  Next proposer: $($retry1.next_proposer)"
} catch {
    Write-Host "  X FAIL: $($_.Exception.Message)" -ForegroundColor Red
}
Write-Host ""

try {
    $retryUrl2 = "$baseUrl/api/manager/retry?work_order_id=wo-test-005`&current_proposer=gpt-4o-mini`&attempt=2`&failure_reason=compilation_error"
    $retry2 = Invoke-RestMethod -Uri $retryUrl2
    Write-Host "  ✓ PASS: Attempt 2 retry strategy" -ForegroundColor Green
    Write-Host "  Strategy: $($retry2.strategy)"
    Write-Host "  Should retry: $($retry2.should_retry)"
    Write-Host "  Next proposer: $($retry2.next_proposer)"
} catch {
    Write-Host "  X FAIL: $($_.Exception.Message)" -ForegroundColor Red
}
Write-Host ""

try {
    $retryUrl3 = "$baseUrl/api/manager/retry?work_order_id=wo-test-005`&current_proposer=claude-sonnet-4-5`&attempt=3`&failure_reason=still_failing"
    $retry3 = Invoke-RestMethod -Uri $retryUrl3
    Write-Host "  ✓ PASS: Attempt 3 retry strategy" -ForegroundColor Green
    Write-Host "  Strategy: $($retry3.strategy)"
    Write-Host "  Should retry: $($retry3.should_retry)"

    if ($retry3.strategy -eq "escalate") {
        Write-Host "  ✓ Correct: Escalation triggered" -ForegroundColor Green
    } else {
        Write-Host "  X Wrong: Should escalate at attempt 3" -ForegroundColor Red
    }
} catch {
    Write-Host "  X FAIL: $($_.Exception.Message)" -ForegroundColor Red
}
Write-Host ""

# Test 6: Missing Director approval
Write-Host "=== Test 6: Validation - Missing Approval ===" -ForegroundColor Cyan
$unapprovedTask = @{
    work_order_id = "wo-test-006"
    task_description = "Some task"
    context_requirements = @()
    complexity_score = 0.2
    approved_by_director = $false
} | ConvertTo-Json

try {
    $result6 = Invoke-RestMethod -Uri "$baseUrl/api/manager" -Method POST -ContentType "application/json" -Body $unapprovedTask
    Write-Host "  X FAIL: Should have rejected unapproved task" -ForegroundColor Red
} catch {
    if ($_.Exception.Response.StatusCode -eq 403) {
        Write-Host "  ✓ PASS: Correctly rejected unapproved task" -ForegroundColor Green
    } else {
        Write-Host "  X FAIL: Wrong error: $($_.Exception.Message)" -ForegroundColor Red
    }
}
Write-Host ""

Write-Host "========================================"
Write-Host "MANAGER SERVICE TEST COMPLETE"
Write-Host "========================================"
