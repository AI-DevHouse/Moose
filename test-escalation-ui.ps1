# Test Escalation UI Flow
# Tests the Client Manager escalation queue UI

Write-Host "`n=== Escalation UI Test ===" -ForegroundColor Cyan
Write-Host "Testing Mission Control Escalation Queue functionality`n" -ForegroundColor Gray

$baseUrl = "http://localhost:3000"

# Test 1: Check if there are any existing work orders
Write-Host "Test 1: Fetching existing work orders..." -ForegroundColor Yellow
try {
    $workOrders = Invoke-RestMethod -Uri "$baseUrl/api/work-orders" -Method GET
    Write-Host "✓ Found $($workOrders.Count) work orders" -ForegroundColor Green

    if ($workOrders.Count -eq 0) {
        Write-Host "⚠️  No work orders found. Creating a test work order..." -ForegroundColor Yellow

        # Create a test work order
        $newWorkOrder = @{
            title = "Test Escalation Work Order"
            description = "This is a test work order to demonstrate the escalation UI"
            risk_level = "medium"
        } | ConvertTo-Json

        $createdWO = Invoke-RestMethod -Uri "$baseUrl/api/work-orders" `
            -Method POST `
            -ContentType "application/json" `
            -Body $newWorkOrder

        Write-Host "✓ Created test work order: $($createdWO.id)" -ForegroundColor Green
        $testWorkOrderId = $createdWO.id
    } else {
        # Use the first available work order
        $testWorkOrderId = $workOrders[0].id
        Write-Host "✓ Using existing work order: $testWorkOrderId" -ForegroundColor Green
    }
} catch {
    Write-Host "✗ Test 1 FAILED: $_" -ForegroundColor Red
    exit 1
}

# Test 2: Create an escalation for the work order
Write-Host "`nTest 2: Creating escalation for work order..." -ForegroundColor Yellow
try {
    $escalationRequest = @{
        work_order_id = $testWorkOrderId
    } | ConvertTo-Json

    $escalationResult = Invoke-RestMethod -Uri "$baseUrl/api/client-manager/escalate" `
        -Method POST `
        -ContentType "application/json" `
        -Body $escalationRequest

    if ($escalationResult.success) {
        Write-Host "✓ Escalation created successfully!" -ForegroundColor Green
        Write-Host "  Escalation ID: $($escalationResult.escalation.id)" -ForegroundColor Gray
        $escalationId = $escalationResult.escalation.id

        # Display recommendation summary
        if ($escalationResult.recommendation) {
            Write-Host "`n  📊 AI Recommendation:" -ForegroundColor Cyan
            Write-Host "  - Recommended Option: $($escalationResult.recommendation.recommended_option_id)" -ForegroundColor Gray
            Write-Host "  - Confidence: $([math]::Round($escalationResult.recommendation.confidence * 100, 0))%" -ForegroundColor Gray
            Write-Host "  - Reasoning: $($escalationResult.recommendation.reasoning)" -ForegroundColor Gray
        }
    } else {
        Write-Host "✗ Escalation creation failed" -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host "✗ Test 2 FAILED: $_" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    exit 1
}

# Test 3: Fetch escalation resolutions (what the UI will display)
Write-Host "`nTest 3: Fetching escalation resolution options..." -ForegroundColor Yellow
try {
    $resolutions = Invoke-RestMethod -Uri "$baseUrl/api/client-manager/resolutions/$escalationId" -Method GET

    if ($resolutions.success) {
        Write-Host "✓ Resolution options fetched successfully!" -ForegroundColor Green

        if ($resolutions.recommendation.trade_offs) {
            Write-Host "`n  📋 Available Resolution Options:" -ForegroundColor Cyan
            foreach ($option in $resolutions.recommendation.trade_offs) {
                $isRecommended = $option.option_id -eq $resolutions.recommendation.recommended_option_id
                $star = if ($isRecommended) { "⭐" } else { "  " }

                Write-Host "`n  $star Option $($option.option_id):" -ForegroundColor $(if ($isRecommended) { "Yellow" } else { "Gray" })
                Write-Host "    Pros:" -ForegroundColor Green
                foreach ($pro in $option.pros) {
                    Write-Host "      ✓ $pro" -ForegroundColor Green
                }
                Write-Host "    Cons:" -ForegroundColor Red
                foreach ($con in $option.cons) {
                    Write-Host "      ✗ $con" -ForegroundColor Red
                }
            }
        }
    } else {
        Write-Host "✗ Failed to fetch resolutions" -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host "✗ Test 3 FAILED: $_" -ForegroundColor Red
    exit 1
}

# Test 4: Verify escalation appears in dashboard API
Write-Host "`nTest 4: Verifying escalation appears in dashboard..." -ForegroundColor Yellow
try {
    $escalations = Invoke-RestMethod -Uri "$baseUrl/api/escalations" -Method GET
    $foundEscalation = $escalations | Where-Object { $_.id -eq $escalationId }

    if ($foundEscalation) {
        Write-Host "✓ Escalation found in dashboard API!" -ForegroundColor Green
        Write-Host "  Status: $($foundEscalation.status)" -ForegroundColor Gray
        Write-Host "  Work Order: $($foundEscalation.work_order_id)" -ForegroundColor Gray
    } else {
        Write-Host "✗ Escalation not found in dashboard" -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host "✗ Test 4 FAILED: $_" -ForegroundColor Red
    exit 1
}

# Summary
Write-Host "`n=== Test Summary ===" -ForegroundColor Cyan
Write-Host "✓ All escalation backend tests passed!" -ForegroundColor Green
Write-Host "`n📱 UI Test Instructions:" -ForegroundColor Yellow
Write-Host "1. Open browser to http://localhost:3000" -ForegroundColor Gray
Write-Host "2. Click on the 'Escalations' tab (should show a red badge with '1')" -ForegroundColor Gray
Write-Host "3. You should see the test escalation in the queue" -ForegroundColor Gray
Write-Host "4. Click 'View Resolution Options' to see AI recommendations" -ForegroundColor Gray
Write-Host "5. Review the pros/cons for each option" -ForegroundColor Gray
Write-Host "6. Click 'Execute This Option' to apply a decision" -ForegroundColor Gray
Write-Host "`nEscalation ID for manual testing: $escalationId" -ForegroundColor Cyan

Write-Host "`nBackend APIs ready for UI testing!`n" -ForegroundColor Green
