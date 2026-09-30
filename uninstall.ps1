[CmdletBinding()]
param(
    [string]$InstallDirectory = (Join-Path $env:LOCALAPPDATA 'Programs\DeepSeek Harness'),
    [switch]$NoLaunch
)
. (Join-Path $PSScriptRoot 'scripts\common.ps1')
Assert-AppClosed
Invoke-NodeHelper 'check'
Invoke-NodeHelper 'restore'
Invoke-NodeHelper 'locale-en'
& $DshCli plugin --profile desktop remove dsh-locale-ru-local --offline --ignore-scripts
if ($LASTEXITCODE -ne 0) { throw 'Shell restored. Remove dsh-locale-ru-local from the Plugins page to finish.' }
Write-Output 'English restored. Chats, accounts and backups retained.'
if (-not $NoLaunch) { Start-Process -FilePath $AppExe }
