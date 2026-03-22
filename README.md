# SunnyTerm Electron

An infinite canvas terminal emulator — Electron port of [SunnyTerm](../sunnyterm) (originally a Rust + WGPU app).

## What is this?

SunnyTerm is a terminal emulator where terminals live as tiles on an infinite, pannable, zoomable canvas. You can have dozens of terminals open simultaneously, arrange them spatially, link their outputs together, and quickly navigate with a minimap.

This Electron version replaces the custom WGPU GPU renderer with xterm.js + WebGL and wraps everything in React with a proper IPC bridge to node-pty.

## Stack

| Layer | Technology |
|-------|-----------|
| Shell | Electron 33 |
| Renderer | React 18 + TypeScript |
| Terminal | xterm.js 5 + WebGL addon |
| PTY | node-pty |
| State | Zustand 5 |
| Build | electron-vite 2 |
| Styling | Tailwind CSS 3 |
| Canvas | CSS `transform: translate scale` |

## Getting Started

```bash
cd sunnyterm-electron
npm install
npm start          # dev mode with hot reload
npm run build      # production build
```

Requires Node.js 20+ and macOS (primary target; Linux should work).

## Features

### Implemented (Phase 1 Scaffold)
- **Infinite canvas** — pan with Space+drag or scroll; zoom with Cmd+scroll
- **Terminal tiles** — full xterm-256color with WebGL rendering via xterm.js
- **Tile management** — create (double-click canvas or toolbar), move (drag title bar), resize (corner handle), close (× button)
- **Magnetic edge snapping** — tiles snap to each other's edges within 12px
- **Double-click rename** — rename any tile by double-clicking its title bar
- **Undo/redo** — move, resize, create, delete, and rename actions (50 action limit)
- **Minimap** — Cmd+M to toggle; SVG overview of all tiles; click to pan
- **Tile linking** — Cmd+L to link output of focused tile → click another tile to receive
- **Global search** — Cmd+F (xterm SearchAddon integration TODO)
- **Toolbar** — spawn terminals, HTTP clients, PostgreSQL clients; undo/redo buttons
- **macOS integration** — hidden title bar with traffic lights, vibrancy

### Planned (see MIGRATION_PLAN.md)
- Search within terminals (xterm SearchAddon)
- OSC title → tile rename
- Tile output linking (ANSI-stripped pipe)
- Workspace save/load (Cmd+1-9)
- State persistence (zoom/pan/layout on quit)
- HTTP client tile
- PostgreSQL client tile
- Pinch-to-zoom
- Light theme

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Cmd+T` | New terminal tile |
| `Cmd+H` | New HTTP client tile |
| `Cmd+D` | New PostgreSQL tile |
| `Cmd+W` | Close focused tile |
| `Cmd+Z` | Undo |
| `Cmd+Shift+Z` | Redo |
| `Cmd+M` | Toggle minimap |
| `Cmd+F` | Search |
| `Cmd+L` | Link tile output (click target to complete) |
| `Space+drag` | Pan canvas |
| `Cmd+scroll` | Zoom canvas |
| `Double-click (canvas)` | Spawn terminal at cursor |
| `Double-click (title bar)` | Rename tile |
| `Escape` | Cancel linking |

## Project Structure

```
sunnyterm-electron/
├── electron/
│   ├── main.ts          # Electron main process, IPC handlers, window creation
│   ├── preload.ts       # contextBridge — exposes window.electronAPI to renderer
│   └── pty.ts           # PtyManager — node-pty spawn, write, resize, kill
├── src/
│   ├── index.html       # Renderer entry HTML
│   ├── main.tsx         # React root
│   ├── App.tsx          # Root component + toolbar
│   ├── index.css        # Tailwind base + CSS variables
│   ├── types/
│   │   └── index.ts     # All shared TypeScript types + ElectronAPI interface
│   ├── store/
│   │   └── index.ts     # Zustand store (tiles, canvas, undo, minimap, search)
│   ├── canvas/
│   │   └── InfiniteCanvas.tsx  # Pan/zoom container, hit testing, drag orchestration
│   ├── tiles/
│   │   ├── TileContainer.tsx   # Title bar, resize handle, close, rename
│   │   ├── TerminalTile.tsx    # xterm.js terminal + node-pty IPC wiring
│   │   ├── HttpTile.tsx        # HTTP client (TODO)
│   │   └── PostgresTile.tsx    # PostgreSQL client (TODO)
│   ├── snap/
│   │   └── snap.ts      # Magnetic edge snapping algorithm (port of snap.rs)
│   ├── minimap/
│   │   └── Minimap.tsx  # SVG minimap overlay
│   ├── search/
│   │   └── SearchBar.tsx # Global search input
│   └── hooks/
│       └── useKeyboard.ts  # Global Cmd+* shortcuts
├── electron.vite.config.ts
├── tailwind.config.js
├── tsconfig.json
├── MIGRATION_PLAN.md    # Full Rust→TypeScript module mapping
└── README.md
```

## Architecture Decisions

### Why CSS transforms instead of a canvas element?
The Rust version used WGPU for everything, including the infinite canvas. In Electron, CSS `transform: translate scale` on a container div gives us:
- Hardware-accelerated compositing for free
- React component tree for UI (no custom hit testing for UI elements)
- xterm.js WebGL renders inside normal DOM, so it just works

The math is identical: `canvasCoord = (screenCoord - pan) / zoom`.

### Why Zustand instead of Redux?
Zustand has less boilerplate, supports selectors natively (preventing unnecessary re-renders), and works well with Immer-style mutations. The store shape mirrors the Rust `App` struct closely.

### Why electron-vite?
Fast dev mode HMR, proper ESM support for both main and renderer, and built-in support for `externalizeDepsPlugin` (native modules like node-pty stay in main process).

### IPC design
All PTY operations go through `contextBridge`:
```
Renderer → ipcRenderer.invoke('pty:spawn', ...) → Main → nodePty.spawn()
Main → webContents.send('pty:data:{id}', data) → Renderer listener
```

This keeps native code strictly in the main process and the renderer sandboxed.

## Migration Status

See [MIGRATION_PLAN.md](./MIGRATION_PLAN.md) for the full module-by-module mapping from Rust to TypeScript, phase roadmap, and implementation notes.
