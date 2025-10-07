# Phase 2 Test Script
# Tests the enhanced Architect with Multi-LLM Discussion App

Write-Host "================================================" -ForegroundColor Cyan
Write-Host "Phase 2 Test: Multi-LLM Discussion App" -ForegroundColor Cyan
Write-Host "================================================" -ForegroundColor Cyan
Write-Host ""

$startTime = Get-Date

# Check if dev server is running
Write-Host "Checking if dev server is running on localhost:3000..." -ForegroundColor Yellow
try {
    $healthCheck = Invoke-WebRequest -Uri "http://localhost:3000/api/health" -TimeoutSec 5 -UseBasicParsing
    Write-Host "[OK] Dev server is running" -ForegroundColor Green
    $serverUrl = "http://localhost:3000"
} catch {
    Write-Host "[INFO] Dev server not running locally, using deployed version" -ForegroundColor Yellow
    $serverUrl = "https://moose-indol.vercel.app"
}

Write-Host ""

# Load payload
$payloadPath = "scripts\phase2-test-payload.json"
Write-Host "Loading test payload from: $payloadPath" -ForegroundColor Yellow
$payload = Get-Content $payloadPath -Raw

# Make API call
Write-Host "Calling Architect API at: $serverUrl/api/architect/decompose" -ForegroundColor Yellow
Write-Host "Options: generateWireframes=true, generateContracts=true" -ForegroundColor Yellow
Write-Host ""

try {
    $headers = @{
        "Content-Type" = "application/json"
    }

    $response = Invoke-RestMethod `
        -Uri "$serverUrl/api/architect/decompose" `
        -Method POST `
        -Headers $headers `
        -Body $payload `
        -TimeoutSec 120

    $endTime = Get-Date
    $duration = ($endTime - $startTime).TotalSeconds

    Write-Host "================================================" -ForegroundColor Cyan
    Write-Host "DECOMPOSITION COMPLETE" -ForegroundColor Green
    Write-Host "================================================" -ForegroundColor Cyan
    Write-Host ""

    # Check if success
    if ($response.success) {
        $data = $response.data

        # Calculate costs
        $decompCost = $data.total_estimated_cost
        $wireframeCost = if ($data.wireframe_cost) { $data.wireframe_cost } else { 0 }
        $contractCost = if ($data.contract_cost) { $data.contract_cost } else { 0 }
        $totalCost = $decompCost + $wireframeCost + $contractCost

        # Summary
        Write-Host "RESULTS SUMMARY:" -ForegroundColor Cyan
        Write-Host "  Work Orders: $($data.work_orders.Count)" -ForegroundColor White
        Write-Host "  Decomposition Cost: `$$([math]::Round($decompCost, 4))" -ForegroundColor White
        Write-Host "  Wireframe Cost: `$$([math]::Round($wireframeCost, 4))" -ForegroundColor White
        Write-Host "  Contract Cost: `$$([math]::Round($contractCost, 4))" -ForegroundColor White
        Write-Host "  Total Cost: `$$([math]::Round($totalCost, 4))" -ForegroundColor White
        Write-Host "  Duration: $([math]::Round($duration, 2))s" -ForegroundColor White
        Write-Host ""

        # Work orders
        Write-Host "WORK ORDERS:" -ForegroundColor Cyan
        for ($i = 0; $i -lt $data.work_orders.Count; $i++) {
            $wo = $data.work_orders[$i]
            Write-Host "  $($i + 1). $($wo.title)" -ForegroundColor White
            Write-Host "     Risk: $($wo.risk_level), Dependencies: [$($wo.dependencies -join ', ')]" -ForegroundColor Gray
            if ($wo.wireframe) {
                Write-Host "     Wireframe: $($wo.wireframe.component_name)" -ForegroundColor Magenta
            }
        }
        Write-Host ""

        # Contracts
        if ($data.contracts) {
            Write-Host "CONTRACTS GENERATED:" -ForegroundColor Cyan
            $apiCount = if ($data.contracts.api_contracts) { $data.contracts.api_contracts.Count } else { 0 }
            $ipcCount = if ($data.contracts.ipc_contracts) { $data.contracts.ipc_contracts.Count } else { 0 }
            $stateCount = if ($data.contracts.state_contracts) { $data.contracts.state_contracts.Count } else { 0 }
            $fileCount = if ($data.contracts.file_contracts) { $data.contracts.file_contracts.Count } else { 0 }
            $dbCount = if ($data.contracts.database_contracts) { $data.contracts.database_contracts.Count } else { 0 }

            Write-Host "  API Contracts: $apiCount" -ForegroundColor White
            Write-Host "  IPC Contracts: $ipcCount" -ForegroundColor White
            Write-Host "  State Contracts: $stateCount" -ForegroundColor White
            Write-Host "  File Contracts: $fileCount" -ForegroundColor White
            Write-Host "  Database Contracts: $dbCount" -ForegroundColor White
            Write-Host ""
        }

        # Success criteria
        $woCount = $data.work_orders.Count
        $durationMin = $duration / 60

        Write-Host "SUCCESS CRITERIA:" -ForegroundColor Cyan
        Write-Host "  [PASS] Spec loaded successfully" -ForegroundColor Green

        if ($woCount -ge 8 -and $woCount -le 20) {
            Write-Host "  [PASS] Work order count in range ($woCount of 20 max)" -ForegroundColor Green
        } else {
            Write-Host "  [FAIL] Work order count in range ($woCount of 20 max)" -ForegroundColor Red
        }

        if ($totalCost -lt 1.00) {
            Write-Host "  [PASS] Total cost < `$1.00 (`$$([math]::Round($totalCost, 4)))" -ForegroundColor Green
        } else {
            Write-Host "  [FAIL] Total cost < `$1.00 (`$$([math]::Round($totalCost, 4)))" -ForegroundColor Red
        }

        if ($durationMin -lt 2) {
            Write-Host "  [PASS] Duration < 2 minutes ($([math]::Round($durationMin, 2))min)" -ForegroundColor Green
        } else {
            Write-Host "  [FAIL] Duration < 2 minutes ($([math]::Round($durationMin, 2))min)" -ForegroundColor Red
        }

        if ($data.contracts) {
            Write-Host "  [PASS] Contracts generated" -ForegroundColor Green
        } else {
            Write-Host "  [FAIL] Contracts generated" -ForegroundColor Red
        }
        Write-Host ""

        # Save result
        $resultPath = "docs\phase2-test-result.json"
        $response | ConvertTo-Json -Depth 100 | Out-File $resultPath -Encoding UTF8
        Write-Host "Full result saved to: $resultPath" -ForegroundColor Green
        Write-Host ""

        # Overall status
        if ($woCount -ge 8 -and $woCount -le 20 -and $totalCost -lt 1.00 -and $durationMin -lt 2 -and $data.contracts) {
            Write-Host "[SUCCESS] PHASE 2 TEST: PASS" -ForegroundColor Green
            exit 0
        } else {
            Write-Host "[PARTIAL] PHASE 2 TEST: Some criteria failed (see above)" -ForegroundColor Yellow
            exit 1
        }

    } else {
        Write-Host "ERROR: $($response.error)" -ForegroundColor Red
        exit 1
    }

} catch {
    Write-Host "ERROR during API call:" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    exit 1
}
