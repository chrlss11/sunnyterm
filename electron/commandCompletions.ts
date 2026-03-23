export interface CommandFlag {
  name: string
  short?: string
  description: string
  takesValue?: boolean
}

export interface CommandSpec {
  name: string
  description: string
  subcommands?: CommandSpec[]
  flags?: CommandFlag[]
}

export interface CommandCompletionItem {
  value: string
  label: string
  description: string
  kind: 'command' | 'subcommand' | 'flag'
}

export const COMMANDS: CommandSpec[] = [
  {
    name: 'git',
    description: 'Version control',
    subcommands: [
      { name: 'commit', description: 'Record changes', flags: [
        { name: '--message', short: '-m', description: 'Commit message', takesValue: true },
        { name: '--amend', description: 'Amend previous commit' },
        { name: '--no-edit', description: 'Use previous commit message' },
        { name: '--all', short: '-a', description: 'Stage all modified files' },
      ]},
      { name: 'push', description: 'Push to remote', flags: [
        { name: '--force', short: '-f', description: 'Force push' },
        { name: '--set-upstream', short: '-u', description: 'Set upstream branch' },
        { name: '--tags', description: 'Push tags' },
      ]},
      { name: 'pull', description: 'Pull from remote', flags: [
        { name: '--rebase', description: 'Rebase instead of merge' },
      ]},
      { name: 'checkout', description: 'Switch branches', flags: [
        { name: '-b', description: 'Create and switch to new branch' },
      ]},
      { name: 'branch', description: 'List or manage branches', flags: [
        { name: '-d', description: 'Delete branch' },
        { name: '-D', description: 'Force delete branch' },
        { name: '-a', description: 'List all branches' },
      ]},
      { name: 'status', description: 'Show working tree status', flags: [
        { name: '--short', short: '-s', description: 'Short format' },
      ]},
      { name: 'log', description: 'Show commit history', flags: [
        { name: '--oneline', description: 'One line per commit' },
        { name: '--graph', description: 'Show graph' },
        { name: '-n', description: 'Limit commits', takesValue: true },
      ]},
      { name: 'diff', description: 'Show changes' },
      { name: 'add', description: 'Stage files', flags: [
        { name: '--all', short: '-A', description: 'Stage all' },
        { name: '--patch', short: '-p', description: 'Interactive staging' },
      ]},
      { name: 'stash', description: 'Stash changes', subcommands: [
        { name: 'pop', description: 'Apply and remove stash' },
        { name: 'apply', description: 'Apply stash' },
        { name: 'list', description: 'List stashes' },
        { name: 'drop', description: 'Delete stash' },
      ]},
      { name: 'merge', description: 'Merge branches' },
      { name: 'rebase', description: 'Rebase commits', flags: [
        { name: '--interactive', short: '-i', description: 'Interactive rebase' },
        { name: '--abort', description: 'Abort rebase' },
        { name: '--continue', description: 'Continue rebase' },
      ]},
      { name: 'clone', description: 'Clone a repository' },
      { name: 'init', description: 'Initialize a repository' },
      { name: 'remote', description: 'Manage remotes', subcommands: [
        { name: 'add', description: 'Add remote' },
        { name: 'remove', description: 'Remove remote' },
        { name: '-v', description: 'Show remotes with URLs' },
      ]},
      { name: 'reset', description: 'Reset HEAD', flags: [
        { name: '--hard', description: 'Reset working tree' },
        { name: '--soft', description: 'Keep changes staged' },
      ]},
      { name: 'cherry-pick', description: 'Apply commit from another branch' },
      { name: 'tag', description: 'Create/list tags', flags: [
        { name: '-a', description: 'Annotated tag' },
        { name: '-d', description: 'Delete tag' },
      ]},
    ]
  },
  {
    name: 'npm',
    description: 'Node package manager',
    subcommands: [
      { name: 'install', description: 'Install packages', flags: [
        { name: '--save-dev', short: '-D', description: 'Save as dev dependency' },
        { name: '--global', short: '-g', description: 'Install globally' },
      ]},
      { name: 'run', description: 'Run script' },
      { name: 'start', description: 'Start project' },
      { name: 'test', description: 'Run tests' },
      { name: 'init', description: 'Initialize package.json', flags: [{ name: '-y', description: 'Skip questions' }] },
      { name: 'uninstall', description: 'Remove package' },
      { name: 'update', description: 'Update packages' },
      { name: 'publish', description: 'Publish package' },
      { name: 'pack', description: 'Create tarball' },
      { name: 'audit', description: 'Security audit', flags: [{ name: '--fix', description: 'Auto-fix' }] },
      { name: 'outdated', description: 'Check outdated packages' },
      { name: 'ls', description: 'List installed packages' },
      { name: 'ci', description: 'Clean install from lockfile' },
    ]
  },
  {
    name: 'docker',
    description: 'Container platform',
    subcommands: [
      { name: 'ps', description: 'List containers', flags: [{ name: '-a', description: 'Show all' }] },
      { name: 'run', description: 'Run container', flags: [
        { name: '-d', description: 'Detached mode' },
        { name: '-it', description: 'Interactive TTY' },
        { name: '--name', description: 'Container name', takesValue: true },
        { name: '-p', description: 'Port mapping', takesValue: true },
        { name: '-v', description: 'Volume mount', takesValue: true },
        { name: '--rm', description: 'Remove after exit' },
      ]},
      { name: 'build', description: 'Build image', flags: [
        { name: '-t', description: 'Tag', takesValue: true },
        { name: '-f', description: 'Dockerfile path', takesValue: true },
        { name: '--no-cache', description: 'No cache' },
      ]},
      { name: 'compose', description: 'Docker Compose', subcommands: [
        { name: 'up', description: 'Start services', flags: [{ name: '-d', description: 'Detached' }, { name: '--build', description: 'Build first' }] },
        { name: 'down', description: 'Stop services', flags: [{ name: '-v', description: 'Remove volumes' }] },
        { name: 'logs', description: 'View logs', flags: [{ name: '-f', description: 'Follow' }] },
        { name: 'ps', description: 'List services' },
        { name: 'build', description: 'Build services' },
        { name: 'restart', description: 'Restart services' },
      ]},
      { name: 'exec', description: 'Execute in container', flags: [{ name: '-it', description: 'Interactive TTY' }] },
      { name: 'logs', description: 'View logs', flags: [{ name: '-f', description: 'Follow' }, { name: '--tail', description: 'Lines', takesValue: true }] },
      { name: 'images', description: 'List images' },
      { name: 'pull', description: 'Pull image' },
      { name: 'push', description: 'Push image' },
      { name: 'stop', description: 'Stop container' },
      { name: 'start', description: 'Start container' },
      { name: 'rm', description: 'Remove container', flags: [{ name: '-f', description: 'Force' }] },
      { name: 'rmi', description: 'Remove image' },
      { name: 'network', description: 'Manage networks', subcommands: [
        { name: 'ls', description: 'List networks' },
        { name: 'create', description: 'Create network' },
      ]},
      { name: 'volume', description: 'Manage volumes', subcommands: [
        { name: 'ls', description: 'List volumes' },
        { name: 'create', description: 'Create volume' },
        { name: 'prune', description: 'Remove unused' },
      ]},
    ]
  },
  {
    name: 'kubectl',
    description: 'Kubernetes CLI',
    subcommands: [
      { name: 'get', description: 'Get resources', subcommands: [
        { name: 'pods', description: 'List pods' },
        { name: 'services', description: 'List services' },
        { name: 'deployments', description: 'List deployments' },
        { name: 'nodes', description: 'List nodes' },
        { name: 'namespaces', description: 'List namespaces' },
        { name: 'configmaps', description: 'List configmaps' },
        { name: 'secrets', description: 'List secrets' },
        { name: 'ingress', description: 'List ingress' },
      ], flags: [
        { name: '-n', description: 'Namespace', takesValue: true },
        { name: '-o', description: 'Output format', takesValue: true },
        { name: '--all-namespaces', short: '-A', description: 'All namespaces' },
        { name: '-w', description: 'Watch' },
      ]},
      { name: 'describe', description: 'Describe resource' },
      { name: 'logs', description: 'View pod logs', flags: [
        { name: '-f', description: 'Follow' },
        { name: '--tail', description: 'Lines', takesValue: true },
        { name: '-c', description: 'Container', takesValue: true },
        { name: '--all-containers', description: 'All containers' },
      ]},
      { name: 'exec', description: 'Execute in pod', flags: [
        { name: '-it', description: 'Interactive TTY' },
        { name: '-c', description: 'Container', takesValue: true },
      ]},
      { name: 'apply', description: 'Apply config', flags: [
        { name: '-f', description: 'File', takesValue: true },
        { name: '-k', description: 'Kustomize dir', takesValue: true },
      ]},
      { name: 'delete', description: 'Delete resource', flags: [
        { name: '-f', description: 'File', takesValue: true },
      ]},
      { name: 'scale', description: 'Scale deployment', flags: [
        { name: '--replicas', description: 'Replica count', takesValue: true },
      ]},
      { name: 'rollout', description: 'Manage rollouts', subcommands: [
        { name: 'status', description: 'Rollout status' },
        { name: 'restart', description: 'Restart deployment' },
        { name: 'undo', description: 'Rollback' },
        { name: 'history', description: 'Rollout history' },
      ]},
      { name: 'config', description: 'Manage kubeconfig', subcommands: [
        { name: 'get-contexts', description: 'List contexts' },
        { name: 'use-context', description: 'Switch context' },
        { name: 'current-context', description: 'Show current context' },
      ]},
      { name: 'port-forward', description: 'Forward ports' },
      { name: 'top', description: 'Resource usage', subcommands: [
        { name: 'pods', description: 'Pod usage' },
        { name: 'nodes', description: 'Node usage' },
      ]},
    ]
  },
  {
    name: 'bun',
    description: 'Fast JS runtime & package manager',
    subcommands: [
      { name: 'install', description: 'Install packages' },
      { name: 'run', description: 'Run script' },
      { name: 'dev', description: 'Run dev server' },
      { name: 'build', description: 'Build project' },
      { name: 'test', description: 'Run tests' },
      { name: 'add', description: 'Add package', flags: [{ name: '-d', description: 'Dev dependency' }, { name: '-g', description: 'Global' }] },
      { name: 'remove', description: 'Remove package' },
      { name: 'init', description: 'Init project' },
    ]
  },
  {
    name: 'pnpm',
    description: 'Fast package manager',
    subcommands: [
      { name: 'install', description: 'Install packages' },
      { name: 'add', description: 'Add package', flags: [{ name: '-D', description: 'Dev dependency' }, { name: '-g', description: 'Global' }] },
      { name: 'remove', description: 'Remove package' },
      { name: 'run', description: 'Run script' },
      { name: 'dev', description: 'Dev server' },
      { name: 'build', description: 'Build' },
      { name: 'test', description: 'Tests' },
      { name: 'dlx', description: 'Execute package' },
    ]
  },
  {
    name: 'yarn',
    description: 'Package manager',
    subcommands: [
      { name: 'add', description: 'Add package', flags: [{ name: '-D', description: 'Dev' }] },
      { name: 'remove', description: 'Remove package' },
      { name: 'install', description: 'Install all' },
      { name: 'dev', description: 'Dev server' },
      { name: 'build', description: 'Build' },
      { name: 'test', description: 'Test' },
    ]
  },
  {
    name: 'python',
    description: 'Python interpreter',
    flags: [
      { name: '-m', description: 'Run module', takesValue: true },
      { name: '-c', description: 'Run command', takesValue: true },
      { name: '--version', description: 'Show version' },
    ]
  },
  {
    name: 'pip',
    description: 'Python package installer',
    subcommands: [
      { name: 'install', description: 'Install package', flags: [{ name: '-r', description: 'From requirements', takesValue: true }] },
      { name: 'uninstall', description: 'Remove package' },
      { name: 'freeze', description: 'Output installed packages' },
      { name: 'list', description: 'List packages' },
    ]
  },
  {
    name: 'curl',
    description: 'Transfer data',
    flags: [
      { name: '-X', description: 'HTTP method', takesValue: true },
      { name: '-H', description: 'Header', takesValue: true },
      { name: '-d', description: 'Data/body', takesValue: true },
      { name: '-o', description: 'Output file', takesValue: true },
      { name: '-s', description: 'Silent' },
      { name: '-v', description: 'Verbose' },
      { name: '-L', description: 'Follow redirects' },
      { name: '-k', description: 'Insecure SSL' },
      { name: '--json', description: 'Send JSON', takesValue: true },
    ]
  },
  {
    name: 'ssh',
    description: 'Secure shell',
    flags: [
      { name: '-i', description: 'Identity file', takesValue: true },
      { name: '-p', description: 'Port', takesValue: true },
      { name: '-L', description: 'Local port forward', takesValue: true },
      { name: '-R', description: 'Remote port forward', takesValue: true },
      { name: '-N', description: 'No command' },
    ]
  },
  {
    name: 'ls',
    description: 'List directory',
    flags: [
      { name: '-la', description: 'Long format, all files' },
      { name: '-lh', description: 'Human readable sizes' },
      { name: '-R', description: 'Recursive' },
      { name: '-t', description: 'Sort by time' },
    ]
  },
  { name: 'cd', description: 'Change directory' },
  { name: 'mkdir', description: 'Create directory', flags: [{ name: '-p', description: 'Create parents' }] },
  {
    name: 'rm', description: 'Remove files', flags: [
      { name: '-rf', description: 'Recursive force' },
      { name: '-r', description: 'Recursive' },
    ]
  },
  { name: 'cp', description: 'Copy files', flags: [{ name: '-r', description: 'Recursive' }] },
  { name: 'mv', description: 'Move/rename files' },
  { name: 'cat', description: 'Print file contents' },
  {
    name: 'grep', description: 'Search text', flags: [
      { name: '-r', description: 'Recursive' },
      { name: '-i', description: 'Case insensitive' },
      { name: '-n', description: 'Line numbers' },
      { name: '-l', description: 'Files only' },
      { name: '-E', description: 'Extended regex' },
    ]
  },
  {
    name: 'find', description: 'Find files', flags: [
      { name: '-name', description: 'Name pattern', takesValue: true },
      { name: '-type', description: 'Type (f/d)', takesValue: true },
      { name: '-exec', description: 'Execute command', takesValue: true },
    ]
  },
  { name: 'chmod', description: 'Change permissions' },
  { name: 'chown', description: 'Change ownership' },
  { name: 'htop', description: 'Interactive process viewer' },
  { name: 'ps', description: 'List processes', flags: [{ name: 'aux', description: 'All users, detailed' }] },
  { name: 'kill', description: 'Kill process', flags: [{ name: '-9', description: 'Force kill' }] },
  {
    name: 'tail', description: 'View end of file', flags: [
      { name: '-f', description: 'Follow' },
      { name: '-n', description: 'Number of lines', takesValue: true },
    ]
  },
  {
    name: 'head', description: 'View start of file', flags: [
      { name: '-n', description: 'Number of lines', takesValue: true },
    ]
  },
  { name: 'less', description: 'Page through file' },
  { name: 'nano', description: 'Text editor' },
  { name: 'vim', description: 'Text editor' },
  { name: 'code', description: 'VS Code', flags: [{ name: '.', description: 'Open current dir' }] },
  {
    name: 'claude',
    description: 'Claude Code CLI',
    flags: [
      { name: '--dangerously-skip-permissions', description: 'YOLO mode' },
      { name: '--model', description: 'Model name', takesValue: true },
    ]
  },
  {
    name: 'systemctl',
    description: 'System services',
    subcommands: [
      { name: 'start', description: 'Start service' },
      { name: 'stop', description: 'Stop service' },
      { name: 'restart', description: 'Restart service' },
      { name: 'status', description: 'Service status' },
      { name: 'enable', description: 'Enable on boot' },
      { name: 'disable', description: 'Disable on boot' },
    ]
  },
  {
    name: 'pm2',
    description: 'Process manager',
    subcommands: [
      { name: 'start', description: 'Start app' },
      { name: 'stop', description: 'Stop app' },
      { name: 'restart', description: 'Restart app' },
      { name: 'delete', description: 'Delete app' },
      { name: 'list', description: 'List processes' },
      { name: 'logs', description: 'View logs' },
      { name: 'monit', description: 'Monitor' },
      { name: 'save', description: 'Save process list' },
    ]
  },
]

