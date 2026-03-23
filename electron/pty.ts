import * as nodePty from 'node-pty'
import { execSync } from 'child_process'
import { getShellIntegration } from './shellIntegration'

interface PtyEntry {
  pty: nodePty.IPty
  pid: number
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

    this.ptys.set(id, { pty, pid: pty.pid })

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
        // Use PowerShell to get the working directory of the child process
        const cmd = `powershell -NoProfile -Command "(Get-Process -Id ${entry.pid} -ErrorAction SilentlyContinue).Path | Split-Path -Parent"`
        const result = execSync(cmd, { timeout: 3000 }).toString().trim()
        if (result) return result
      }
    } catch {}
    return null
  }

  private defaultShell(): string {
    if (this.configuredDefault) return this.configuredDefault
    return process.env.SHELL || (process.platform === 'win32' ? 'powershell.exe' : '/bin/bash')
  }
}
