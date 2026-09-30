$ErrorActionPreference = 'Stop'
$AppExe = Join-Path $InstallDirectory 'DeepSeek Harness.exe'
$DshCli = Join-Path $InstallDirectory 'resources\runtime\cli\bin\dsh.cmd'
$StateDirectory = Join-Path $env:LOCALAPPDATA 'DeepSeekHarness-Russian'
$LanguageDirectory = Join-Path $StateDirectory 'language-pack'
$DshRoot = if ($env:DSH_HOME) { $env:DSH_HOME } else { Join-Path $env:USERPROFILE '.dsh' }
$ProfileDirectory = Join-Path $DshRoot 'profiles\desktop'
if (-not (Test-Path -LiteralPath $AppExe)) { throw "DeepSeek Harness not found: $InstallDirectory" }
function Assert-AppClosed {
    $running = Get-CimInstance Win32_Process | Where-Object { $_.ExecutablePath -eq $AppExe }
    if ($running) { throw 'Quit DeepSeek Harness from its Application menu first. Closing its window may only hide it.' }
}
function Invoke-NodeHelper {
    param([string]$Mode)
    $previous = $env:ELECTRON_RUN_AS_NODE
    $stdout = New-TemporaryFile
    $stderr = New-TemporaryFile
    try {
        $env:ELECTRON_RUN_AS_NODE = '1'
        # Wait explicitly: Windows can otherwise return early for a GUI-subsystem EXE.
        $values = @('--expose-internals', (Join-Path $PSScriptRoot 'patch-shell.mjs'), $Mode, $InstallDirectory, $StateDirectory, $ProfileDirectory)
        $quoted = $values | ForEach-Object {
            if ($_ -match '"') { throw 'Double quotes are not valid in these filesystem paths.' }
            '"' + [regex]::Replace($_, '(\\+)$', '$1$1') + '"'
        }
        $process = Start-Process -FilePath $AppExe -ArgumentList $quoted -WindowStyle Hidden -Wait -PassThru -RedirectStandardOutput $stdout.FullName -RedirectStandardError $stderr.FullName
        Get-Content -LiteralPath $stdout.FullName | Write-Output
        if ($process.ExitCode -ne 0) {
            $detail = Get-Content -LiteralPath $stderr.FullName -Raw
            throw "Localization operation failed ($Mode): $detail"
        }
    } finally {
        $env:ELECTRON_RUN_AS_NODE = $previous
        Remove-Item -LiteralPath $stdout.FullName, $stderr.FullName -ErrorAction SilentlyContinue
    }
}
