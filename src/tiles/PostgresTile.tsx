import React, { useState, useCallback, useEffect, useRef } from 'react'
import type { PgQueryResult } from '../types'

// ─── Status badge ─────────────────────────────────────────────────────────────

type ConnStatus = 'disconnected' | 'connecting' | 'connected' | 'error'

const STATUS_COLORS: Record<ConnStatus, string> = {
  disconnected: 'bg-white/20 text-text-muted',
  connecting: 'bg-yellow-500/40 text-yellow-300',
  connected: 'bg-green-500/40 text-green-300',
  error: 'bg-red-500/40 text-red-300'
}

const STATUS_LABELS: Record<ConnStatus, string> = {
  disconnected: 'Disconnected',
  connecting: 'Connecting…',
  connected: 'Connected',
  error: 'Error'
}

// ─── Query history entry ──────────────────────────────────────────────────────

interface QueryHistoryEntry {
  sql: string
  timestamp: number
  ok: boolean
  rowCount?: number | null
  error?: string
}

const MAX_HISTORY = 10
const COL_MAX_CHARS = 40

// ─── Component ────────────────────────────────────────────────────────────────

export function PostgresTile({ tileId }: { tileId: string }) {
  const [connString, setConnString] = useState('postgresql://localhost:5432/postgres')
  const [status, setStatus] = useState<ConnStatus>('disconnected')
  const [statusMsg, setStatusMsg] = useState<string>('')
  const [sql, setSql] = useState('SELECT version();')
  const [queryHistory, setQueryHistory] = useState<QueryHistoryEntry[]>([])
  const [showHistory, setShowHistory] = useState(false)
  const [result, setResult] = useState<PgQueryResult | null>(null)
  const [running, setRunning] = useState(false)
  const sqlRef = useRef<HTMLTextAreaElement>(null)
  const connInputRef = useRef<HTMLInputElement>(null)

  // ── Connect ──────────────────────────────────────────────────────────────────
  const connect = useCallback(async () => {
    if (!connString.trim()) return
    setStatus('connecting')
    setStatusMsg('')
    const res = await window.electronAPI.pgConnect(tileId, connString.trim())
    if (res.ok) {
      setStatus('connected')
      setStatusMsg('')
      sqlRef.current?.focus()
    } else {
      setStatus('error')
      setStatusMsg(res.error ?? 'Connection failed')
    }
  }, [tileId, connString])

  // ── Disconnect ───────────────────────────────────────────────────────────────
  const disconnect = useCallback(async () => {
    await window.electronAPI.pgDisconnect(tileId)
    setStatus('disconnected')
    setResult(null)
  }, [tileId])

  // ── Cleanup on unmount ────────────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      window.electronAPI.pgDisconnect(tileId)
    }
  }, [tileId])

  // ── Run query ─────────────────────────────────────────────────────────────────
  const runQuery = useCallback(async () => {
    if (status !== 'connected' || !sql.trim() || running) return
    setRunning(true)
    setResult(null)

    const res = await window.electronAPI.pgQuery(tileId, sql.trim())
    setResult(res)
    setRunning(false)

    setQueryHistory((prev) => [
      {
        sql: sql.trim(),
        timestamp: Date.now(),
        ok: res.ok,
        rowCount: res.rowCount,
        error: res.error
      },
      ...prev
    ].slice(0, MAX_HISTORY))
  }, [tileId, sql, status, running])

  // ── Keyboard shortcut: Cmd+Enter to run ──────────────────────────────────────
  const handleSqlKeyDown = useCallback((e: React.KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault()
      runQuery()
    }
  }, [runQuery])

  const inputCls = 'bg-black/[0.04] dark:bg-white/[0.06] border border-border rounded px-2 py-1 text-xs text-text-primary outline-none focus:border-blue-500/60 transition-colors'

  return (
    <div className="flex flex-col h-full bg-surface text-text-primary font-mono text-xs select-none">

      {/* Connection bar */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border shrink-0">
        <span className={`shrink-0 px-2 py-0.5 rounded text-[10px] font-medium ${STATUS_COLORS[status]}`}>
          {STATUS_LABELS[status]}
        </span>

        <input
          ref={connInputRef}
          className={`${inputCls} flex-1 min-w-0`}
          placeholder="postgresql://user:pass@host:5432/db"
          value={connString}
          onChange={(e) => setConnString(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') connect() }}
          disabled={status === 'connecting' || status === 'connected'}
        />

        {status === 'connected' ? (
          <button
            className="px-3 py-1 rounded text-xs bg-red-600/40 hover:bg-red-500/60 text-red-300 transition-colors"
            onClick={disconnect}
          >
            Disconnect
          </button>
        ) : (
          <button
            className={`px-3 py-1 rounded text-xs transition-colors ${status === 'connecting' ? 'bg-yellow-600/30 text-yellow-300 cursor-not-allowed' : 'bg-green-600/40 hover:bg-green-500/60 text-green-300'}`}
            onClick={connect}
            disabled={status === 'connecting'}
          >
            {status === 'connecting' ? (
              <span className="flex items-center gap-1.5">
                <span className="inline-block w-2.5 h-2.5 border border-yellow-300/60 border-t-transparent rounded-full animate-spin" />
                Connecting
              </span>
            ) : 'Connect'}
          </button>
        )}
      </div>

      {/* Connection error */}
      {statusMsg && (
        <div className="px-3 py-1.5 bg-red-900/20 border-b border-red-500/20 text-red-300 shrink-0">
          {statusMsg}
        </div>
      )}

      {/* SQL editor */}
      <div className="flex flex-col border-b border-border shrink-0" style={{ height: 120 }}>
        <div className="flex items-center gap-2 px-3 py-1 border-b border-border">
          <span className="text-text-muted text-[10px]">SQL</span>
          <div className="ml-auto flex items-center gap-2">
            <button
              className={`px-2 py-0.5 rounded text-[10px] transition-colors ${showHistory ? 'bg-black/5 dark:bg-white/10 text-text-secondary' : 'text-text-muted hover:text-text-secondary'}`}
              onClick={() => setShowHistory((s) => !s)}
            >
              ⏱ History
            </button>
            <button
              className={`px-3 py-0.5 rounded text-[10px] font-medium transition-colors ${
                status !== 'connected' || running
                  ? 'bg-black/5 dark:bg-white/10 text-text-muted cursor-not-allowed'
                  : 'bg-blue-600 hover:bg-blue-500 text-white'
              }`}
              onClick={runQuery}
              disabled={status !== 'connected' || running}
              title="Run query (⌘+Enter)"
            >
              {running ? (
                <span className="flex items-center gap-1">
                  <span className="inline-block w-2 h-2 border border-text-muted/40 border-t-transparent rounded-full animate-spin" />
                  Running
                </span>
              ) : '▶ Run'}
            </button>
          </div>
        </div>
        <textarea
          ref={sqlRef}
          className="flex-1 min-h-0 bg-transparent text-text-primary text-xs p-2 outline-none resize-none"
          placeholder={status === 'connected' ? 'SELECT * FROM table; (⌘+Enter to run)' : 'Connect to a database first'}
          value={sql}
          onChange={(e) => setSql(e.target.value)}
          onKeyDown={handleSqlKeyDown}
          disabled={status !== 'connected'}
          spellCheck={false}
        />
      </div>

      {/* History panel */}
      {showHistory && queryHistory.length > 0 && (
        <div className="shrink-0 border-b border-border bg-white/[0.03] max-h-32 overflow-y-auto">
          {queryHistory.map((entry, i) => (
            <div
              key={i}
              className="flex items-start gap-2 px-3 py-1.5 hover:bg-black/5 dark:bg-white/5 cursor-pointer"
              onClick={() => {
                setSql(entry.sql)
                setShowHistory(false)
              }}
            >
              <span className={`shrink-0 ${entry.ok ? 'text-green-400' : 'text-red-400'}`}>
                {entry.ok ? '✓' : '✗'}
              </span>
              <span className="flex-1 truncate text-text-muted">{entry.sql}</span>
              {entry.ok && entry.rowCount != null && (
                <span className="shrink-0 text-text-muted">{entry.rowCount} rows</span>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Results */}
      <div className="flex-1 min-h-0 overflow-auto">
        {running && (
          <div className="flex items-center justify-center h-full gap-2 text-text-muted">
            <span className="inline-block w-4 h-4 border border-text-muted/30 border-t-text-muted rounded-full animate-spin" />
            Running query…
          </div>
        )}
        {!running && !result && (
          <div className="flex items-center justify-center h-full text-text-muted">
            {status === 'connected' ? 'Run a query to see results' : 'Connect to a database'}
          </div>
        )}
        {!running && result && (
          <>
            {/* Error */}
            {!result.ok && (
              <div className="p-3">
                <div className="text-red-400 bg-red-900/20 border border-red-500/20 rounded p-2 whitespace-pre-wrap">
                  {result.error}
                  {result.elapsed != null && (
                    <span className="block mt-1 text-text-muted text-[10px]">{result.elapsed}ms</span>
                  )}
                </div>
              </div>
            )}

            {/* Results info bar */}
            {result.ok && (
              <div className="flex items-center gap-3 px-3 py-1.5 border-b border-border text-text-muted text-[10px] shrink-0">
                <span className="text-green-400">✓</span>
                {result.rowCount != null && <span>{result.rowCount} row{result.rowCount !== 1 ? 's' : ''}</span>}
                {result.elapsed != null && <span>{result.elapsed}ms</span>}
              </div>
            )}

            {/* Table */}
            {result.ok && result.fields && result.rows && result.rows.length > 0 && (
              <ResultTable fields={result.fields} rows={result.rows} />
            )}

            {/* No rows */}
            {result.ok && (result.rows == null || result.rows.length === 0) && (
              <div className="flex items-center justify-center py-8 text-text-muted">
                Query returned no rows
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

// ─── Result table ─────────────────────────────────────────────────────────────

function ResultTable({ fields, rows }: { fields: string[]; rows: Record<string, unknown>[] }) {
  const cellValue = (v: unknown): string => {
    if (v === null || v === undefined) return 'NULL'
    if (typeof v === 'object') return JSON.stringify(v)
    return String(v)
  }

  const truncate = (s: string) =>
    s.length > COL_MAX_CHARS ? s.slice(0, COL_MAX_CHARS) + '…' : s

  return (
    <div className="overflow-auto">
      <table className="w-full text-xs border-collapse">
        <thead className="sticky top-0 bg-surface">
          <tr>
            <th className="px-2 py-1.5 text-right text-text-muted font-normal border-b border-border select-none w-10">#</th>
            {fields.map((f) => (
              <th
                key={f}
                className="px-2 py-1.5 text-left text-orange-300/80 font-medium border-b border-border whitespace-nowrap"
              >
                {f}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr
              key={i}
              className={i % 2 === 0 ? 'bg-transparent' : 'bg-white/[0.02]'}
            >
              <td className="px-2 py-1 text-right text-text-muted border-r border-border">{i + 1}</td>
              {fields.map((f) => {
                const raw = cellValue(row[f])
                const isNull = row[f] === null || row[f] === undefined
                return (
                  <td
                    key={f}
                    className={`px-2 py-1 border-b border-border whitespace-nowrap max-w-[200px] overflow-hidden text-ellipsis ${
                      isNull ? 'text-text-muted italic' : 'text-text-secondary'
                    }`}
                    title={raw.length > COL_MAX_CHARS ? raw : undefined}
                  >
                    {truncate(raw)}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
