<#
.SYNOPSIS
  PharmaCare Database Restore Script (Windows PowerShell)
.DESCRIPTION
  Safely restores a backup into an isolated test verification database (pharmacare_test_restore_db).
#>

param (
    [string]$BackupFile = "",
    [string]$TargetDatabase = "pharmacare_test_restore_db",
    [switch]$ForceProduction = $false
)

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = Resolve-Path "$ScriptDir\..\.."
$BackendDir = "$ProjectRoot\backend"

$ArgsList = @("scripts/restore-db.js", "--db", $TargetDatabase)
if ($BackupFile) {
    $ArgsList += $BackupFile
}
if ($ForceProduction) {
    $ArgsList += "--force-production"
}

Push-Location $BackendDir
try {
    Write-Host "[PharmaCare] Running database restore utility..." -ForegroundColor Cyan
    node @ArgsList
} finally {
    Pop-Location
}