// Build a lookup map for fast access
const commandMap = new Map<string, CommandSpec>()
for (const cmd of COMMANDS) {
  commandMap.set(cmd.name, cmd)
}

/**
 * Walk the command tree based on already-typed tokens and return
 * the current CommandSpec node + the depth at which we are.
 */
function resolveCommandContext(tokens: string[]): { spec: CommandSpec | null; depth: number; currentNode: CommandSpec | null } {
  if (tokens.length === 0) return { spec: null, depth: 0, currentNode: null }

  const rootCmd = commandMap.get(tokens[0])
  if (!rootCmd) return { spec: null, depth: 0, currentNode: null }

  let current = rootCmd
  let depth = 1

  // Walk through tokens trying to match subcommands (skip flags)
  for (let i = 1; i < tokens.length; i++) {
    const tok = tokens[i]
    if (tok.startsWith('-')) continue // skip flags
    if (!current.subcommands) break
    const sub = current.subcommands.find((s) => s.name === tok)
    if (sub) {
      current = sub
      depth = i + 1
    } else {
      break
    }
  }

  return { spec: rootCmd, depth, currentNode: current }
}

/**
 * Collect all flags from the current node, including those already used
 * in previous tokens.
 */
function collectFlags(node: CommandSpec, usedTokens: string[]): CommandFlag[] {
  if (!node.flags) return []
  // Filter out flags already used
  const usedSet = new Set(usedTokens)
  return node.flags.filter((f) => {
    if (usedSet.has(f.name)) return false
    if (f.short && usedSet.has(f.short)) return false
    return true
  })
}

