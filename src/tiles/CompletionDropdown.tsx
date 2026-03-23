import React, { useEffect, useRef, useState } from 'react'

export interface CompletionItem {
  value: string
  label: string
  kind: 'file' | 'directory' | 'branch' | 'remote' | 'tag' | 'command' | 'subcommand' | 'flag'
  description?: string
}

interface Props {
  items: CompletionItem[]
  position: { x: number; y: number }
  onSelect: (item: CompletionItem) => void
  onDismiss: () => void
  isDark: boolean
}

const KIND_ICONS: Record<string, string> = {
  directory: '\u{1F4C1}',
  file: '\u{1F4C4}',
  branch: '\u238B',
  remote: '\u2601',
  tag: '\u{1F3F7}',
  command: '\u25B6',
  subcommand: '\u2192',
  flag: '\u2014'
}

export function CompletionDropdown({ items, position, onSelect, onDismiss, isDark }: Props) {
  const [selectedIndex, setSelectedIndex] = useState(0)
  const listRef = useRef<HTMLDivElement>(null)

  // Reset selection when items change
  useEffect(() => {
    setSelectedIndex(0)
  }, [items])

  // Scroll selected item into view
  useEffect(() => {
    const list = listRef.current
    if (!list) return
    const selected = list.children[selectedIndex] as HTMLElement
    if (selected) {
      selected.scrollIntoView({ block: 'nearest' })
    }
  }, [selectedIndex])

  // Keyboard navigation
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault()
          e.stopPropagation()
          setSelectedIndex((i) => Math.min(i + 1, items.length - 1))
          break
        case 'ArrowUp':
          e.preventDefault()
          e.stopPropagation()
          setSelectedIndex((i) => Math.max(i - 1, 0))
          break
        case 'Enter':
        case 'Tab':
          e.preventDefault()
          e.stopPropagation()
          if (items[selectedIndex]) {
            onSelect(items[selectedIndex])
          }
          break
        case 'Escape':
          e.preventDefault()
          e.stopPropagation()
          onDismiss()
          break
      }
    }
    // Capture phase to intercept before xterm gets them
    document.addEventListener('keydown', handler, true)
    return () => document.removeEventListener('keydown', handler, true)
  }, [items, selectedIndex, onSelect, onDismiss])

  if (items.length === 0) return null

  const hasDescriptions = items.some((item) => item.description)

  const bg = isDark ? '#2a2d31' : '#ffffff'
  const border = isDark ? '#444' : '#d0d0d0'
  const hoverBg = isDark ? '#3a3f47' : '#e8eaed'
  const textColor = isDark ? '#e0e0e0' : '#24292e'
  const dimColor = isDark ? '#888' : '#999'
  const descColor = isDark ? '#6b7280' : '#9ca3af'

  return (
    <div
      style={{
        position: 'absolute',
        left: position.x,
        top: position.y,
        zIndex: 100,
        minWidth: hasDescriptions ? 280 : 200,
        maxWidth: 440,
        maxHeight: 280,
        overflowY: 'auto',
        background: bg,
        border: `1px solid ${border}`,
        borderRadius: 6,
        boxShadow: isDark
          ? '0 4px 16px rgba(0,0,0,0.5)'
          : '0 4px 16px rgba(0,0,0,0.15)',
        fontFamily: '"Google Sans Mono", Menlo, Monaco, monospace',
        fontSize: 12,
        color: textColor,
        padding: '4px 0'
      }}
      ref={listRef}
      onMouseDown={(e) => e.preventDefault()} // prevent focus loss
    >
      {items.map((item, i) => (
        <div
          key={item.value + item.kind + i}
          style={{
            padding: hasDescriptions ? '5px 10px' : '4px 10px',
            cursor: 'pointer',
            background: i === selectedIndex ? hoverBg : 'transparent',
            display: 'flex',
            alignItems: 'flex-start',
            gap: 8
          }}
          onMouseEnter={() => setSelectedIndex(i)}
          onClick={() => onSelect(item)}
        >
          <span style={{ width: 16, fontSize: 13, textAlign: 'center', flexShrink: 0, marginTop: 1 }}>
            {KIND_ICONS[item.kind] || ''}
          </span>
          <div style={{ overflow: 'hidden', flex: 1, minWidth: 0 }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8
            }}>
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {item.label}
              </span>
              <span style={{ marginLeft: 'auto', color: dimColor, fontSize: 10, flexShrink: 0 }}>
                {item.kind}
              </span>
            </div>
            {item.description && (
              <div style={{
                color: descColor,
                fontSize: 10,
                lineHeight: '14px',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                marginTop: 1
              }}>
                {item.description}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
