#!/bin/bash
# =============================================================================
# install.sh — Install taco (Token Accumulator Counter)
# https://github.com/bulga138/token-accumulator-counter-opencode
#
# This script installs the TypeScript-based taco CLI
#
# Usage:
#   curl -sSL https://raw.githubusercontent.com/bulga138/token-accumulator-counter-opencode/main/install.sh | bash
#   ./install.sh --system   # System-wide install (requires sudo)
#   ./install.sh --local    # Local install only (default)
# =============================================================================

set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# --- Colors ---
if [[ -t 1 ]]; then
  BOLD="\033[1m"
  GREEN="\033[0;32m"
  YELLOW="\033[0;33m"
  CYAN="\033[0;36m"
  RED="\033[0;31m"
  RESET="\033[0m"
else
  BOLD='' GREEN='' YELLOW='' CYAN='' RED='' RESET=''
fi

info()    { echo -e "${CYAN}  ->${RESET} $*"; }
success() { echo -e "${GREEN}  [OK]${RESET} $*"; }
warn()    { echo -e "${YELLOW}  [WARN]${RESET} $*"; }
error()   { echo -e "${RED}  [ERROR]${RESET} $*" >&2; exit 1; }

echo ""
echo -e "${BOLD}🌮 Installing TACO${RESET}"
echo ""

# --- Detect OS ---
detect_os() {
  case "$OSTYPE" in
    darwin*)  echo "macos" ;;
    linux*)   echo "linux" ;;
    msys*|win32*|cygwin*) echo "windows" ;;
    *) echo "unknown" ;;
  esac
}

OS=$(detect_os)
SYSTEM=false
LOCAL_INSTALL=true

# --- Parse args ---
for arg in "$@"; do
  case "$arg" in
    --system|-s) SYSTEM=true; LOCAL_INSTALL=false ;;
    --local|-l) LOCAL_INSTALL=true ;;
    --help|-h)
      echo "Usage: $0 [OPTIONS]"
      echo ""
      echo "Options:"
      echo "  --system, -s   Install system-wide (requires sudo)"
      echo "  --local, -l    Install to ~/.local/bin (default)"
      echo "  --help, -h     Show this help"
      exit 0
      ;;
  esac
done

# --- Check Node.js version ---
info "Checking Node.js version..."

# Try to find node in PATH first
if ! command -v node &> /dev/null; then
  # On Windows Git Bash, try common Node.js locations
  if [[ "$OS" == "windows" ]]; then
    if [[ -f "/c/Program Files/nodejs/node.exe" ]]; then
      export PATH="/c/Program Files/nodejs:$PATH"
    elif [[ -f "/c/Program Files (x86)/nodejs/node.exe" ]]; then
      export PATH="/c/Program Files (x86)/nodejs:$PATH"
    elif [[ -f "$HOME/AppData/Roaming/npm/node.exe" ]]; then
      export PATH="$HOME/AppData/Roaming/npm:$PATH"
    fi
  fi
fi

# Check again after adding Windows paths
if ! command -v node &> /dev/null; then
  error "Node.js is required but not installed. Please install Node.js 18+ from https://nodejs.org"
fi

NODE_VERSION=$(node --version | sed 's/v//')
NODE_MAJOR=$(echo "$NODE_VERSION" | cut -d. -f1)

if [[ "$NODE_MAJOR" -lt 18 ]]; then
  error "Node.js 18+ is required. Found: $NODE_VERSION"
fi

success "Node.js $NODE_VERSION detected"

# --- Determine installation directory ---
if [[ "$SYSTEM" == "true" ]]; then
  if [[ "$OS" == "windows" ]]; then
    INSTALL_DIR="/c/Program Files/taco"
  else
    INSTALL_DIR="/usr/local/bin"
  fi
else
  # User install - use ~/.taco directory
  INSTALL_DIR="${HOME}/.taco"
fi

# --- Check for pre-built dist ---
if [[ ! -d "$REPO_DIR/dist" ]]; then
  warn "No pre-built dist/ folder found"
  info "Building from source..."
  
  # Check for pnpm
  if ! command -v pnpm &> /dev/null; then
    warn "pnpm not found, trying npm..."
    if ! command -v npm &> /dev/null; then
      error "Neither pnpm nor npm found. Please install pnpm: https://pnpm.io/installation"
    fi
    BUILD_CMD="npm run build"
  else
    BUILD_CMD="pnpm run build"
  fi
  
  cd "$REPO_DIR"
  $BUILD_CMD || error "Build failed"
  success "Built successfully"
fi

# --- Install ---
echo ""
echo -e "${BOLD}[1/2] Installing taco...${RESET}"

