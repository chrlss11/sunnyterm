import React, { useState, useRef, useEffect } from 'react'
import { useStore } from '../store'
import { FolderOpen } from 'lucide-react'

export function WorkspacePicker() {
  const workspaces = useStore((s) => s.workspaces)
  const activeWorkspace = useStore((s) => s.activeWorkspace)
  const { saveWorkspace, loadWorkspace, deleteWorkspace } = useStore()

  const [isOpen, setIsOpen] = useState(false)
  const [saveInput, setSaveInput] = useState('')
  const [saving, setSaving] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // Close dropdown when clicking outside
  useEffect(() => {
    if (!isOpen) return
    const handleClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [isOpen])

  // Focus input when dropdown opens
  useEffect(() => {
    if (isOpen) {
      setSaveInput('')
      setTimeout(() => inputRef.current?.focus(), 0)
    }
  }, [isOpen])

  const handleSaveAs = async (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter') return
    const name = saveInput.trim()
    if (!name) return
    setSaving(true)
    await saveWorkspace(name)
    setSaving(false)
    setSaveInput('')
    setIsOpen(false)
  }

  const handleLoad = async (name: string) => {
    setIsOpen(false)
    // Confirm before clobbering current work if loading a different workspace
    const { tiles, activeWorkspace } = useStore.getState()
    if (tiles.length > 0 && name !== activeWorkspace) {
      const confirmed = window.confirm(`Load workspace "${name}"?\n\nUnsaved changes will be lost.`)
      if (!confirmed) return
    }
    await loadWorkspace(name)
  }

  const handleDelete = async (e: React.MouseEvent, name: string) => {
    e.stopPropagation()
    await deleteWorkspace(name)
  }

  const label = activeWorkspace ?? 'Workspace'

  const btn = 'px-2 py-1 text-xs rounded text-text-secondary hover:text-text-primary hover:bg-black/5 dark:hover:bg-white/10 transition-colors'

  return (
    <div ref={containerRef} className="relative">
      <button
        className={`${btn} flex items-center gap-1 ${activeWorkspace ? 'text-blue-300' : ''}`}
        onClick={() => setIsOpen((v) => !v)}
        title="Workspaces"
      >
        <FolderOpen size={14} />
        <span className="max-w-[120px] truncate text-[11px]">{label}</span>
        <span className="text-text-muted text-[10px]">▾</span>
      </button>

      {isOpen && (
        <div
          className="absolute bottom-full left-0 mb-1 w-56 rounded border border-border bg-tile shadow-xl z-[9999] py-1"
          style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
        >
          {/* Save as input */}
          <div className="px-2 py-1 border-b border-border">
            <input
              ref={inputRef}
              type="text"
              value={saveInput}
              onChange={(e) => setSaveInput(e.target.value)}
              onKeyDown={handleSaveAs}
              placeholder={activeWorkspace ? `Save "${activeWorkspace}"…` : 'Save as… (Enter)'}
              disabled={saving}
              className="w-full bg-black/5 dark:bg-white/5 border border-border rounded px-2 py-1 text-xs text-text-primary placeholder-text-muted outline-none focus:border-blue-400/60"
            />
          </div>

          {/* Workspace list */}
          {workspaces.length === 0 ? (
            <div className="px-3 py-2 text-xs text-text-muted">No saved workspaces</div>
          ) : (
            workspaces.map((name, i) => (
              <div
                key={name}
                className={`flex items-center px-2 py-1 cursor-pointer hover:bg-black/5 dark:hover:bg-white/5 group ${
                  name === activeWorkspace ? 'text-blue-500 dark:text-blue-300' : 'text-text-secondary'
                }`}
                onClick={() => handleLoad(name)}
              >
                {/* Cmd+1-9 hint */}
                <span className="text-text-muted text-[10px] w-6 shrink-0">
                  {i < 9 ? `⌘${i + 1}` : ''}
                </span>
                <span className="flex-1 text-xs truncate">{name}</span>
                <button
                  className="opacity-0 group-hover:opacity-100 text-text-muted hover:text-red-400 ml-1 text-xs px-1 rounded transition-all"
                  onClick={(e) => handleDelete(e, name)}
                  title="Delete workspace"
                >
                  ✕
                </button>
              </div>
            ))
          )}

          {/* Quick save hint */}
          <div className="px-3 pt-1 pb-1 border-t border-border text-[10px] text-text-muted">
            ⌘S to save · ⌘1-9 to switch
          </div>
        </div>
      )}
    </div>
  )
}
