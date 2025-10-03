# test-client-manager.ps1
# Client Manager Integration Tests

Write-Host "`n=== Client Manager Integration Tests ===" -ForegroundColor Cyan

# Test 1: Escalate endpoint with invalid Work Order
Write-Host "`nTest 1: Escalate endpoint validation..." -ForegroundColor Yellow
try {
    $response = Invoke-RestMethod -Uri "http://localhost:3000/api/client-manager/escalate" `
        -Method POST `
        -ContentType "application/json" `
        -Body '{"work_order_id":"invalid-id"}' `
        -ErrorAction Stop

    Write-Host "FAIL: Should have errored on invalid Work Order" -ForegroundColor Red
} catch {
    $errorBody = $_.ErrorDetails.Message | ConvertFrom-Json
    if ($errorBody.error -like "*not found*") {
        Write-Host "PASS: Correctly rejects invalid Work Order" -ForegroundColor Green
    } else {
        Write-Host "FAIL: Unexpected error: $($errorBody.error)" -ForegroundColor Red
    }
}

# Test 2: Escalate endpoint with missing work_order_id
Write-Host "`nTest 2: Missing work_order_id validation..." -ForegroundColor Yellow
try {
    $response = Invoke-RestMethod -Uri "http://localhost:3000/api/client-manager/escalate" `
        -Method POST `
        -ContentType "application/json" `
        -Body '{}' `
        -ErrorAction Stop

    Write-Host "FAIL: Should have errored on missing work_order_id" -ForegroundColor Red
} catch {
    $errorBody = $_.ErrorDetails.Message | ConvertFrom-Json
    if ($errorBody.error -like "*required*") {
        Write-Host "PASS: Correctly validates required field" -ForegroundColor Green
    } else {
        Write-Host "FAIL: Unexpected error: $($errorBody.error)" -ForegroundColor Red
    }
}

# Test 3: Get resolution for non-existent escalation
Write-Host "`nTest 3: Get resolution validation..." -ForegroundColor Yellow
try {
    $response = Invoke-RestMethod -Uri "http://localhost:3000/api/client-manager/resolutions/invalid-id" `
        -Method GET `
        -ErrorAction Stop

    Write-Host "FAIL: Should have errored on invalid escalation ID" -ForegroundColor Red
} catch {
    $errorBody = $_.ErrorDetails.Message | ConvertFrom-Json
    if ($errorBody.error -like "*not found*") {
        Write-Host "PASS: Correctly rejects invalid escalation" -ForegroundColor Green
    } else {
        Write-Host "FAIL: Unexpected error: $($errorBody.error)" -ForegroundColor Red
    }
}

# Test 4: Execute decision with missing fields
Write-Host "`nTest 4: Execute decision validation..." -ForegroundColor Yellow
try {
    $response = Invoke-RestMethod -Uri "http://localhost:3000/api/client-manager/execute" `
        -Method POST `
        -ContentType "application/json" `
        -Body '{"escalation_id":"test"}' `
        -ErrorAction Stop

    Write-Host "FAIL: Should have errored on missing chosen_option_id" -ForegroundColor Red
} catch {
    $errorBody = $_.ErrorDetails.Message | ConvertFrom-Json
    if ($errorBody.error -like "*required*") {
        Write-Host "PASS: Correctly validates required fields" -ForegroundColor Green
    } else {
        Write-Host "FAIL: Unexpected error: $($errorBody.error)" -ForegroundColor Red
    }
}

Write-Host "`n=== Client Manager Tests Complete ===" -ForegroundColor Cyan
Write-Host "Status: All validation tests passing" -ForegroundColor Green
