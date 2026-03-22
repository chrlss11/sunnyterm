# SunnyTerm

An infinite canvas terminal emulator. Terminals live as tiles you can freely arrange, group, link, and navigate on a zoomable canvas.

![SunnyTerm](https://img.shields.io/badge/version-0.1.0-blue) ![License](https://img.shields.io/badge/license-MIT-green) ![Platform](https://img.shields.io/badge/platform-macOS-lightgrey)

## Install

### macOS (Apple Silicon)

```bash
curl -fsSL https://github.com/noesrafa/sunnyterm/releases/latest/download/SunnyTerm-arm64.dmg -o SunnyTerm.dmg
open SunnyTerm.dmg
```

### macOS (Intel)

```bash
curl -fsSL https://github.com/noesrafa/sunnyterm/releases/latest/download/SunnyTerm-x64.dmg -o SunnyTerm.dmg
open SunnyTerm.dmg
```

### Build from source

```bash
git clone https://github.com/noesrafa/sunnyterm.git
cd sunnyterm
bun install
bun run dev       # dev mode with hot reload
bun run dist      # build .dmg + .zip
```

Requires Node.js 20+ (or Bun) and macOS.

## Features

- **Infinite canvas** — pan (Space+drag, scroll) and zoom (Cmd+scroll, pinch)
- **Terminal tiles** — full xterm-256color terminals with node-pty
- **Sections** — group tiles into labeled sections (Cmd+G), move/resize sections with their contents
- **Tile management** — create, move, resize, close, rename, duplicate
- **Tile linking** — pipe output from one terminal to another (Cmd+L)
- **Minimap** — click or drag to navigate (Cmd+M to toggle)
- **Workspaces** — save/load layouts with Cmd+S, switch with Cmd+1-9
- **Undo/redo** — full history for move, resize, create, delete, rename
- **Search** — find across terminals (Cmd+F)
- **Dark/light mode** — toggle with Cmd+Shift+D
- **HTTP client** — built-in REST client tiles
- **PostgreSQL client** — query databases from a tile

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Cmd+T` | New terminal |
| `Cmd+Shift+N` | New HTTP client |
| `Cmd+Shift+P` | New PostgreSQL client |
| `Cmd+W` | Close focused tile |
| `Cmd+G` | Group selected tiles into section |
| `Cmd+L` | Link tile output |
| `Cmd+S` | Save workspace |
| `Cmd+Z / Cmd+Shift+Z` | Undo / Redo |
| `Cmd+M` | Toggle minimap |
| `Cmd+F` | Search |
| `Cmd+Shift+D` | Toggle dark/light mode |
| `Cmd+0` | Reset zoom |
| `Cmd+1-9` | Switch workspace |
| `Delete / Backspace` | Remove focused or selected tiles |
| `Tab / Shift+Tab` | Cycle focus between tiles |
| `Double-click canvas` | New terminal at cursor |
| `Double-click title` | Rename tile |
| `Space+drag` | Pan canvas |
| `Cmd+scroll` | Zoom canvas |

## Stack

| Layer | Technology |
|-------|-----------|
| Shell | Electron 41 |
| Renderer | React 19 + TypeScript |
| Terminal | xterm.js 6 |
| PTY | node-pty |
| State | Zustand 5 |
| Build | electron-vite 5 |
| Styling | Tailwind CSS 4 |

## License

MIT
