$ErrorActionPreference = "Stop"

$AppName = "kagi"
$Repo = "Microck/kagi-cli"
$BinDir = if ($env:KAGI_INSTALL_DIR) {
    $env:KAGI_INSTALL_DIR
} else {
    Join-Path $env:LOCALAPPDATA "Programs\kagi\bin"
}

function Get-LatestTag {
    $headers = @{ "User-Agent" = "kagi-install-script" }
    $release = Invoke-RestMethod -Headers $headers -Uri "https://api.github.com/repos/$Repo/releases/latest"
    return $release.tag_name
}

function Get-Target {
    $arch = [System.Runtime.InteropServices.RuntimeInformation]::OSArchitecture
    switch ($arch) {
        "X64" { return "x86_64-pc-windows-msvc" }
        "Arm64" { throw "Unsupported Windows architecture: $arch. Native release assets currently support x86_64 Windows only." }
        default {
            throw "Unsupported Windows architecture: $arch"
        }
    }
}

$Version = if ($env:KAGI_VERSION) { $env:KAGI_VERSION } else { Get-LatestTag }
if (-not $Version) {
    throw "Could not resolve the latest release tag. Set KAGI_VERSION and retry."
}

$Target = Get-Target
$Archive = "$AppName-$Version-$Target.zip"
$ChecksumFile = "$AppName-$Version-checksums.txt"
$ReleaseUrl = "https://github.com/$Repo/releases/download/$Version"
$TempDir = Join-Path ([System.IO.Path]::GetTempPath()) ("kagi-install-" + [System.Guid]::NewGuid().ToString("N"))
$InstallPath = Join-Path $BinDir "$AppName.exe"
$InstallTemp = Join-Path $BinDir ("$AppName." + [System.Guid]::NewGuid().ToString("N") + ".tmp")

New-Item -ItemType Directory -Path $TempDir | Out-Null
New-Item -ItemType Directory -Path $BinDir -Force | Out-Null

try {
    $ArchivePath = Join-Path $TempDir $Archive
    $ChecksumPath = Join-Path $TempDir $ChecksumFile
    Write-Host "Downloading $Archive"
    Invoke-WebRequest -Uri "$ReleaseUrl/$Archive" -OutFile $ArchivePath
    Invoke-WebRequest -Uri "$ReleaseUrl/$ChecksumFile" -OutFile $ChecksumPath

    $ChecksumPattern = "^([0-9a-fA-F]{64})  $([regex]::Escape($Archive))$"
    $ChecksumLine = Get-Content $ChecksumPath | Where-Object { $_ -match $ChecksumPattern } | Select-Object -First 1
    if (-not $ChecksumLine) {
        throw "Checksum not found for $Archive"
    }

    $ExpectedHash = ([regex]::Match($ChecksumLine, $ChecksumPattern)).Groups[1].Value
    $ActualHash = (Get-FileHash -Algorithm SHA256 $ArchivePath).Hash
    if ($ActualHash -ne $ExpectedHash) {
        throw "SHA-256 checksum mismatch for $Archive"
    }

    Expand-Archive -Path $ArchivePath -DestinationPath $TempDir -Force
    Copy-Item (Join-Path $TempDir "$AppName.exe") $InstallTemp
    [System.IO.File]::Move($InstallTemp, $InstallPath, $true)

    Write-Host "Installed $AppName to $InstallPath"
    Write-Host ""
    Write-Host "Add $BinDir to your PATH if it is not already there."
    Write-Host ""
    Write-Host "Run:"
    Write-Host "  $AppName --help"
}
finally {
    Remove-Item $TempDir -Recurse -Force -ErrorAction SilentlyContinue
    Remove-Item $InstallTemp -Force -ErrorAction SilentlyContinue
}
