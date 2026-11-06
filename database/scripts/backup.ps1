<#
.SYNOPSIS
  PharmaCare Database Backup Script (Windows PowerShell)
.DESCRIPTION
  Creates a timestamped snapshot of the MySQL database in database/backups/
  Reads database settings from backend/.env without exposing passwords.
#>

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = Resolve-Path "$ScriptDir\..\.."
$BackendDir = "$ProjectRoot\backend"

Push-Location $BackendDir
try {
    Write-Host "[PharmaCare] Running database backup utility..." -ForegroundColor Cyan
    node scripts/backup-db.js
} finally {
    Pop-Location
}
