#!/usr/bin/env pwsh
# Install TACO (Token Accumulator Counter) for OpenCode
# https://github.com/bulga138/token-accumulator-counter-opencode
#
# Usage:
#   .\install.ps1                    # Install to ~/.taco
#   .\install.ps1 -System           # System-wide install (requires admin)
#   .\install.ps1 -Help             # Show help

param(
    [switch]$System,
    [switch]$Help
)

if ($Help) {
    Write-Host @"
Usage: .\install.ps1 [OPTIONS]

Install TACO CLI for OpenCode telemetry tracking.

Options:
  -System    Install system-wide (requires admin, goes to C:\Program Files\taco)
  -Help      Show this help message

Examples:
  .\install.ps1              # User install to ~/.taco (recommended)
  .\install.ps1 -System     # System-wide install
"@
    exit 0
}

# Colors
$Bold = "`e[1m"
$Green = "`e[0;32m"
$Yellow = "`e[0;33m"
$Cyan = "`e[0;36m"
$Red = "`e[0;31m"
$Reset = "`e[0m"

function Info { param($msg) Write-Host "${Cyan}  ->${Reset} $msg" }
function Success { param($msg) Write-Host "${Green}  [OK]${Reset} $msg" }
function Warn { param($msg) Write-Host "${Yellow}  [WARN]${Reset} $msg" }
function Error { param($msg) Write-Host "${Red}  [ERROR]${Reset} $msg" -ForegroundColor Red; exit 1 }

Write-Host ""
Write-Host "${Bold}🌮 Installing TACO${Reset}"
Write-Host ""

# Get script directory
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path

# Check Node.js
Info "Checking Node.js version..."
$NodeCmd = Get-Command node -ErrorAction SilentlyContinue
if (-not $NodeCmd) {
    # Try common Windows locations
    $PossiblePaths = @(
        "C:\Program Files\nodejs\node.exe",
        "C:\Program Files (x86)\nodejs\node.exe",
        "$env:LOCALAPPDATA\nodejs\node.exe",
        "$env:APPDATA\npm\node.exe"
    )
    
    foreach ($Path in $PossiblePaths) {
        if (Test-Path $Path) {
            $env:PATH = "$([System.IO.Path]::GetDirectoryName($Path));$env:PATH"
            $NodeCmd = Get-Command node -ErrorAction SilentlyContinue
            if ($NodeCmd) { break }
        }
    }
}

if (-not $NodeCmd) {
    Error "Node.js is required but not installed. Please install Node.js 18+ from https://nodejs.org"
}

$NodeVersion = & node --version
$NodeVersion = $NodeVersion -replace '^v', ''
$NodeMajor = [int]($NodeVersion -split '\.')[0]

if ($NodeMajor -lt 18) {
    Error "Node.js 18+ is required. Found: $NodeVersion"
}

Success "Node.js $NodeVersion detected"

# Determine install directory
if ($System) {
    $InstallDir = "C:\Program Files\taco"
} else {
    $InstallDir = "$env:USERPROFILE\.taco"
}

Info "Installation directory: $InstallDir"

# Check for pre-built dist
if (-not (Test-Path "$ScriptDir\dist")) {
    Warn "No pre-built dist/ folder found"
    Info "Building from source..."
    
    # Check for pnpm or npm
    $PnpmCmd = Get-Command pnpm -ErrorAction SilentlyContinue
    $NpmCmd = Get-Command npm -ErrorAction SilentlyContinue
    
    if ($PnpmCmd) {
        $BuildCmd = "pnpm run build"
    } elseif ($NpmCmd) {
        $BuildCmd = "npm run build"
    } else {
        Error "Neither pnpm nor npm found. Please install pnpm: https://pnpm.io/installation"
    }
    
    Push-Location $ScriptDir
    try {
        Invoke-Expression $BuildCmd
        if ($LASTEXITCODE -ne 0) { Error "Build failed" }
    } finally {
        Pop-Location
    }
    Success "Built successfully"
}

# Install
Write-Host ""
Write-Host "${Bold}[1/2] Installing taco...${Reset}"

# Create install directory
New-Item -ItemType Directory -Force -Path $InstallDir | Out-Null

