import React, { useState, useRef, useEffect, useCallback } from 'react'

export interface Shortcut {
  label: string
  command: string
}

const STORAGE_KEY = 'sunnyterm-terminal-shortcuts'

const DEFAULT_SHORTCUTS: Shortcut[] = [
  { label: 'Claude', command: 'claude' },
  { label: 'Claude YOLO', command: 'claude --dangerously-skip-permissions' },
  { label: 'Remote Claude', command: 'ssh chrlss@$(hostname) -t "cd ~/projects && claude"' }
]

function loadShortcuts(): Shortcut[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw)
  } catch {}
  return DEFAULT_SHORTCUTS
}

function saveShortcuts(shortcuts: Shortcut[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(shortcuts))
}

interface Props {
  tileId: string
}

export function TerminalShortcuts({ tileId }: Props) {
  const [shortcuts, setShortcuts] = useState<Shortcut[]>(loadShortcuts)
  const [adding, setAdding] = useState(false)
  const [newLabel, setNewLabel] = useState('')
  const [newCommand, setNewCommand] = useState('')
  const addMenuRef = useRef<HTMLDivElement>(null)
  const addBtnRef = useRef<HTMLButtonElement>(null)

  // Close add form on outside click
  useEffect(() => {
    if (!adding) return
    const handle = (e: MouseEvent) => {
      if (addMenuRef.current && !addMenuRef.current.contains(e.target as Node) &&
          addBtnRef.current && !addBtnRef.current.contains(e.target as Node)) {
        setAdding(false)
      }
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [adding])

  const runShortcut = useCallback((command: string) => {
    window.electronAPI.ptyWrite(tileId, command + '\n')
  }, [tileId])

  const handleAdd = useCallback(() => {
    if (!newLabel.trim() || !newCommand.trim()) return
    const updated = [...shortcuts, { label: newLabel.trim(), command: newCommand.trim() }]
    setShortcuts(updated)
    saveShortcuts(updated)
    setNewLabel('')
    setNewCommand('')
    setAdding(false)
  }, [shortcuts, newLabel, newCommand])

  const handleRemove = useCallback((index: number, e: React.MouseEvent) => {
    e.stopPropagation()
    const updated = shortcuts.filter((_, i) => i !== index)
    setShortcuts(updated)
    saveShortcuts(updated)
  }, [shortcuts])

  const btnStyle = {
    color: 'var(--text-muted)',
    background: 'var(--titlebar)',
  }

  const btnClass = 'flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium cursor-pointer backdrop-blur-sm transition-all duration-150'

  return (
    <div
      className="absolute bottom-1 left-1.5 z-50"
      onMouseDown={e => e.stopPropagation()}
      onPointerDown={e => e.stopPropagation()}
    >
      <div className="flex items-center gap-1 flex-wrap">
        {/* Inline shortcut buttons */}
        {shortcuts.map((s, i) => (
          <div key={i} className="group relative flex items-center">
            <button
              className={btnClass}
              style={btnStyle}
              onClick={() => runShortcut(s.command)}
              title={s.command}
            >
              <svg className="w-3 h-3" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 4l4 4-4 4" />
              </svg>
              <span>{s.label}</span>
            </button>
            {/* Remove button on hover */}
            <button
              className="absolute -top-1.5 -right-1.5 w-3.5 h-3.5 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
              style={{ background: 'var(--titlebar)', color: 'var(--text-muted)' }}
              onClick={(e) => handleRemove(i, e)}
              onMouseEnter={e => (e.currentTarget.style.color = '#ef4444')}
              onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}
              title="Remove shortcut"
            >
              <svg className="w-2.5 h-2.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <path d="M4 4l8 8M12 4l-8 8" />
              </svg>
            </button>
          </div>
        ))}

        {/* Kill button */}
        <button
          onClick={() => window.electronAPI.ptyWrite(tileId, '\x03')}
          className={btnClass}
          style={btnStyle}
          title="Send Ctrl+C"
        >
          <svg className="w-3 h-3" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 4l8 8M12 4l-8 8" />
          </svg>
          <span>Kill</span>
        </button>

        {/* Add shortcut button */}
        <div className="relative">
          <button
            ref={addBtnRef}
            onClick={() => setAdding((v) => !v)}
            className={btnClass}
            style={btnStyle}
            title="Add shortcut"
          >
            <svg className="w-3 h-3" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M8 3v10M3 8h10" />
            </svg>
          </button>

          {/* Add shortcut form popup */}
          {adding && (
            <div
              ref={addMenuRef}
              className="absolute bottom-full left-0 mb-1 min-w-[220px] rounded-lg overflow-hidden shadow-lg"
              style={{
                background: 'var(--surface)',
                border: '1px solid var(--border)',
              }}
            >
              <div className="p-2 flex flex-col gap-1.5">
                <input
                  className="w-full px-2 py-1 rounded text-[11px] border-none outline-none"
                  style={{
                    background: 'var(--titlebar)',
                    color: 'var(--text-primary)',
                  }}
                  placeholder="Label"
                  value={newLabel}
                  onChange={(e) => setNewLabel(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
                  autoFocus
                />
                <input
                  className="w-full px-2 py-1 rounded text-[11px] font-mono border-none outline-none"
                  style={{
                    background: 'var(--titlebar)',
                    color: 'var(--text-primary)',
                  }}
                  placeholder="Command"
                  value={newCommand}
                  onChange={(e) => setNewCommand(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
                />
                <div className="flex gap-1.5 justify-end">
                  <button
                    className="px-2 py-0.5 rounded text-[10px] cursor-pointer transition-colors"
                    style={{ color: 'var(--text-muted)' }}
                    onClick={() => setAdding(false)}
                  >
                    Cancel
                  </button>
                  <button
                    className="px-2 py-0.5 rounded text-[10px] bg-blue-600 text-white hover:bg-blue-500 cursor-pointer transition-colors"
                    onClick={handleAdd}
                  >
                    Add
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
