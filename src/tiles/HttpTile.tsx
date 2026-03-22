import React, { useState, useCallback, useRef, useEffect } from 'react'
import type { HttpResponse, HttpRequestEntry } from '../types'

// ─── Constants ────────────────────────────────────────────────────────────────

const METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] as const
type Method = (typeof METHODS)[number]

const METHOD_COLORS: Record<Method, string> = {
  GET: 'text-green-400',
  POST: 'text-blue-400',
  PUT: 'text-yellow-400',
  PATCH: 'text-orange-400',
  DELETE: 'text-red-400'
}

const MAX_HISTORY = 10

// ─── Header row type ──────────────────────────────────────────────────────────

interface HeaderRow {
  id: string
  key: string
  value: string
  enabled: boolean
}

// ─── JSON tree renderer ───────────────────────────────────────────────────────

function JsonNode({ value, depth = 0 }: { value: unknown; depth?: number }) {
  const [collapsed, setCollapsed] = useState(depth > 2)

  if (value === null) return <span className="text-gray-400">null</span>
  if (typeof value === 'boolean') return <span className="text-purple-400">{String(value)}</span>
  if (typeof value === 'number') return <span className="text-blue-300">{value}</span>
  if (typeof value === 'string') return <span className="text-green-300">"{value}"</span>

  if (Array.isArray(value)) {
    if (value.length === 0) return <span className="text-text-muted">[]</span>
    return (
      <span>
        <button
          className="text-yellow-400 hover:text-yellow-200 text-xs font-mono mr-1"
          onClick={() => setCollapsed((c) => !c)}
        >
          {collapsed ? '▶' : '▼'}
        </button>
        <span className="text-text-muted">[{value.length}]</span>
        {!collapsed && (
          <div className="ml-4 border-l border-border pl-2">
            {value.map((item, i) => (
              <div key={i} className="my-0.5">
                <span className="text-text-muted text-xs">{i}: </span>
                <JsonNode value={item} depth={depth + 1} />
              </div>
            ))}
          </div>
        )}
      </span>
    )
  }

  if (typeof value === 'object') {
    const keys = Object.keys(value as object)
    if (keys.length === 0) return <span className="text-text-muted">{'{}'}</span>
    return (
      <span>
        <button
          className="text-yellow-400 hover:text-yellow-200 text-xs font-mono mr-1"
          onClick={() => setCollapsed((c) => !c)}
        >
          {collapsed ? '▶' : '▼'}
        </button>
        <span className="text-text-muted">{`{${keys.length}}`}</span>
        {!collapsed && (
          <div className="ml-4 border-l border-border pl-2">
            {keys.map((k) => (
              <div key={k} className="my-0.5">
                <span className="text-orange-300 text-xs">"{k}"</span>
                <span className="text-text-muted mx-1">:</span>
                <JsonNode value={(value as Record<string, unknown>)[k]} depth={depth + 1} />
              </div>
            ))}
          </div>
        )}
      </span>
    )
  }

  return <span className="text-text-secondary">{String(value)}</span>
}

// ─── Main component ───────────────────────────────────────────────────────────

