# Test Director Approval E2E Flow

Write-Host "Step 1: Decomposing spec..." -ForegroundColor Cyan
$decompResponse = Invoke-RestMethod -Uri 'http://localhost:3001/api/architect/decompose' -Method POST -ContentType 'application/json' -Body (Get-Content 'C:\dev\moose-mission-control\test-architect.json' -Raw)

Write-Host "Decomposition result: $($decompResponse.data.work_orders.Length) work orders created" -ForegroundColor Green

Write-Host "`nStep 2: Submitting to Director for approval..." -ForegroundColor Cyan
$approvalRequest = @{
    decomposition = $decompResponse.data
    feature_name = "User Authentication System"
} | ConvertTo-Json -Depth 10

$approvalResponse = Invoke-RestMethod -Uri 'http://localhost:3001/api/director/approve' -Method POST -ContentType 'application/json' -Body $approvalRequest

Write-Host "`nApproval Decision:" -ForegroundColor Yellow
Write-Host "  Auto-approved: $($approvalResponse.decision.auto_approved)"
Write-Host "  Requires human approval: $($approvalResponse.decision.requires_human_approval)"
Write-Host "  Aggregate risk: $($approvalResponse.decision.aggregate_risk)"
Write-Host "  Total cost: `$$($approvalResponse.decision.total_cost)"
Write-Host "  Reasoning: $($approvalResponse.decision.reasoning)"

if ($approvalResponse.work_order_ids) {
    Write-Host "`n✅ Work Orders Created:" -ForegroundColor Green
    $approvalResponse.work_order_ids | ForEach-Object { Write-Host "  - $_" }
} else {
    Write-Host "`n⚠️  No work orders created - human approval required" -ForegroundColor Yellow
}
