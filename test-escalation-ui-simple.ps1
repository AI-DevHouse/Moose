# Simple Test - Create Escalation and View in UI
Write-Host "Creating test escalation..." -ForegroundColor Cyan

# Step 1: Get or create a work order
$workOrders = Invoke-RestMethod -Uri "http://localhost:3000/api/work-orders" -Method GET
if ($workOrders.Count -eq 0) {
    $newWO = @{
        title = "Test Escalation WO"
        description = "For escalation UI testing"
        risk_level = "medium"
    } | ConvertTo-Json
    $wo = Invoke-RestMethod -Uri "http://localhost:3000/api/work-orders" -Method POST -ContentType "application/json" -Body $newWO
    $woId = $wo.id
} else {
    $woId = $workOrders[0].id
}

Write-Host "Using work order: $woId" -ForegroundColor Green

# Step 2: Create escalation
$escRequest = @{ work_order_id = $woId } | ConvertTo-Json
$result = Invoke-RestMethod -Uri "http://localhost:3000/api/client-manager/escalate" -Method POST -ContentType "application/json" -Body $escRequest

Write-Host "Escalation created: $($result.escalation.id)" -ForegroundColor Green
Write-Host "Recommended option: $($result.recommendation.recommended_option_id)" -ForegroundColor Yellow

Write-Host "`nNow open http://localhost:3000 and click the Escalations tab!" -ForegroundColor Cyan
