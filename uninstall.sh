#!/usr/bin/env bash
# =============================================================================
# TACO — Token Accumulator Counter for OpenCode
# Uninstall script
# =============================================================================

set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

BOLD="\033[1m"
GREEN="\033[0;32m"
CYAN="\033[0;36m"
RESET="\033[0m"

info()    { echo -e "${CYAN}  ->${RESET} $*"; }
success() { echo -e "${GREEN}  [OK]${RESET} $*"; }

echo ""
echo -e "${BOLD}🌮 TACO — Uninstall${RESET}"
echo ""

# Remove TACO installation directory
TACO_DIR="${HOME}/.taco"
if [[ -d "$TACO_DIR" ]]; then
  rm -rf "$TACO_DIR"
  success "Removed TACO directory → $TACO_DIR"
else
  info "TACO directory not found — skipping"
fi

# Remove from PATH in shell rc files
for rc in "$HOME/.bashrc" "$HOME/.zshrc"; do
  if [[ -f "$rc" ]] && grep -q "\.taco" "$rc" 2>/dev/null; then
    sed -i '/\.taco/d' "$rc" 2>/dev/null || true
    info "Removed ~/.taco from PATH in $rc"
  fi
done

echo ""
echo -e "${GREEN}${BOLD}Uninstall complete.${RESET}"
echo ""
echo "Note: TACO data in OpenCode's database is preserved."
echo "To remove that data, delete OpenCode's opencode.db file."
echo ""
