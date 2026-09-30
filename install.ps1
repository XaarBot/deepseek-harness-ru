[CmdletBinding()]
param(
    [string]$InstallDirectory = (Join-Path $env:LOCALAPPDATA 'Programs\DeepSeek Harness'),
    [switch]$CheckOnly,
    [switch]$NoLaunch
)
. (Join-Path $PSScriptRoot 'scripts\common.ps1')
Invoke-NodeHelper 'check'
if ($CheckOnly) { return }
Assert-AppClosed
if (-not (Test-Path -LiteralPath (Join-Path $ProfileDirectory 'package.json'))) {
    throw 'Open DeepSeek Harness once to initialize the desktop profile, then quit and run this installer again.'
}
if (Test-Path -LiteralPath (Join-Path $LanguageDirectory 'package.json')) {
    $existing = Get-Content -LiteralPath (Join-Path $LanguageDirectory 'package.json') -Raw | ConvertFrom-Json
    if ($existing.name -ne 'dsh-locale-ru-local') { throw 'The destination belongs to another package.' }
}
$profileBackup = Join-Path $StateDirectory ('profile-before-install-' + (Get-Date -Format 'yyyyMMdd-HHmmss-ffff'))
New-Item -ItemType Directory -Path $profileBackup -Force | Out-Null
$profileFiles = @('package.json', 'cordis.patch.yml', 'pnpm-lock.yaml', 'pnpm-workspace.yaml')
foreach ($name in $profileFiles) {
    $source = Join-Path $ProfileDirectory $name
    if (Test-Path -LiteralPath $source) { Copy-Item -LiteralPath $source -Destination (Join-Path $profileBackup $name) }
}
New-Item -ItemType Directory -Path $LanguageDirectory -Force | Out-Null
Get-ChildItem -LiteralPath (Join-Path $PSScriptRoot 'plugin') | ForEach-Object {
    Copy-Item -LiteralPath $_.FullName -Destination $LanguageDirectory -Recurse -Force
}
try {
    & $DshCli plugin --profile desktop add $LanguageDirectory --offline --ignore-scripts
    if ($LASTEXITCODE -ne 0) { throw 'Could not register the local language bundle.' }
    Invoke-NodeHelper 'locale-ru'
    Invoke-NodeHelper 'apply'
} catch {
    foreach ($name in $profileFiles) {
        $source = Join-Path $profileBackup $name
        if (Test-Path -LiteralPath $source) { Copy-Item -LiteralPath $source -Destination (Join-Path $ProfileDirectory $name) -Force }
    }
    throw
}
Write-Output 'Russian localization installed. Language: Settings > General > Russian.'
Write-Output "Original shell and profile backups: $StateDirectory"
if (-not $NoLaunch) { Start-Process -FilePath $AppExe }
