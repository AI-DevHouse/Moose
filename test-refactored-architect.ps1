# Test refactored Architect logic

Write-Host "Testing refactored Architect service..." -ForegroundColor Cyan
$response = Invoke-RestMethod -Uri 'http://localhost:3001/api/architect/decompose' -Method POST -ContentType 'application/json' -Body (Get-Content 'C:\dev\moose-mission-control\test-architect.json' -Raw)

Write-Host "`n✅ SUCCESS! Refactored Architect working." -ForegroundColor Green
Write-Host "Work Orders generated: $($response.data.work_orders.Length)"
Write-Host "Total cost: `$$($response.data.total_estimated_cost)"
Write-Host "`nFirst WO: $($response.data.work_orders[0].title)"
