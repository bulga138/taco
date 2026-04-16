import { homedir, platform } from 'node:os'
import { join } from 'node:path'
import { existsSync } from 'node:fs'

/**
 * Returns the platform-specific default path for the OpenCode SQLite database.
 * Priority order:
 *  1. $OPENCODE_DB env var
 *  2. Platform-specific default path
 */
export function getDefaultDbPath(): string {
  const envPath = process.env['OPENCODE_DB']
  if (envPath) return envPath

  const home = homedir()
  const os = platform()

  // Candidates to try in priority order
  const candidates: string[] = []

  if (os === 'darwin') {
    // macOS: try the XDG path first (OpenCode often uses it on Mac too),
    // then the standard macOS Application Support path
    const xdgDataHome = process.env['XDG_DATA_HOME'] ?? join(home, '.local', 'share')
    candidates.push(join(xdgDataHome, 'opencode', 'opencode.db'))
    candidates.push(join(home, 'Library', 'Application Support', 'opencode', 'opencode.db'))
  } else if (os === 'win32') {
    // Windows: OpenCode uses XDG path (user/.local/share/opencode/)
    const xdgDataHome = process.env['XDG_DATA_HOME'] ?? join(home, '.local', 'share')
    candidates.push(join(xdgDataHome, 'opencode', 'opencode.db'))
  } else {
    // Linux and others: XDG_DATA_HOME or ~/.local/share
    const xdgDataHome = process.env['XDG_DATA_HOME'] ?? join(home, '.local', 'share')
    candidates.push(join(xdgDataHome, 'opencode', 'opencode.db'))
  }

  // Return the first existing path, or the primary candidate if none exist
  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate
  }
  return candidates[0]
}

/**
 * Validates that a path is a readable file.
 */
export function validateDbPath(dbPath: string): void {
  if (!existsSync(dbPath)) {
    throw new Error(
      `OpenCode database not found at: ${dbPath}\n` +
        `Make sure OpenCode is installed and has been run at least once.\n` +
        `You can override the path with --db <path> or $OPENCODE_DB env var.`
    )
  }
}
