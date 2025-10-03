# Simple Orchestrator E2E Test
# This script manually inserts a Work Order into Supabase, then tests Orchestrator execution

Write-Host "=== Simple Orchestrator E2E Test ===" -ForegroundColor Cyan

# Instructions for manual setup:
Write-Host "`nMANUAL SETUP REQUIRED:" -ForegroundColor Yellow
Write-Host "1. Go to Supabase SQL Editor: https://supabase.com/dashboard/project/qclxdnbvoruvqnhsshjr/sql/new"
Write-Host "2. Run this SQL to create a test Work Order:" -ForegroundColor Yellow
Write-Host @"

INSERT INTO work_orders (
  title,
  description,
  status,
  risk_level,
  estimated_cost,
  pattern_confidence,
  acceptance_criteria,
  files_in_scope,
  context_budget_estimate,
  metadata
) VALUES (
  'Orchestrator E2E Test',
  'Create a simple test file named test-orchestrator-output.txt with the content: Hello from Orchestrator!',
  'pending',
  'low',
  0.10,
  0.95,
  ARRAY['File test-orchestrator-output.txt must exist', 'File must contain text: Hello from Orchestrator!'],
  ARRAY['test-orchestrator-output.txt'],
  500,
  '{"approved_by_director": true, "auto_approved": true}'::jsonb
) RETURNING id;

"@ -ForegroundColor Gray

Write-Host "`n3. Copy the returned Work Order ID and paste it here:"
$workOrderId = Read-Host "Work Order ID"

if ([string]::IsNullOrWhiteSpace($workOrderId)) {
    Write-Host "ERROR: No Work Order ID provided" -ForegroundColor Red
    exit 1
}

Write-Host "`n=== Testing Manual Execution ===" -ForegroundColor Cyan
Write-Host "Work Order ID: $workOrderId" -ForegroundColor Yellow

try {
    $executeResult = Invoke-RestMethod -Uri "http://localhost:3000/api/orchestrator/execute" `
        -Method POST `
        -ContentType "application/json" `
        -Body "{`"work_order_id`":`"$workOrderId`"}"

    Write-Host "`nSUCCESS!" -ForegroundColor Green
    Write-Host "  PR URL: $($executeResult.result.pr_url)" -ForegroundColor Cyan
    Write-Host "  PR Number: $($executeResult.result.pr_number)" -ForegroundColor Cyan
    Write-Host "  Branch: $($executeResult.result.branch_name)" -ForegroundColor Cyan
    Write-Host "  Execution Time: $($executeResult.result.execution_time_ms)ms" -ForegroundColor Cyan

} catch {
    Write-Host "`nERROR during execution:" -ForegroundColor Red
    Write-Host "  Message: $($_.Exception.Message)" -ForegroundColor Red
    if ($_.ErrorDetails.Message) {
        Write-Host "  Details: $($_.ErrorDetails.Message)" -ForegroundColor Red
    }
}

Write-Host "`n=== Test Complete ===" -ForegroundColor Cyan
