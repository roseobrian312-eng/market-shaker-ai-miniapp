# Research recorded ticks offline; no OTCharts API requests.
$folder = Split-Path -Parent $MyInvocation.MyCommand.Path
Write-Host 'Analyzing saved ticks without using API credits...' -ForegroundColor Cyan
node (Join-Path $folder 'analyze.mjs') 30 85
Read-Host 'Press Enter to close'
