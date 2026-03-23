/**
 * ShellPicker — dropdown to select which shell to open for new terminals.
 * Also allows setting the default shell.
 */

import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useStore } from '../store'
import type { ShellInfo } from '../types'
import { Terminal, ChevronDown, Check, Star } from 'lucide-react'

const SHELL_ICONS: Record<string, string> = {
  powershell: '$_',
  cmd: '>_',
  git: '±',
  bash: '$',
  zsh: '%',
  fish: '><>',
  nushell: '>',
  linux: '🐧',
  sh: '#',
}

export function ShellPicker() {
  const [shells, setShells] = useState<ShellInfo[]>([])
  const [defaultShell, setDefaultShell] = useState<string>('')
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const { spawnTile } = useStore()

  // Load shells on mount
  useEffect(() => {
    window.electronAPI.shellsList().then(setShells)
    window.electronAPI.shellsGetDefault().then(setDefaultShell)
  }, [])

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return
    const handle = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [isOpen])

  const handleSpawn = useCallback((shell: ShellInfo) => {
    spawnTile('terminal', undefined, undefined, undefined, undefined, shell.path)
    setIsOpen(false)
  }, [spawnTile])

  const handleSetDefault = useCallback((shell: ShellInfo, e: React.MouseEvent) => {
    e.stopPropagation()
    const newDefault = defaultShell === shell.path ? '' : shell.path
    window.electronAPI.shellsSetDefault(newDefault)
    setDefaultShell(newDefault)
  }, [defaultShell])

  if (shells.length === 0) return null

  return (
    <div ref={containerRef} className="relative" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
      <button
        className="p-1.5 rounded-md text-text-muted hover:text-text-primary hover:bg-black/5 dark:hover:bg-white/8 transition-colors flex items-center gap-0.5 cursor-pointer"
        onClick={() => setIsOpen(!isOpen)}
        title="Choose shell for new terminal"
      >
        <Terminal size={14} />
        <ChevronDown size={10} />
      </button>

      {isOpen && (
        <div
          className="absolute top-full left-0 mt-1 w-56 rounded-lg border shadow-xl py-1 z-50"
          style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
        >
          <div className="px-3 py-1 text-[10px] text-text-muted font-medium uppercase tracking-wider">
            Open terminal with...
          </div>

          {shells.map((shell) => {
            const isDefault = defaultShell === shell.path
            return (
              <div
                key={shell.id}
                className="flex items-center gap-2 px-3 py-1.5 text-xs cursor-pointer transition-colors hover:brightness-125 group"
                style={{ color: 'var(--text-primary)' }}
                onClick={() => handleSpawn(shell)}
              >
                {/* Shell icon badge */}
                <span
                  className="w-5 h-5 rounded flex items-center justify-center text-[9px] font-mono font-bold shrink-0"
                  style={{ background: 'var(--titlebar)', color: 'var(--text-muted)' }}
                >
                  {SHELL_ICONS[shell.icon] ?? '>'}
                </span>

                <span className="flex-1 truncate">{shell.name}</span>

                {/* Default indicator / set default button */}
                <button
                  className={`shrink-0 transition-all cursor-pointer ${
                    isDefault
                      ? 'text-yellow-400 opacity-100'
                      : 'text-text-muted opacity-0 group-hover:opacity-50 hover:!opacity-100'
                  }`}
                  onClick={(e) => handleSetDefault(shell, e)}
                  title={isDefault ? 'Remove as default' : 'Set as default shell'}
                >
                  <Star size={12} fill={isDefault ? 'currentColor' : 'none'} />
                </button>
              </div>
            )
          })}

          {defaultShell && (
            <div className="px-3 pt-1 pb-0.5 border-t text-[10px] text-text-muted" style={{ borderColor: 'var(--border)' }}>
              Default: {shells.find((s) => s.path === defaultShell)?.name ?? 'Custom'}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