export function HttpTile({ tileId }: { tileId: string }) {
  const [method, setMethod] = useState<Method>('GET')
  const [url, setUrl] = useState('')
  const [headers, setHeaders] = useState<HeaderRow[]>([
    { id: 'h0', key: 'Content-Type', value: 'application/json', enabled: false }
  ])
  const [body, setBody] = useState('')
  const [activeTab, setActiveTab] = useState<'headers' | 'body'>('headers')
  const [responseTab, setResponseTab] = useState<'pretty' | 'raw' | 'headers'>('pretty')
  const [loading, setLoading] = useState(false)
  const [response, setResponse] = useState<HttpResponse | null>(null)
  const [history, setHistory] = useState<HttpRequestEntry[]>([])
  const [showHistory, setShowHistory] = useState(false)
  const urlInputRef = useRef<HTMLInputElement>(null)
  const abortRef = useRef<boolean>(false)

  // ── focus url on mount ──────────────────────────────────────────────────────
  useEffect(() => {
    urlInputRef.current?.focus()
  }, [tileId])

  // ── header helpers ──────────────────────────────────────────────────────────
  const addHeader = useCallback(() => {
    setHeaders((h) => [...h, { id: `h${Date.now()}`, key: '', value: '', enabled: true }])
  }, [])

  const removeHeader = useCallback((id: string) => {
    setHeaders((h) => h.filter((r) => r.id !== id))
  }, [])

  const updateHeader = useCallback((id: string, field: 'key' | 'value' | 'enabled', val: string | boolean) => {
    setHeaders((h) => h.map((r) => r.id === id ? { ...r, [field]: val } : r))
  }, [])

  // ── send request ────────────────────────────────────────────────────────────
  const sendRequest = useCallback(async () => {
    if (!url.trim() || loading) return
    abortRef.current = false
    setLoading(true)
    setResponse(null)

    const reqHeaders: Record<string, string> = {}
    headers.filter((h) => h.enabled && h.key.trim()).forEach((h) => {
      reqHeaders[h.key.trim()] = h.value
    })

    const hasBody = method !== 'GET' && method !== 'DELETE' && body.trim()

    try {
      const result = await window.electronAPI.httpRequest({
        method,
        url: url.trim(),
        headers: reqHeaders,
        body: hasBody ? body : null
      })
      if (!abortRef.current) {
        setResponse(result)
        // Add to history
        const entry: HttpRequestEntry = {
          method,
          url: url.trim(),
          headers: headers.filter((h) => h.enabled && h.key.trim()),
          body,
          timestamp: Date.now(),
          response: result
        }
        setHistory((prev) => [entry, ...prev].slice(0, MAX_HISTORY))
      }
    } finally {
      if (!abortRef.current) setLoading(false)
    }
  }, [url, method, headers, body, loading])

  // ── keyboard shortcut: Enter in URL bar ─────────────────────────────────────
  const handleUrlKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') sendRequest()
  }, [sendRequest])

  // ── parse response body ──────────────────────────────────────────────────────
  let parsedJson: unknown = null
  let isJson = false
  if (response?.body) {
    const ct = response.headers?.['content-type'] ?? ''
    if (ct.includes('json') || response.body.trimStart().startsWith('{') || response.body.trimStart().startsWith('[')) {
      try {
        parsedJson = JSON.parse(response.body)
        isJson = true
      } catch { /* not JSON */ }
    }
  }

  // ── status color ─────────────────────────────────────────────────────────────
  const statusColor = (s?: number) => {
    if (!s) return 'text-text-muted'
    if (s < 200) return 'text-blue-400'
    if (s < 300) return 'text-green-400'
    if (s < 400) return 'text-yellow-400'
    return 'text-red-400'
  }

  const inputCls = 'bg-black/[0.04] dark:bg-white/[0.06] border border-border rounded px-2 py-1 text-xs text-text-primary outline-none focus:border-blue-500/60 transition-colors'
  const tabCls = (active: boolean) => `px-3 py-1 text-xs cursor-pointer transition-colors ${active ? 'text-white border-b border-blue-400' : 'text-text-muted hover:text-text-secondary'}`

  return (
    <div className="flex flex-col h-full bg-surface text-white font-mono text-xs select-none">

      {/* URL bar */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border shrink-0">
        <select
          className={`${inputCls} ${METHOD_COLORS[method]} font-bold bg-surface cursor-pointer`}
          value={method}
          onChange={(e) => setMethod(e.target.value as Method)}
        >
          {METHODS.map((m) => (
            <option key={m} value={m} className={`text-white bg-surface`}>{m}</option>
          ))}
        </select>

        <input
          ref={urlInputRef}
          className={`${inputCls} flex-1 min-w-0`}
          placeholder="https://api.example.com/endpoint"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={handleUrlKeyDown}
        />

        <button
          className={`px-3 py-1 rounded text-xs font-medium transition-colors ${loading ? 'bg-yellow-600/40 text-yellow-300 cursor-not-allowed' : 'bg-blue-600/60 hover:bg-blue-500/70 text-white'}`}
          onClick={sendRequest}
          disabled={loading}
        >
          {loading ? (
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-2.5 h-2.5 border border-yellow-300/60 border-t-transparent rounded-full animate-spin" />
              Sending
            </span>
          ) : 'Send'}
        </button>

        <button
          className={`px-2 py-1 rounded text-xs transition-colors ${showHistory ? 'text-white bg-black/5 dark:bg-white/10' : 'text-text-muted hover:text-text-secondary'}`}
          onClick={() => setShowHistory((s) => !s)}
          title="Request history"
        >
          ⏱
        </button>
      </div>

      {/* History panel */}
      {showHistory && history.length > 0 && (
        <div className="shrink-0 border-b border-border bg-white/[0.03] max-h-40 overflow-y-auto">
          {history.map((entry, i) => (
            <div
              key={i}
              className="flex items-center gap-2 px-3 py-1.5 hover:bg-black/5 dark:bg-white/5 cursor-pointer"
              onClick={() => {
                setMethod(entry.method as Method)
                setUrl(entry.url)
                setShowHistory(false)
              }}
            >
              <span className={`font-bold w-14 shrink-0 ${METHOD_COLORS[entry.method as Method] ?? 'text-white/60'}`}>
                {entry.method}
              </span>
              <span className="flex-1 truncate text-white/60">{entry.url}</span>
              {entry.response?.status && (
                <span className={`shrink-0 ${statusColor(entry.response.status)}`}>
                  {entry.response.status}
                </span>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Request config pane */}
      <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
        <div className="flex items-center gap-0 px-3 border-b border-border shrink-0">
          <button className={tabCls(activeTab === 'headers')} onClick={() => setActiveTab('headers')}>
            Headers {headers.filter((h) => h.enabled && h.key.trim()).length > 0
              ? <span className="ml-1 bg-blue-600/40 text-blue-300 rounded-full px-1">{headers.filter((h) => h.enabled && h.key.trim()).length}</span>
              : null}
          </button>
          <button className={tabCls(activeTab === 'body')} onClick={() => setActiveTab('body')}>
            Body {body.trim() && <span className="ml-1 text-orange-400">•</span>}
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-hidden">
          {activeTab === 'headers' ? (
            <div className="h-full flex flex-col p-2 gap-1 overflow-y-auto">
              {headers.map((row) => (
                <div key={row.id} className="flex items-center gap-1.5">
                  <input
                    type="checkbox"
                    checked={row.enabled}
                    onChange={(e) => updateHeader(row.id, 'enabled', e.target.checked)}
                    className="accent-blue-500 shrink-0"
                  />
                  <input
                    className={`${inputCls} flex-1 min-w-0`}
                    placeholder="Header name"
                    value={row.key}
                    onChange={(e) => updateHeader(row.id, 'key', e.target.value)}
                  />
                  <input
                    className={`${inputCls} flex-1 min-w-0`}
                    placeholder="Value"
                    value={row.value}
                    onChange={(e) => updateHeader(row.id, 'value', e.target.value)}
                  />
                  <button
                    className="text-text-muted hover:text-red-400 transition-colors shrink-0 w-5 text-center"
                    onClick={() => removeHeader(row.id)}
                  >
                    ×
                  </button>
                </div>
              ))}
              <button
                className="mt-1 text-blue-400/70 hover:text-blue-300 text-xs self-start"
                onClick={addHeader}
              >
                + Add Header
              </button>
            </div>
          ) : (
            <textarea
              className="w-full h-full bg-transparent text-text-primary text-xs p-2 outline-none resize-none font-mono"
              placeholder="Request body (JSON, form data, etc.)"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              spellCheck={false}
            />
          )}
        </div>
      </div>

      {/* Divider */}
      <div className="shrink-0 h-px bg-black/5 dark:bg-white/10" />

      {/* Response panel */}
      <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
        {/* Response header */}
        <div className="flex items-center gap-3 px-3 py-1.5 border-b border-border shrink-0">
          {response ? (
            <>
              {response.ok ? (
                <span className={`font-bold ${statusColor(response.status)}`}>
                  {response.status} {response.statusText}
                </span>
              ) : (
                <span className="text-red-400 font-bold">Error</span>
              )}
              {response.elapsed !== undefined && (
                <span className="text-text-muted">{response.elapsed}ms</span>
              )}
              {response.body && (
                <span className="text-text-muted">{formatBytes(response.body.length)}</span>
              )}
              <div className="ml-auto flex gap-0">
                <button className={tabCls(responseTab === 'pretty')} onClick={() => setResponseTab('pretty')}>
                  Pretty
                </button>
                <button className={tabCls(responseTab === 'raw')} onClick={() => setResponseTab('raw')}>
                  Raw
                </button>
                <button className={tabCls(responseTab === 'headers')} onClick={() => setResponseTab('headers')}>
                  Headers
                </button>
              </div>
            </>
          ) : (
            <span className="text-text-muted">Response</span>
          )}
        </div>

        <div className="flex-1 min-h-0 overflow-auto p-2">
          {loading && (
            <div className="flex items-center justify-center h-full text-text-muted gap-2">
              <span className="inline-block w-4 h-4 border border-white/30 border-t-white/80 rounded-full animate-spin" />
              Sending request…
            </div>
          )}
          {!loading && !response && (
            <div className="flex items-center justify-center h-full text-text-muted">
              Press Send to make a request
            </div>
          )}
          {!loading && response && (
            <>
              {response.error && (
                <div className="text-red-400 bg-red-900/20 border border-red-500/20 rounded p-2">
                  {response.error}
                </div>
              )}
              {!response.error && responseTab === 'pretty' && (
                <div className="text-xs leading-relaxed">
                  {isJson && parsedJson !== null ? (
                    <JsonNode value={parsedJson} />
                  ) : (
                    <pre className="text-text-secondary whitespace-pre-wrap break-all">{response.body}</pre>
                  )}
                </div>
              )}
              {!response.error && responseTab === 'raw' && (
                <pre className="text-text-secondary text-xs whitespace-pre-wrap break-all">{response.body}</pre>
              )}
              {!response.error && responseTab === 'headers' && (
                <div className="space-y-1">
                  {Object.entries(response.headers ?? {}).map(([k, v]) => (
                    <div key={k} className="flex gap-2">
                      <span className="text-orange-300 shrink-0">{k}:</span>
                      <span className="text-white/60 break-all">{v}</span>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / 1024 / 1024).toFixed(1)} MB`
}
