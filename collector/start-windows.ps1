# Run from extracted folder: Right-click -> Run with PowerShell (or terminal: powershell -ExecutionPolicy Bypass -File .\collector\start-windows.ps1)
# Requires Node.js 22+, and OTCharts Lite or higher with /v1/stream enabled.
$ErrorActionPreference = 'Stop'
Write-Host 'Market Shaker AI - attended live tick recorder' -ForegroundColor Cyan
Write-Host 'Your OTCharts API key is not written to source code or saved on disk.'
$secure = Read-Host 'Paste your OTCharts key (input hidden)' -AsSecureString
$ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
try { $env:OTCHARTS_API_KEY = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr) }
finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr) }
$folder = Split-Path -Parent $MyInvocation.MyCommand.Path
try {
  Write-Host 'Keep this window open while collecting live ticks. Open http://127.0.0.1:4147 in your browser.'
  node (Join-Path $folder 'record.mjs')
} finally { Remove-Item Env:OTCHARTS_API_KEY -ErrorAction SilentlyContinue }
