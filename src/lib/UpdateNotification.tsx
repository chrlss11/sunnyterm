/**
 * UpdateNotification — shows a banner when a new version is available.
 * Offers to download and install the update.
 */

import React, { useState, useEffect } from 'react'
import { Download, X, RefreshCw, Check } from 'lucide-react'

type UpdateState = 'idle' | 'available' | 'downloading' | 'ready'

export function UpdateNotification() {
  const [state, setState] = useState<UpdateState>('idle')
  const [version, setVersion] = useState<string>('')
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    const cleanupAvailable = window.electronAPI.onUpdaterAvailable((info) => {
      setVersion(info.version)
      setState('available')
    })

    const cleanupProgress = window.electronAPI.onUpdaterProgress((p) => {
      setProgress(p.percent)
    })

    const cleanupReady = window.electronAPI.onUpdaterReady(() => {
      setState('ready')
    })

    return () => {
      cleanupAvailable()
      cleanupProgress()
      cleanupReady()
    }
  }, [])

  if (state === 'idle') return null

  return (
    <div
      className="fixed top-12 right-4 z-[99999] flex items-center gap-3 px-4 py-2.5 rounded-lg shadow-xl text-xs"
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--primary)',
        color: 'var(--text-primary)',
        maxWidth: 340,
      }}
    >
      {state === 'available' && (
        <>
          <div className="flex-1">
            <div className="font-medium">Nueva version disponible</div>
            <div className="text-text-muted mt-0.5">SunnyTerm v{version}</div>
          </div>
          <button
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium cursor-pointer transition-colors"
            style={{ background: 'var(--primary)', color: '#000' }}
            onClick={() => {
              setState('downloading')
              window.electronAPI.updaterDownload()
            }}
          >
            <Download size={12} />
            Descargar
          </button>
          <button
            className="text-text-muted hover:text-text-primary cursor-pointer"
            onClick={() => setState('idle')}
          >
            <X size={14} />
          </button>
        </>
      )}

      {state === 'downloading' && (
        <>
          <RefreshCw size={14} className="animate-spin shrink-0" style={{ color: 'var(--primary)' }} />
          <div className="flex-1">
            <div className="font-medium">Descargando v{version}...</div>
            <div className="mt-1 h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--titlebar)' }}>
              <div
                className="h-full rounded-full transition-all duration-300"
                style={{ width: `${progress}%`, background: 'var(--primary)' }}
              />
            </div>
          </div>
          <span className="text-text-muted font-mono">{progress}%</span>
        </>
      )}

      {state === 'ready' && (
        <>
          <Check size={14} className="shrink-0 text-green-400" />
          <div className="flex-1">
            <div className="font-medium">v{version} lista para instalar</div>
            <div className="text-text-muted mt-0.5">Se reiniciara la aplicacion</div>
          </div>
          <button
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium cursor-pointer transition-colors bg-green-600 text-white hover:bg-green-500"
            onClick={() => window.electronAPI.updaterInstall()}
          >
            Instalar ahora
          </button>
          <button
            className="text-text-muted hover:text-text-primary cursor-pointer"
            onClick={() => setState('idle')}
          >
            <X size={14} />
          </button>
        </>
      )}
    </div>
  )
}
