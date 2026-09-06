# SOPHENIC local AI bootstrap helper.
# This script is packaged as an optional diagnostic/provisioning entry point.
# It never downloads software or changes system configuration silently.
[CmdletBinding()]
param(
    [switch]$CheckOnly = $true
)

$ErrorActionPreference = 'Stop'
$report = [ordered]@{
    platform = [System.Environment]::OSVersion.VersionString
    powershell = $PSVersionTable.PSVersion.ToString()
    node = $null
    docker = $null
    python = $null
}

foreach ($entry in @(
    @{ Name = 'node'; Key = 'node'; Args = @('--version') },
    @{ Name = 'docker'; Key = 'docker'; Args = @('--version') },
    @{ Name = 'python'; Key = 'python'; Args = @('--version') }
)) {
    $cmd = Get-Command $entry.Name -ErrorAction SilentlyContinue
    if ($cmd) {
        try { $report[$entry.Key] = (& $cmd.Source @($entry.Args) 2>&1 | Select-Object -First 1).ToString().Trim() }
        catch { $report[$entry.Key] = 'detected' }
    }
}

$report | ConvertTo-Json -Depth 3
exit 0
