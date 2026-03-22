# SunnyTerm → Electron Migration Plan

This document maps every module in the original Rust codebase (`~/works/sunnyterm/src/`)
to its TypeScript/Electron equivalent. Status: 🟢 Done · 🟡 Scaffold · 🔴 TODO

---

## Table of Contents
1. [Architecture Overview](#architecture-overview)
2. [Module Map](#module-map)
3. [Feature Checklist](#feature-checklist)
4. [Implementation Notes](#implementation-notes)
5. [Phase Roadmap](#phase-roadmap)

---

## Architecture Overview

### Rust (original)
```
winit event loop → App struct → GPU renderer (WGPU)
                              → PTY threads
                              → VTE parser
```

### Electron (this project)
```
Electron main process  ←IPC→  Renderer (React + Zustand)
  └─ node-pty                   └─ xterm.js (WebGL)
  └─ PTY IPC handlers           └─ InfiniteCanvas (CSS transforms)
                                 └─ Zustand store (global state)
```

**Key differences:**
| Aspect | Rust | Electron |
|--------|------|----------|
| Rendering | WGPU (custom GPU pipeline) | xterm.js WebGL + CSS |
| Terminal emulation | Custom VTE parser + Grid | xterm.js (battle-tested) |
| PTY | `portable_pty` crate | `node-pty` |
| UI framework | Custom immediate-mode via WGPU | React + Tailwind |
| State | Struct fields + Rc/Cell | Zustand |
| Canvas | Custom orthographic projection | CSS `transform: translate scale` |
| Undo | Custom `UndoStack` | Zustand actions |
| Persistence | `serde_json` to `~/.sunnyterm/` | `electron-store` to userData |

---

## Module Map

### Main Entry

| Rust | TypeScript | Status | Notes |
|------|-----------|--------|-------|
| `main.rs` — winit event loop, window creation | `electron/main.ts` | 🟢 | `BrowserWindow` replaces winit |
| `app.rs` — App struct (2431 lines) | `src/App.tsx` + `src/store/index.ts` + `src/hooks/useKeyboard.ts` | 🟡 | Split across React component, Zustand store, keyboard hook |
| `platform.rs` — macOS titlebar | `electron/main.ts` (`titleBarStyle: 'hiddenInset'`) | 🟢 | |

---

### Terminal Emulation

| Rust | TypeScript | Status | Notes |
|------|-----------|--------|-------|
| `terminal/grid.rs` — Grid struct, scrollback, VecDeque | **xterm.js** (built-in buffer + scrollback) | 🟢 | No manual port needed — xterm handles this |
| `terminal/cell.rs` — Cell, CellAttrs, CellColor | **xterm.js** (IBufferCell, ITheme) | 🟢 | xterm handles all cell attributes |
| `terminal/parser.rs` — VTE ANSI parser | **xterm.js** (built-in full ANSI parser) | 🟢 | xterm supports all sequences including OSC, SGR, mouse |
| `terminal/pty.rs` — PTY spawn, resize, CWD detection | `electron/pty.ts` (PtyManager) | 🟢 | `node-pty` replaces `portable_pty` |
| `terminal/scroll.rs` — Scrollback buffer management | xterm.js `terminal.scrollback` | 🟢 | |

**Mouse reporting modes** (1000/1002/1003/1006):
xterm.js supports all modes natively. No manual encoding needed.

**Bracketed paste** (mode 2004):
xterm.js handles bracketed paste automatically.

**OSC sequences** (window title):
xterm.js fires `terminal.onTitleChange(cb)` — wire to tile rename.

---

### Canvas / Infinite Canvas

| Rust | TypeScript | Status | Notes |
|------|-----------|--------|-------|
| `ui/canvas.rs` — Tile struct, layout, hit testing, z-order, drag/resize | `src/canvas/InfiniteCanvas.tsx` + `src/store/index.ts` | 🟡 | CSS transform replaces WGPU orthographic projection |
| `ui/snap.rs` — Magnetic edge snapping (12px threshold) | `src/snap/snap.ts` | 🟢 | Direct port of algorithm |
| `ui/minimap.rs` — Minimap overlay, click-to-pan | `src/minimap/Minimap.tsx` | 🟡 | SVG-based instead of WGPU quads |
| Canvas pan/zoom | `src/store/index.ts` (`zoomAt`, `panBy`) | 🟢 | |
| Tile drag + move | `src/store/index.ts` (`startDrag`, `updateDrag`, `endDrag`) | 🟢 | |
| Tile resize | `src/store/index.ts` (resize branch in `updateDrag`) | 🟢 | |
| Focus / z-order | `src/store/index.ts` (`focusTile`, `nextZIndex`) | 🟢 | |
| Double-click to spawn | `src/canvas/InfiniteCanvas.tsx` (double-click handler) | 🟢 | |
| Double-click to rename | `src/tiles/TileContainer.tsx` | 🟢 | |
| Close button | `src/tiles/TileContainer.tsx` | 🟢 | |
| Dot grid background | `src/canvas/InfiniteCanvas.tsx` (SVG `<pattern>`) | 🟢 | |

**What's missing from canvas:**
- Pinch-to-zoom (touch events) — TODO
- Grid snap (24px) alongside magnetic snap — TODO
- Smooth zoom animation — TODO

---

### Pane Types

#### Terminal Tile (`pane.rs`)

| Rust | TypeScript | Status | Notes |
|------|-----------|--------|-------|
| `Pane` struct + PTY wiring | `src/tiles/TerminalTile.tsx` | 🟡 | xterm.js + node-pty via IPC |
| Buffer mode (input collected before submit) | 🔴 TODO | | Rust had a custom input buffer. xterm.js sends direct input — may need IPC layer |
| Passthrough mode (foreground job detection) | 🔴 TODO | | `node-pty` can detect, needs IPC |
| Command history (↑/↓) | xterm.js shell handles this | 🟢 | Shell maintains its own history |
| Tab completion | 🔴 TODO | | Shell handles basics; custom completion needs work |
| Search (`Cmd+F` in tile) | 🔴 TODO | | Use `@xterm/addon-search` |
| OSC title → tile rename | 🔴 TODO | | `terminal.onTitleChange` hook needed |
| Tile linking (pipe output) | 🔴 TODO | | Strip ANSI, forward via IPC |
| Scrollback 10,000 lines | `scrollback: 10000` in Terminal opts | 🟢 | |
| 256-color + truecolor | xterm.js + `COLORTERM=truecolor` env | 🟢 | |

#### HTTP Pane (`http_pane.rs` — 1152 lines)

| Rust Feature | TypeScript Equivalent | Status |
|-------------|----------------------|--------|
| Method selector (GET/POST/etc.) | React `<select>` or button group | 🔴 TODO |
| URL editor | `<input>` | 🔴 TODO |
| Header list (add/edit/delete) | `src/tiles/HttpTile.tsx` | 🔴 TODO |
| Body editor | `<textarea>` or Monaco editor | 🔴 TODO |
| Async HTTP execution | `fetch()` API (renderer process) | 🔴 TODO |
| Response viewer (Raw / JSON Tree) | `src/tiles/HttpTile.tsx` | 🔴 TODO |
| JSON tree collapse/expand | Recursive React component | 🔴 TODO |
| Search in response (`Cmd+F`) | String search + highlight | 🔴 TODO |
| Toast notifications | `react-hot-toast` or custom | 🔴 TODO |
| Round-trip time display | `Date.now()` delta | 🔴 TODO |

#### PostgreSQL Pane (`postgres_pane.rs`)

| Rust Feature | TypeScript Equivalent | Status |
|-------------|----------------------|--------|
| Connection string editor | `<input>` | 🔴 TODO |
| SQL query editor | Monaco editor (`@monaco-editor/react`) | 🔴 TODO |
| Async query execution | `pg` npm package (main process IPC) | 🔴 TODO |
| Result table (horizontal + vertical scroll) | React table with virtualization | 🔴 TODO |
| Column width capped at 40 chars | Table column sizing | 🔴 TODO |
| Status badge (Connecting/Connected/Error) | Colored `<span>` | 🔴 TODO |

---

### Undo / Redo

| Rust | TypeScript | Status |
|------|-----------|--------|
| `undo.rs` — `CanvasAction` enum | `src/types/index.ts` (`CanvasAction`) | 🟢 |
| `UndoStack` (50 action limit, index-based) | `src/store/index.ts` (`undoStack`, `redoStack`) | 🟢 |
| `MoveTile` action | `type: 'move'` | 🟢 |
| `ResizeTile` action | `type: 'resize'` | 🟢 |
| `CreateTile` action | `type: 'create'` | 🟢 |
| `DeleteTile` action | `type: 'delete'` | 🟢 |
| `RenameTile` action | `type: 'rename'` | 🟢 |

---

### Workspace Persistence

| Rust | TypeScript | Status | Notes |
|------|-----------|--------|-------|
| `workspace.rs` — save/load JSON to `~/.sunnyterm/workspaces/` | `src/workspace/workspace.ts` | 🔴 TODO | Use `electron-store` |
| `state.rs` — persist zoom/pan/tiles to `~/.sunnyterm/state.json` | `src/lib/persistence.ts` | 🔴 TODO | Use `electron-store` |
| `Cmd+1-9` to switch workspaces | Keyboard hook | 🔴 TODO | |
| Sanitize workspace name (special chars → `_`) | String replace | 🔴 TODO | |

**Recommended library:** `electron-store` — typed, atomic JSON persistence.

---

### Input Handling

| Rust | TypeScript | Status |
|------|-----------|--------|
| `input/keyboard.rs` — routing by pane type | `src/hooks/useKeyboard.ts` | 🟡 |
| `input/history.rs` — command history | Shell native (no port needed) | 🟢 |
| `input/completion.rs` — tab completion | Shell native (no port needed) | 🟢 |
| `Cmd+Q` — quit | `window.close()` | 🔴 TODO |
| `Cmd+T/H/D` — spawn tiles | `src/hooks/useKeyboard.ts` | 🟢 |
| `Cmd+W` — close focused | `src/hooks/useKeyboard.ts` | 🟢 |
| `Cmd+Z/Shift+Z` — undo/redo | `src/hooks/useKeyboard.ts` | 🟢 |
| `Cmd+M` — minimap toggle | `src/hooks/useKeyboard.ts` | 🟢 |
| `Cmd+F` — search | `src/hooks/useKeyboard.ts` | 🟢 |
| `Cmd+L` — start linking | `src/hooks/useKeyboard.ts` | 🟢 |
| Space+drag — pan canvas | `src/canvas/InfiniteCanvas.tsx` | 🟢 |
| Cmd+scroll — zoom | `src/canvas/InfiniteCanvas.tsx` | 🟢 |
| Scroll in tile — scrollback | xterm.js native | 🟢 |

---

### Rendering

The Rust GPU pipeline is entirely replaced by browser rendering:

| Rust (WGPU) | Electron Browser | Notes |
|-------------|-----------------|-------|
| `renderer/gpu.rs` — WGPU device/surface | Chromium GPU compositor | Automatic |
| `renderer/atlas.rs` — Glyph atlas | xterm.js WebGL addon | |
| `renderer/text.rs` — GPU text rendering | xterm.js `@xterm/addon-webgl` | |
| `renderer/cursor.rs` — Cursor blink | xterm.js native cursor | |
| `renderer/tile_renderer.rs` — Terminal tile | `src/tiles/TerminalTile.tsx` | xterm.js |
| `renderer/http_tile_renderer.rs` | `src/tiles/HttpTile.tsx` | React |
| `renderer/postgres_tile_renderer.rs` | `src/tiles/PostgresTile.tsx` | React |
| `renderer/grid_renderer.rs` — Dot grid | SVG `<pattern>` in canvas | |
| `renderer/ui_renderer.rs` — Buttons, minimap | React + Tailwind | |
| `renderer/frame.rs` — Render coordination | React reconciler | |
| `renderer/draw_helpers.rs` | CSS / SVG | |

---

### Tile Linking

| Rust | TypeScript | Status |
|------|-----------|--------|
| `output_link: Option<usize>` in Tile | `outputLink: string \| null` in Tile | 🟢 |
| `Cmd+L` to start, right-click target | `src/hooks/useKeyboard.ts` + canvas click | 🟡 |
| Strip ANSI from forwarded output | `src/lib/stripAnsi.ts` (TODO) | 🔴 TODO |
| IPC forwarding of output | `electron/pty.ts` (route `onData` to linked tile) | 🔴 TODO |

**ANSI stripping regex:**
```typescript
const ANSI_REGEX = /\x1b\[[0-9;]*[a-zA-Z]|\x1b\][^\x07]*[\x07\x1b\\]|\x1b[^[\]]/g
export const stripAnsi = (s: string) => s.replace(ANSI_REGEX, '')
```

---

### Theme

| Rust | TypeScript | Status |
|------|-----------|--------|
| `ui/theme.rs` — dark/light color tables | `src/index.css` CSS variables + xterm theme | 🟡 |
| `ui/palette.rs` — 16-color ANSI palette | xterm.js `ITheme` | 🟢 |
| `ui/canvas_theme.rs` — canvas background | CSS `--color-canvas` var | 🟢 |
| Dark/light toggle | `src/store/index.ts` (`isDark`, `toggleDark`) | 🟡 |

---

## Feature Checklist

### Phase 1 — Core Scaffold (DONE)
- [x] Electron window with hidden title bar
- [x] React + TypeScript + Tailwind CSS
- [x] Infinite canvas with pan (Space+drag, scroll) and zoom (Cmd+scroll)
- [x] Tile system (create, move, resize, close, z-order)
- [x] Magnetic edge snapping (`src/snap/snap.ts`)
- [x] Double-click canvas to spawn terminal
- [x] Drag from title bar, resize from corner
- [x] Inline tile rename (double-click title bar)
- [x] Undo/redo (move, resize, create, delete, rename)
- [x] Minimap (SVG-based, click-to-pan)
- [x] Global keyboard shortcuts
- [x] Tile linking state (Cmd+L)
- [x] Search bar scaffold (Cmd+F)
- [x] Working terminal tiles (xterm.js + node-pty via IPC)
- [x] Proper Electron IPC separation (main ↔ renderer)
- [x] HTTP and PostgreSQL tile placeholders

### Phase 2 — Terminal Polish
- [ ] xterm.js SearchAddon wired to Cmd+F
- [ ] OSC title change → tile rename
- [ ] Tile output linking (strip ANSI, route via IPC)
- [ ] Foreground process detection → passthrough input mode indicator
- [ ] CWD display in title bar
- [ ] Pinch-to-zoom (touch/trackpad gesture)
- [ ] Fit terminal on tile resize (debounced)

### Phase 3 — Workspaces + Persistence
- [ ] `electron-store` for state persistence (zoom, pan, tile layout)
- [ ] Workspace save/load as named JSON files
- [ ] Cmd+1-9 to switch workspaces
- [ ] Workspace list UI (toolbar dropdown or sidebar)
- [ ] Auto-save state on quit

### Phase 4 — HTTP Pane
- [ ] Method selector (color-coded)
- [ ] URL input
- [ ] Header list (add/edit/remove rows)
- [ ] Body editor (textarea)
- [ ] Execute request with `fetch()`
- [ ] Response: raw view with syntax highlight
- [ ] Response: JSON tree with collapse/expand
- [ ] Round-trip time display
- [ ] Search in response (Cmd+F)
- [ ] Toast notifications

### Phase 5 — PostgreSQL Pane
- [ ] Connection string input
- [ ] SQL editor (Monaco editor)
- [ ] Connect / disconnect lifecycle
- [ ] Query execution via `pg` (main process IPC)
- [ ] Results table with scroll
- [ ] Column width auto-sizing
- [ ] Status badge (color-coded)
- [ ] Error display

### Phase 6 — Polish
- [ ] Smooth zoom animation
- [ ] Grid snap (24px) alongside magnetic snap
- [ ] Light theme
- [ ] Tile kind icons in title bar
- [ ] Context menu (right-click tile)
- [ ] Link visualisation lines on canvas
- [ ] Scrollback search highlights
- [ ] Window quit confirmation when PTYs are running

---

## Implementation Notes

### Canvas Coordinate System
Rust used an orthographic WGPU projection. In Electron we use CSS transforms:

```
screen coords → canvas coords via:
  canvasX = (screenX - panX) / zoom
  canvasY = (screenY - panY) / zoom
```

The `transform: translate(panX px, panY px) scale(zoom)` on the canvas div with
`transformOrigin: '0 0'` gives identical math.

### PTY IPC Pattern
```
Renderer:  window.electronAPI.ptySpawn(id, shell, cols, rows)
Main:      nodePty.spawn() → on data: webContents.send(`pty:data:${id}`, data)
Renderer:  window.electronAPI.onPtyData(id, cb) → ipcRenderer.on(`pty:data:${id}`, cb)
```

Each tile has a unique string id (`tile-{timestamp}-{counter}`), which is also
the PTY key. This avoids stale references when tiles are deleted and recreated.

### xterm.js vs Rust Grid
The Rust code had a full manual grid implementation (VecDeque, scrollback, VTE parser).
xterm.js makes this unnecessary — it handles:
- Full ANSI/VT100/xterm-256color sequences
- Mouse reporting modes (1000/1002/1003/1006 SGR)
- Bracketed paste mode
- Alternate screen buffer
- Scrollback buffer (configurable size)
- Selection and clipboard
- WebGL-accelerated rendering

The only custom behaviour to add is OSC title change forwarding to tile names.

### node-pty Notes
- `node-pty` must run in the **main process** (native addon, no renderer access)
- Always pass `TERM=xterm-256color` and `COLORTERM=truecolor` in env
- `pty.resize(cols, rows)` must be called when xterm fires `onResize`
- PTY ids survive tile re-renders because React lifecycle is tied to tile id

### Tile Linking Implementation
When tile A links to tile B:
1. In `electron/pty.ts`, `PtyManager.spawn()` receives a second `onData` callback
2. Before calling the renderer callback, check if this tile has an `outputLink`
3. Strip ANSI from the data and call `ptyWrite(linkedId, cleanData)`

This mirrors the Rust approach of intercepting PTY reader output and forwarding
stripped bytes to the target PTY.

### Workspaces
`electron-store` is the recommended approach:
```typescript
import Store from 'electron-store'
const store = new Store<{ workspaces: Record<string, WorkspaceLayout> }>()
```

Workspaces only save tile geometry (x, y, w, h, name, kind) — not terminal
buffer content, just like the Rust implementation.

### Monaco Editor for SQL/HTTP body
For the HTTP body editor and PostgreSQL query editor, use:
```
npm install @monaco-editor/react
```
This gives a full code editor with syntax highlighting, a large improvement
over the Rust immediate-mode text field.
