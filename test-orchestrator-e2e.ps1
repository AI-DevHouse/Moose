# Orchestrator E2E Test Script

Write-Host "=== Orchestrator E2E Test ===" -ForegroundColor Cyan

# 1. Test Status Endpoint
Write-Host "`n1. Testing Orchestrator Status..." -ForegroundColor Yellow
$status = Invoke-RestMethod http://localhost:3000/api/orchestrator
Write-Host "  Status: $($status.status.polling)" -ForegroundColor Green
Write-Host "  Executing: $($status.status.executing_count)" -ForegroundColor Green

# 2. Create Test Work Order via Architect
Write-Host "`n2. Creating Test Work Order via Architect..." -ForegroundColor Yellow
$spec = @{
    feature_name = "Orchestrator E2E Test"
    objectives = @("Create a simple test file: test-orchestrator-output.txt")
    constraints = @("Must be minimal", "Single file only")
    acceptance_criteria = @("File test-orchestrator-output.txt exists with content 'Hello from Orchestrator'")
} | ConvertTo-Json

$architectResult = Invoke-RestMethod -Uri "http://localhost:3000/api/architect/decompose" `
    -Method POST `
    -ContentType "application/json" `
    -Body $spec

Write-Host "  Response: $($architectResult | ConvertTo-Json -Depth 3)" -ForegroundColor Gray

if ($architectResult.success) {
    Write-Host "  Created Work Orders Successfully" -ForegroundColor Green
    $decompositionId = $architectResult.data.decomposition_id
    Write-Host "  Decomposition ID: $decompositionId" -ForegroundColor Green

    # Get Work Order IDs from database by querying for this decomposition
    # For now, we'll skip to manual Work Order creation
    Write-Host "  Note: Need to query database for Work Order IDs" -ForegroundColor Yellow
} else {
    Write-Host "  ERROR: $($architectResult.error)" -ForegroundColor Red
    exit 1
}

# 3. Approve Work Order via Director
Write-Host "`n3. Approving Work Order via Director..." -ForegroundColor Yellow
$approvalResult = Invoke-RestMethod -Uri "http://localhost:3000/api/director/approve" `
    -Method POST `
    -ContentType "application/json" `
    -Body "{`"decomposition_id`":`"$($architectResult.data.decomposition_id)`"}"

Write-Host "  Approval: $($approvalResult.data.decision)" -ForegroundColor Green

# 4. Manual Execution Test
Write-Host "`n4. Testing Manual Execution..." -ForegroundColor Yellow
Write-Host "  Work Order ID: $workOrderId" -ForegroundColor Cyan

try {
    $executeResult = Invoke-RestMethod -Uri "http://localhost:3000/api/orchestrator/execute" `
        -Method POST `
        -ContentType "application/json" `
        -Body "{`"work_order_id`":`"$workOrderId`"}"

    Write-Host "  Success: $($executeResult.success)" -ForegroundColor Green
    Write-Host "  PR URL: $($executeResult.result.pr_url)" -ForegroundColor Green
    Write-Host "  Branch: $($executeResult.result.branch_name)" -ForegroundColor Green
} catch {
    Write-Host "  ERROR: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "  Details: $($_.ErrorDetails.Message)" -ForegroundColor Red
}

Write-Host "`n=== E2E Test Complete ===" -ForegroundColor Cyan