# Create install directory
mkdir -p "$INSTALL_DIR"

# Detect runtime (prefer Bun for speed)
if command -v bun &> /dev/null; then
  info "Bun detected - using Bun for faster performance"
  RUNTIME="bun"
  RUNCMD="bun run"
elif command -v node &> /dev/null; then
  RUNTIME="node"
  RUNCMD="node"
else
  error "Neither Bun nor Node.js found. Please install Bun: https://bun.sh or Node.js: https://nodejs.org"
fi

# Create wrapper script
TACO_WRAPPER="$INSTALL_DIR/taco"

if [[ "$OS" == "windows" ]]; then
  # Windows batch wrapper (for CMD)
  cat > "$TACO_WRAPPER.bat" << EOF
@echo off
$RUNCMD "%~dp0\dist\bin\taco.js" %*
EOF
  
  # PowerShell wrapper
  cat > "$TACO_WRAPPER.ps1" << EOF
#!/usr/bin/env pwsh
$RUNCMD '$INSTALL_DIR\dist\bin\taco.js' @args
EOF
  
  # Shell wrapper for Git Bash (no extension)
  cat > "$TACO_WRAPPER" << EOF
#!/bin/sh
exec $RUNCMD "$INSTALL_DIR/dist/bin/taco.js" "\$@"
EOF
  chmod +x "$TACO_WRAPPER"
  
  # Copy dist folder
  cp -r "$REPO_DIR/dist" "$INSTALL_DIR/"
  
  success "Installed to $INSTALL_DIR/taco.bat, taco.ps1, and taco (shell)"
else
  # Unix wrapper script
  cat > "$TACO_WRAPPER" << EOF
#!/bin/sh
exec $RUNCMD "$INSTALL_DIR/dist/bin/taco.js" "\$@"
EOF
  chmod +x "$TACO_WRAPPER"
  
  # Copy dist folder
  cp -r "$REPO_DIR/dist" "$INSTALL_DIR/"
  
  # Copy package.json and install dependencies
  cp "$REPO_DIR/package.json" "$INSTALL_DIR/"
  info "Installing dependencies..."
  (cd "$INSTALL_DIR" && npm install --omit=dev --silent) || warn "Failed to install dependencies, TACO may not work properly"
  
  success "Installed to $INSTALL_DIR/taco"
fi

# --- Add to PATH ---
if [[ "$LOCAL_INSTALL" == "true" ]] && [[ "$INSTALL_DIR" == "${HOME}/.taco" ]]; then
  # Add to current session so it works immediately
  export PATH="$HOME/.taco:$PATH"
  info "Added ~/.taco to current session PATH - taco is ready to use now!"
  
  # Also add to shell config for future sessions
  SHELL_RC=""
  if [[ -f "$HOME/.bashrc" ]]; then
    SHELL_RC="$HOME/.bashrc"
  elif [[ -f "$HOME/.zshrc" ]]; then
    SHELL_RC="$HOME/.zshrc"
  fi
  
  if [[ -n "$SHELL_RC" ]] && ! grep -q "\.taco" "$SHELL_RC" 2>/dev/null; then
    echo 'export PATH="$HOME/.taco:$PATH"' >> "$SHELL_RC"
    info "Added ~/.taco to PATH in $SHELL_RC for future sessions"
  fi
fi

# --- OpenCode integration info ---
echo ""
echo -e "${BOLD}[2/2] OpenCode Integration${RESET}"
echo ""
echo -e "${CYAN}Use TACO in OpenCode with zero LLM tokens:${RESET}"
echo ""
echo "  !taco overview     # Show usage stats"
echo "  !taco today        # Today's usage"
echo "  !taco sessions     # Recent sessions"
echo "  !taco view         # Full dashboard"
echo ""
echo -e "${YELLOW}Note:${RESET} The '!' prefix runs commands locally without sending to AI."

# --- Done ---
echo ""
echo -e "${GREEN}${BOLD}All done!${RESET}"
echo ""
echo "Try these commands:"
echo "  taco           # Overview with charts"
echo "  taco models    # Which models you use"
echo "  taco today     # Today's usage"
echo "  taco --help    # All commands"
echo ""
echo -e "${CYAN}Use in OpenCode (zero LLM tokens):${RESET}"
echo "  !taco overview     # Show usage stats"
echo "  !taco today        # Today's usage"
echo "  !taco sessions     # Recent sessions"
echo "  !taco view         # Full dashboard"
echo ""

# Verify installation
if command -v taco &> /dev/null; then
  taco --version 2>/dev/null && success "You're all set!"
else
  info "Restart your terminal or run: source $SHELL_RC"
  info "Then try: taco"
fi