/**
 * Get command completions given the current input tokens.
 * tokens is the input split by whitespace.
 */
export function getCommandCompletions(tokens: string[]): CommandCompletionItem[] {
  const results: CommandCompletionItem[] = []

  // Empty or single partial token — suggest matching top-level commands
  if (tokens.length === 0) return results

  if (tokens.length === 1) {
    const partial = tokens[0].toLowerCase()
    for (const cmd of COMMANDS) {
      if (cmd.name.startsWith(partial)) {
        results.push({
          value: cmd.name,
          label: cmd.name,
          description: cmd.description,
          kind: 'command'
        })
      }
    }
    return results
  }

  // Multiple tokens — walk the tree
  const { currentNode } = resolveCommandContext(tokens.slice(0, -1))
  if (!currentNode) return results

  const lastToken = tokens[tokens.length - 1]
  const lowerLast = lastToken.toLowerCase()

  // If the last token starts with -, suggest flags
  if (lastToken.startsWith('-')) {
    const flags = collectFlags(currentNode, tokens.slice(0, -1))
    for (const flag of flags) {
      if (flag.name.startsWith(lowerLast)) {
        results.push({
          value: flag.name,
          label: flag.name + (flag.short ? ` (${flag.short})` : ''),
          description: flag.description,
          kind: 'flag'
        })
      }
      if (flag.short && flag.short.startsWith(lowerLast) && !flag.name.startsWith(lowerLast)) {
        results.push({
          value: flag.short,
          label: flag.short + ` (${flag.name})`,
          description: flag.description,
          kind: 'flag'
        })
      }
    }
    return results
  }

  // Otherwise suggest subcommands
  if (currentNode.subcommands) {
    for (const sub of currentNode.subcommands) {
      if (sub.name.toLowerCase().startsWith(lowerLast)) {
        results.push({
          value: sub.name,
          label: sub.name,
          description: sub.description,
          kind: 'subcommand'
        })
      }
    }
  }

  // Also suggest flags if the last token is empty or partial
  if (lastToken === '' || !lastToken.startsWith('-')) {
    const flags = collectFlags(currentNode, tokens.slice(0, -1))
    // Only add flags when last token is empty (user pressed tab at end)
    if (lastToken === '') {
      for (const flag of flags) {
        results.push({
          value: flag.name,
          label: flag.name + (flag.short ? ` (${flag.short})` : ''),
          description: flag.description,
          kind: 'flag'
        })
      }
    }
  }

  return results
}

