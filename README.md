# TACO 🌮

**Token Accumulator Counter for OpenCode**

Ever wonder how many tokens you're burning through in your OpenCode sessions? TACO tracks your usage, costs, and shows you pretty charts right in your terminal. No more guessing how much that coding session just cost you.

## What it does

- Tracks tokens automatically (input, output, cache hits)
- Shows you daily costs and projections
- Works on Windows, Mac, and Linux without any weird native dependencies
- Draws ASCII charts and heatmaps in your terminal
- Literally zero config - just works with your existing OpenCode setup
- **TUI dashboard opens by default** - interactive charts and stats

## Platform Support

TACO works on all major platforms:

- **Windows** - Tested on Windows 10/11
- **macOS** - Tested on macOS 12+ (Intel and Apple Silicon)
- **Linux** - Tested on Ubuntu 20.04+, should work on most distros

**Recommended:** Install [Bun](https://bun.sh) for best performance (10x faster database queries).

**Also works with:** Node.js 18+ (falls back to sql.js for universal compatibility).

## Installation

### The easy way (standalone binary)

Download a pre-compiled standalone binary (no Node.js or Bun required):

```bash
curl -L https://github.com/bulga138/token-accumulator-counter-opencode/releases/latest/download/taco.zip -o taco.zip
unzip taco.zip
cd taco
./taco
```

**Note:** The release binaries are compiled with Bun's `--compile` feature, so they work standalone without any runtime dependencies.

Or use the install script:

```bash
curl -sSL https://raw.githubusercontent.com/bulga138/token-accumulator-counter-opencode/main/install.sh | bash
```

### Build from source

```bash
git clone https://github.com/bulga138/token-accumulator-counter-opencode.git
cd token-accumulator-counter-opencode
pnpm install
pnpm run build
./dist/bin/taco.js
```

**What you need:**

- **Bun** (recommended for best performance) - [Install Bun](https://bun.sh)
- **or Node.js 18+** (works everywhere, slightly slower)
- pnpm (if building from source)

That's it. No Python, no Visual Studio, no Zig compiler. TACO automatically uses the best available SQLite engine:
- **Bun**: Native `bun:sqlite` (fastest)
- **Node.js**: `better-sqlite3` if installed, otherwise `sql.js` (WASM)

## Commands

Just run `taco` to open the interactive TUI dashboard. Or use these subcommands:

```
taco              # Interactive TUI dashboard (default)
taco overview     # Plain text overview with heatmap
taco models       # Which models you're using most
taco providers    # Breakdown by provider (Fireworks, OpenCode, etc.)
taco sessions     # Recent sessions
taco daily        # Daily stats
taco projects     # Per-project breakdown
taco agents       # Which agent types you use
taco trends       # Compare time periods
taco --plain      # No colors (for scripts)
```

## OpenCode Integration

When you install TACO, it automatically sets up OpenCode integration if detected:

**Using TACO in OpenCode:**

Just type `!` followed by any TACO command directly in your OpenCode chat:

```
!taco overview          # Show usage stats (zero LLM tokens!)
!taco today             # Today's usage
!taco creature          # Check your companion
!taco cost              # Cost breakdown
!taco models            # Model usage
!taco sessions          # Recent sessions
!taco view              # Full dashboard
```

**Why this is better:** Using `!` runs the command locally and prints output directly to your terminal without sending any tokens to the AI. It's instant and free.

**Note:** Slash commands like `/stats` would send data to the AI (consuming tokens). Always use `!taco` commands for zero-token usage stats.

## How it works

TACO reads directly from OpenCode's SQLite database - no separate daemon, no background process, no fuss. It just queries the data and shows it to you in a nice format.

```
OpenCode stores data in SQLite
         ↓
TACO reads it with sql.js
         ↓
Pretty charts in your terminal
```

**Where OpenCode keeps its data:**

- Windows: `~/.local/share/opencode/` (XDG path, same as Linux)
- Mac: `~/Library/Application Support/opencode/`
- Linux: `~/.local/share/opencode/`

## What's under the hood

Just TypeScript and a few libraries:

**Database drivers (auto-detected, fastest available wins):**
- **Bun**: Native `bun:sqlite` (10x faster)
- **Node.js**: `better-sqlite3` if installed, otherwise `sql.js` (WASM)

**Other libraries:**
- commander (CLI args)
- chalk (colors)
- asciichart (the pretty line charts)
- dayjs (date formatting)

## Project layout

```
token-accumulator-counter-opencode/
├── bin/taco.ts         # Entry point
├── src/
│   ├── cli/            # Commands
│   ├── data/           # Database stuff
│   ├── format/         # Output formatting
│   ├── viz/            # Charts and heatmaps
│   └── utils/          # Helper functions
├── dist/               # Compiled JS
└── tests/              # Tests
```

## Testing

TACO has unit tests for core functionality:

```bash
pnpm test       # Run all tests
pnpm run test:coverage  # Run with coverage report
```

**Current test coverage:**

- Aggregator functions (overview, models, providers, etc.)
- Data formatters (token formatting, cost calculations)
- Database queries (event loading, session queries)

**Want to add more tests?** The test suite uses Vitest. Add new test files in the `tests/` directory following the existing patterns.

## Development

```bash
pnpm install    # Get dependencies
pnpm run build      # Compile
pnpm test       # Run tests
pnpm run typecheck  # Check types
```

## Updating

```bash
./update.sh     # Automatic update
# or
git pull && pnpm install && pnpm run build
```

## Uninstall

```bash
./uninstall.sh
```

## License

MIT - do whatever you want with it.
