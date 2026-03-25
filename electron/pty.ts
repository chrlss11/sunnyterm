import * as nodePty from 'node-pty'
import { execSync } from 'child_process'
import { getShellIntegration } from './shellIntegration'

interface PtyEntry {
  pty: nodePty.IPty
  pid: number
  cwd: string
}

export class PtyManager {
  private ptys = new Map<string, PtyEntry>()
  /** User-configured default shell (set from settings) */
  configuredDefault: string = ''

  spawn(
    id: string,
    shellPath: string,
    cols: number,
    rows: number,
    onData: (data: string) => void,
    cwd?: string,
    onExit?: (code: number) => void
  ): number {
    // Clean up any existing PTY with this id
    this.kill(id)

    const shell = shellPath || this.defaultShell()
    const env = {
      ...process.env,
      TERM: 'xterm-256color',
      COLORTERM: 'truecolor',
      TERM_PROGRAM: 'sunnyterm'
    }

    const pty = nodePty.spawn(shell, [], {
      name: 'xterm-256color',
      cols,
      rows,
      cwd: cwd || process.env.HOME || '/',
      env: env as Record<string, string>
    })

    pty.onData(onData)

    pty.onExit(({ exitCode }) => {
      onData(`\r\n\x1b[2m[Process exited with code ${exitCode}]\x1b[0m\r\n`)
      onExit?.(exitCode)
      this.ptys.delete(id)
    })

    const spawnCwd = cwd || process.env.HOME || '/'
    this.ptys.set(id, { pty, pid: pty.pid, cwd: spawnCwd })

    // Inject shell integration script (OSC 133 command boundaries)
    const integration = getShellIntegration(shell)
    if (integration) {
      setTimeout(() => {
        pty.write(integration + '\nclear\n')
      }, 200)
    }

    return pty.pid
  }

  has(id: string): boolean {
    return this.ptys.has(id)
  }

  reattach(
    id: string,
    onData: (data: string) => void,
    onExit?: (code: number) => void
  ): boolean {
    const entry = this.ptys.get(id)
    if (!entry) return false
    // Replace callbacks with new renderer references
    entry.pty.onData(onData)
    entry.pty.onExit(({ exitCode }) => {
      onData(`\r\n\x1b[2m[Process exited with code ${exitCode}]\x1b[0m\r\n`)
      onExit?.(exitCode)
      this.ptys.delete(id)
    })
    return true
  }

  write(id: string, data: string): void {
    this.ptys.get(id)?.pty.write(data)
  }

  resize(id: string, cols: number, rows: number): void {
    this.ptys.get(id)?.pty.resize(cols, rows)
  }

  kill(id: string): void {
    const entry = this.ptys.get(id)
    if (entry) {
      try { entry.pty.kill() } catch {}
      this.ptys.delete(id)
    }
  }

  killAll(): void {
    for (const id of this.ptys.keys()) this.kill(id)
  }

  getCwd(id: string): string | null {
    const entry = this.ptys.get(id)
    if (!entry) return null
    try {
      if (process.platform === 'darwin') {
        return execSync(`lsof -p ${entry.pid} | grep cwd | awk '{print $NF}'`).toString().trim()
      }
      if (process.platform === 'linux') {
        return execSync(`readlink /proc/${entry.pid}/cwd`).toString().trim()
      }
      if (process.platform === 'win32') {
        // Try multiple methods to get CWD on Windows
        // Method 1: Use handle.exe or NtQueryInformationProcess if available
        // Method 2: Track via environment — ask the shell to print its CWD
        try {
          // For PowerShell/cmd: query the shell's current location
          // This is a best-effort approach — we write a command that outputs CWD
          // and capture it from the PTY output. But since that's async, we use
          // the initial CWD + any cd tracking from shell integration.
          const cmd = `powershell -NoProfile -Command "[System.Diagnostics.Process]::GetProcessById(${entry.pid}).StartInfo.WorkingDirectory"`
          const result = execSync(cmd, { timeout: 3000 }).toString().trim()
          if (result) return result
        } catch {}
        // Fallback: return the initial spawn CWD
        return entry.cwd ?? null
      }
    } catch {}
    return null
  }

  private defaultShell(): string {
    if (this.configuredDefault) return this.configuredDefault
    return process.env.SHELL || (process.platform === 'win32' ? 'powershell.exe' : '/bin/bash')
  }
}
