$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot

Start-Process -FilePath "cmd.exe" -ArgumentList "/k", "npm.cmd run dev:api" -WorkingDirectory $Root -WindowStyle Normal
Start-Sleep -Seconds 2
Start-Process -FilePath "cmd.exe" -ArgumentList "/k", "npm.cmd run dev:web" -WorkingDirectory $Root -WindowStyle Normal
Start-Sleep -Seconds 2
Start-Process -FilePath "cmd.exe" -ArgumentList "/k", "npm.cmd run dev:bot" -WorkingDirectory $Root -WindowStyle Normal

Write-Host "Bands API: http://localhost:4000"
Write-Host "Bands Web: http://localhost:5173"
Write-Host "Bot process started with BOT_TOKEN from .env"