# Check for Bun
$BunCmd = Get-Command bun -ErrorAction SilentlyContinue
$NodeCmd = Get-Command node -ErrorAction SilentlyContinue

if ($BunCmd) {
    Info "Bun detected - using Bun for faster performance"
    $Runtime = "bun"
    $RunCmd = "bun run"
} elseif ($NodeCmd) {
    $Runtime = "node"
    $RunCmd = "node"
} else {
    Error "Neither Bun nor Node.js found. Please install Bun: https://bun.sh or Node.js: https://nodejs.org"
}

# Create wrapper scripts
$TacoWrapper = "$InstallDir\taco.cmd"
$TacoPs1 = "$InstallDir\taco.ps1"
$TacoSh = "$InstallDir\taco"

# CMD wrapper (for Windows Command Prompt)
@"
@echo off
$RunCmd "$InstallDir\dist\bin\taco.js" %*
"@ | Set-Content -Path $TacoWrapper -Encoding ASCII

# PowerShell wrapper
@"
#!/usr/bin/env pwsh
$RunCmd '$InstallDir\dist\bin\taco.js' @args
"@ | Set-Content -Path $TacoPs1 -Encoding UTF8

# Shell wrapper (for Git Bash)
@"
#!/bin/sh
exec $RunCmd "$InstallDir/dist/bin/taco.js" "`$@"
"@ | Set-Content -Path $TacoSh -Encoding UTF8

# Copy dist folder
Copy-Item -Path "$ScriptDir\dist" -Destination $InstallDir -Recurse -Force

# Copy package.json and install dependencies
Copy-Item -Path "$ScriptDir\package.json" -Destination $InstallDir -Force
Info "Installing dependencies..."
Push-Location $InstallDir
try {
    $null = npm install --omit=dev --silent 2>&1
    Info "Dependencies installed"
} catch {
    Warn "Failed to install dependencies, TACO may not work properly"
} finally {
    Pop-Location
}

Success "Installed to $InstallDir"

# Add to PATH
if (-not $System) {
    $UserPath = [Environment]::GetEnvironmentVariable("PATH", "User")
    if ($UserPath -notlike "*$InstallDir*") {
        [Environment]::SetEnvironmentVariable("PATH", "$UserPath;$InstallDir", "User")
        Info "Added $InstallDir to your user PATH"
    }
    
    # Also add to current session so it works immediately
    $env:PATH = "$InstallDir;$env:PATH"
    Info "Added to current session PATH - taco is ready to use now!"
}

# OpenCode integration info
Write-Host ""
Write-Host "${Bold}[2/2] OpenCode Integration${Reset}"
Write-Host ""
Write-Host "${Cyan}Use TACO in OpenCode with zero LLM tokens:${Reset}"
Write-Host ""
Write-Host "  !taco overview     # Show usage stats"
Write-Host "  !taco today        # Today's usage"
Write-Host "  !taco sessions     # Recent sessions"
Write-Host "  !taco view         # Full dashboard"
Write-Host ""
Write-Host "${Yellow}Note:${Reset} The '!' prefix runs commands locally without sending to AI."

# Done
Write-Host ""
Write-Host "${Green}${Bold}All done!${Reset}"
Write-Host ""
Write-Host "Try these commands:"
Write-Host "  taco           # Overview with charts"
Write-Host "  taco models    # Which models you use"
Write-Host "  taco today     # Today's usage"
Write-Host "  taco --help    # All commands"
Write-Host ""
Write-Host "${Cyan}Use in OpenCode (zero LLM tokens):${Reset}"
Write-Host "  !taco overview     # Show usage stats"
Write-Host "  !taco today        # Today's usage"
Write-Host "  !taco sessions     # Recent sessions"
Write-Host "  !taco view         # Full dashboard"
Write-Host ""

# Verify
$TacoInPath = Get-Command taco -ErrorAction SilentlyContinue
if ($TacoInPath) {
    $Version = & taco --version 2>$null
    if ($Version) {
        Success "You're all set!"
    }
} else {
    Info "Restart your terminal, then try: taco"
}

Write-Host ""
