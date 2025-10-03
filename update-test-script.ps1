# Script to add port auto-detection to integration test

$content = Get-Content .\phase1-2-integration-test.ps1 -Raw

# Replace the header section
$oldHeader = @'
Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "PHASE 1-2 COMPREHENSIVE INTEGRATION TEST" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

$passed = 0
$failed = 0
$warnings = 0
'@

$newHeader = @'
Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "PHASE 1-2 COMPREHENSIVE INTEGRATION TEST" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

# Auto-detect server port (try 3000, fallback to 3001)
Write-Host "Detecting server port..." -ForegroundColor Cyan
$global:BASE_URL = "http://localhost:3000"
try {
    $null = Invoke-RestMethod -Uri "$global:BASE_URL/api/system-heartbeat" -TimeoutSec 2 -ErrorAction Stop
    Write-Host "✓ Server detected on port 3000`n" -ForegroundColor Green
} catch {
    $global:BASE_URL = "http://localhost:3001"
    try {
        $null = Invoke-RestMethod -Uri "$global:BASE_URL/api/system-heartbeat" -TimeoutSec 2 -ErrorAction Stop
        Write-Host "✓ Server detected on port 3001`n" -ForegroundColor Yellow
    } catch {
        Write-Host "✗ ERROR: Server not detected on ports 3000 or 3001" -ForegroundColor Red
        Write-Host "  Please ensure 'npm run dev' is running`n" -ForegroundColor Red
        Read-Host "Press Enter to exit"
        exit 1
    }
}

$passed = 0
$failed = 0
$warnings = 0
'@

$content = $content.Replace($oldHeader, $newHeader)

# Replace all http://localhost:3000 with $global:BASE_URL
$content = $content -replace 'http://localhost:3000', '$global:BASE_URL'

# Write back
Set-Content -Path .\phase1-2-integration-test.ps1 -Value $content -NoNewline

Write-Host "Port auto-detection added successfully" -ForegroundColor Green
