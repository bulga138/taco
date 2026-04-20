import type { Command, Option } from 'commander'

// ─── Types ────────────────────────────────────────────────────────────────────

interface CmdMeta {
  name: string
  aliases: string[]
  options: OptMeta[]
  subcommands: string[] // for commands like `config` and `export`
}

interface OptMeta {
  long: string
  short: string | undefined
  choices: string[] | undefined
  isBoolean: boolean
}

// ─── Metadata extraction ──────────────────────────────────────────────────────

function extractMeta(program: Command): CmdMeta[] {
  const result: CmdMeta[] = []

  for (const cmd of program.commands) {
    const name = cmd.name()
    // Skip internal / help commands
    if (name === 'help') continue

    const aliases = cmd.aliases()
    const options: OptMeta[] = []

    for (const opt of cmd.options as Option[]) {
      if (!opt.long) continue
      options.push({
        long: opt.long,
        short: opt.short,
        choices: opt.argChoices,
        isBoolean: opt.isBoolean(),
      })
    }

    // Collect positional argument choices for commands that take a subcommand
    // word as their first argument (e.g. `config path|set|gateway`, `export <target>`)
    const subcommands: string[] = []
    for (const arg of cmd.registeredArguments) {
      if (arg.argChoices) subcommands.push(...arg.argChoices)
    }
    // Also collect nested sub-commands (e.g. commander sub-commands of config)
    for (const sub of cmd.commands) {
      if (sub.name() !== 'help') subcommands.push(sub.name())
    }

    result.push({ name, aliases, options, subcommands })
  }

  return result
}

// ─── Bash completion script ───────────────────────────────────────────────────

function generateBash(cmds: CmdMeta[]): string {
  const allNames = cmds.map(c => c.name).join(' ')

  // Per-command option lists and value completions
  const caseEntries = cmds
    .flatMap(c => {
      const flags = c.options.map(o => o.long).join(' ')
      const keys = [c.name, ...c.aliases].join('|')
      return [`        ${keys}) opts="${flags}" ;;`]
    })
    .join('\n')

  // Per-option value completions — deduplicated by flag name.
  // When the same flag (e.g. --format) appears across many commands we only
  // need one case entry; the longest/richest choices wins.
  const choicesByFlag = new Map<string, string[]>()
  for (const c of cmds) {
    for (const o of c.options) {
      if (!o.choices || o.choices.length === 0) continue
      const existing = choicesByFlag.get(o.long)
      if (!existing || o.choices.length > existing.length) {
        choicesByFlag.set(o.long, o.choices)
      }
    }
  }
  const valueCases = [...choicesByFlag.entries()]
    .map(
      ([flag, vals]) =>
        `      ${flag}) COMPREPLY=($(compgen -W "${vals.join(' ')}" -- "$cur")); return ;;`
    )
    .join('\n')

  // Subcommand word completions (e.g. `taco config <TAB>` → path set gateway …)
  const subCases = cmds
    .filter(c => c.subcommands.length > 0)
    .map(c => {
      const subs = c.subcommands.join(' ')
      const keys = [c.name, ...c.aliases].join('|')
      return `      ${keys}) COMPREPLY=($(compgen -W "${subs}" -- "$cur")); return ;;`
    })
    .join('\n')

  return `# taco shell completion — bash
# Add to ~/.bashrc or ~/.bash_profile:
#   eval "$(taco completion --bash)"
# Or append the script permanently:
#   taco completion --bash >> ~/.bashrc

_taco_completions() {
  local cur prev words cword opts
  _init_completion 2>/dev/null || {
    COMPREPLY=()
    cur="\${COMP_WORDS[COMP_CWORD]}"
    prev="\${COMP_WORDS[COMP_CWORD-1]}"
  }

  # If the previous word is a value-taking option, complete its choices
  case "$prev" in
${valueCases}
  esac

  # First argument: complete command names
  if [[ \${COMP_CWORD} -eq 1 ]]; then
    COMPREPLY=($(compgen -W "${allNames}" -- "$cur"))
    return
  fi

  local cmd="\${COMP_WORDS[1]}"

  # Second argument position: complete subcommand words for known commands
  if [[ \${COMP_CWORD} -eq 2 ]]; then
    case "$cmd" in
${subCases}
    esac
  fi

  # Complete options for each subcommand
  case "$cmd" in
${caseEntries}
    *) opts="--help" ;;
  esac

  COMPREPLY=($(compgen -W "$opts --help" -- "$cur"))
}

complete -o default -F _taco_completions taco
`
}

// ─── Zsh completion script ────────────────────────────────────────────────────