/**
 * Get the best ghost text suggestion from the command database.
 * Given the full input buffer, returns the completion suffix or null.
 */
export function getCommandGhostSuggestion(buffer: string): string | null {
  const trimmed = buffer.trimStart()
  if (!trimmed) return null

  const tokens = trimmed.split(/\s+/)

  // Single partial token — suggest first matching command
  if (tokens.length === 1 && !buffer.endsWith(' ')) {
    const partial = tokens[0].toLowerCase()
    for (const cmd of COMMANDS) {
      if (cmd.name.startsWith(partial) && cmd.name !== partial) {
        return cmd.name.slice(partial.length)
      }
    }
    return null
  }

  // After a complete command + space, suggest first subcommand
  if (tokens.length >= 1 && buffer.endsWith(' ')) {
    const { currentNode } = resolveCommandContext(tokens)
    if (currentNode?.subcommands && currentNode.subcommands.length > 0) {
      return currentNode.subcommands[0].name
    }
    return null
  }

  // Partial subcommand — suggest first matching
  if (tokens.length >= 2 && !buffer.endsWith(' ')) {
    const lastToken = tokens[tokens.length - 1].toLowerCase()
    const { currentNode } = resolveCommandContext(tokens.slice(0, -1))
    if (currentNode?.subcommands) {
      for (const sub of currentNode.subcommands) {
        if (sub.name.startsWith(lastToken) && sub.name !== lastToken) {
          return sub.name.slice(lastToken.length)
        }
      }
    }
    return null
  }

  return null
}