function generateZsh(cmds: CmdMeta[]): string {
  // Full command names only — aliases are excluded from the visible completion
  // list but still matched in the per-command case entries below.
  const cmdNames = cmds.map(c => c.name).join(' ')

  const subcmdCases = cmds
    .map(c => {
      const optSpecs = c.options
        .map(o => {
          if (o.choices && o.choices.length > 0) {
            const vals = o.choices.map(v => `'${v}'`).join(' ')
            if (o.short) {
              return `        '(${o.long} ${o.short})'{${o.long},${o.short}}'[option]:value:(${o.choices.join(' ')})' \\`
            }
            return `        '${o.long}[option]:value:(${vals})' \\`
          }
          if (o.isBoolean) {
            if (o.short) {
              return `        '(${o.long} ${o.short})'{${o.long},${o.short}}'[flag]' \\`
            }
            return `        '${o.long}[flag]' \\`
          }
          if (o.short) {
            return `        '(${o.long} ${o.short})'{${o.long},${o.short}}'[option]:value:_default' \\`
          }
          return `        '${o.long}[option]:value:_default' \\`
        })
        .join('\n')

      const subSpec =
        c.subcommands.length > 0 ? `        ':subcommand:(${c.subcommands.join(' ')})' \\` : ''

      const keys = [c.name, ...c.aliases].join('|')
      return `      (${keys})
        _arguments \\
${subSpec}
${optSpecs}
        '--help[show help]'
        ;;`
    })
    .join('\n')

  return `#compdef taco
# taco shell completion — zsh
# Add to ~/.zshrc:
#   eval "$(taco completion --zsh)"
# Or install for fpath-based loading:
#   taco completion --zsh > "$(echo $fpath | cut -d' ' -f1)/_taco"

# Ensure the zsh completion system is initialized.
# Safe to run even if compinit was already called (e.g. via oh-my-zsh).
if ! type compdef &>/dev/null; then
  autoload -Uz compinit && compinit
fi

_taco() {
  local state

  _arguments \\
    '1: :->command' \\
    '*:: :->args'

  case $state in
    command)
      compadd -- ${cmdNames}
      ;;
    args)
      case \${words[1]} in
${subcmdCases}
        *)
          _arguments '--help[show help]'
          ;;
      esac
      ;;
  esac
}

# Register the completion function with zsh.
# This is the line that makes eval-based loading work (the #compdef comment
# above only works when the file is placed in a $fpath directory).
compdef _taco taco
`
}

// ─── Fish completion script ───────────────────────────────────────────────────

function generateFish(cmds: CmdMeta[]): string {
  const lines: string[] = [
    '# taco shell completion — fish',
    '# Add to your fish config:',
    '#   taco completion --fish > ~/.config/fish/completions/taco.fish',
    '',
    '# Disable file completion by default',
    'complete -c taco -f',
    '',
    '# Top-level subcommands',
  ]

  for (const c of cmds) {
    lines.push(`complete -c taco -n '__fish_use_subcommand' -a '${c.name}'`)
  }

  lines.push('')
  lines.push('# Per-subcommand options')

  for (const c of cmds) {
    const subcmdCond = `__fish_seen_subcommand_from ${[c.name, ...c.aliases].join(' ')}`

    // Subcommand word completions
    for (const sub of c.subcommands) {
      lines.push(`complete -c taco -n '${subcmdCond}' -a '${sub}'`)
    }

    for (const o of c.options) {
      const longFlag = o.long.replace(/^--/, '')
      let line = `complete -c taco -n '${subcmdCond}'`
      if (o.short) line += ` -s '${o.short.replace(/^-/, '')}'`
      line += ` -l '${longFlag}'`
      if (o.isBoolean) {
        // no argument
      } else if (o.choices && o.choices.length > 0) {
        line += ` -r -a '${o.choices.join(' ')}'`
      } else {
        line += ' -r'
      }
      lines.push(line)
    }

    lines.push('')
  }

  return lines.join('\n') + '\n'
}

// ─── Shell detection ──────────────────────────────────────────────────────────

function detectShell(): 'bash' | 'zsh' | 'fish' {
  const shell = process.env.SHELL ?? ''
  if (shell.includes('zsh')) return 'zsh'
  if (shell.includes('fish')) return 'fish'
  return 'bash'
}

// ─── Command registration ──────────────────────────────────────────────────────

export function registerCompletionCommand(program: Command): void {
  program
    .command('completion')
    .description('Generate shell completion script (bash, zsh, fish)')
    .option('--bash', 'Output bash completion script')
    .option('--zsh', 'Output zsh completion script')
    .option('--fish', 'Output fish completion script')
    .addHelpText(
      'after',
      `
Examples:
  # Auto-detect shell and install permanently
  eval "$(taco completion)"

  # Install for bash
  taco completion --bash >> ~/.bashrc && source ~/.bashrc

  # Install for zsh
  taco completion --zsh >> ~/.zshrc && source ~/.zshrc

  # Install for fish
  taco completion --fish > ~/.config/fish/completions/taco.fish
`
    )
    .action((opts: { bash?: boolean; zsh?: boolean; fish?: boolean }) => {
      // Resolve target shell
      let shell: 'bash' | 'zsh' | 'fish'
      if (opts.bash) shell = 'bash'
      else if (opts.zsh) shell = 'zsh'
      else if (opts.fish) shell = 'fish'
      else shell = detectShell()

      // Extract metadata from the live program tree.
      // At action time all commands are already registered.
      const cmds = extractMeta(program)

      let script: string
      switch (shell) {
        case 'zsh':
          script = generateZsh(cmds)
          break
        case 'fish':
          script = generateFish(cmds)
          break
        default:
          script = generateBash(cmds)
      }

      process.stdout.write(script)
    })
}
