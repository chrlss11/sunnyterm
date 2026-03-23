/**
 * Theme definitions for SunnyTerm.
 * Each theme defines CSS variables (for the UI) and an xterm color scheme.
 */

export type ThemeName = 'dark' | 'light' | 'claude' | 'vino'

export interface ThemeDef {
  name: ThemeName
  label: string
  isDark: boolean
  /** CSS custom properties applied to :root */
  css: {
    canvas: string
    tile: string
    titlebar: string
    toolbar: string
    surface: string
    textPrimary: string
    textSecondary: string
    textMuted: string
    border: string
    primary: string
  }
  /** xterm.js terminal color scheme */
  terminal: {
    background: string
    foreground: string
    cursor: string
    cursorAccent: string
    selectionBackground: string
    black: string
    red: string
    green: string
    yellow: string
    blue: string
    magenta: string
    cyan: string
    white: string
    brightBlack: string
    brightRed: string
    brightGreen: string
    brightYellow: string
    brightBlue: string
    brightMagenta: string
    brightCyan: string
    brightWhite: string
  }
}

export const THEMES: Record<ThemeName, ThemeDef> = {
  dark: {
    name: 'dark',
    label: 'Dark',
    isDark: true,
    css: {
      canvas: '#111213',
      tile: '#1B1D1F',
      titlebar: '#222426',
      toolbar: '#141516',
      surface: '#1B1D1F',
      textPrimary: '#e0e0e8',
      textSecondary: 'rgba(255, 255, 255, 0.7)',
      textMuted: 'rgba(255, 255, 255, 0.4)',
      border: 'rgba(255, 255, 255, 0.08)',
      primary: '#a0a0ff'
    },
    terminal: {
      background: '#1B1D1F',
      foreground: '#e0e0e0',
      cursor: '#a0a0ff',
      cursorAccent: '#1B1D1F',
      selectionBackground: '#4040a0',
      black: '#222426',
      red: '#ff5555',
      green: '#50fa7b',
      yellow: '#f1fa8c',
      blue: '#bd93f9',
      magenta: '#ff79c6',
      cyan: '#8be9fd',
      white: '#f8f8f2',
      brightBlack: '#6272a4',
      brightRed: '#ff6e6e',
      brightGreen: '#69ff94',
      brightYellow: '#ffffa5',
      brightBlue: '#d6acff',
      brightMagenta: '#ff92df',
      brightCyan: '#a4ffff',
      brightWhite: '#ffffff'
    }
  },

  light: {
    name: 'light',
    label: 'Light',
    isDark: false,
    css: {
      canvas: '#ebedf0',
      tile: '#ffffff',
      titlebar: '#f4f5f7',
      toolbar: '#f4f5f7',
      surface: '#f8f9fb',
      textPrimary: '#111827',
      textSecondary: '#4b5563',
      textMuted: '#9ca3af',
      border: 'rgba(0, 0, 0, 0.15)',
      primary: '#0366d6'
    },
    terminal: {
      background: '#ffffff',
      foreground: '#24292e',
      cursor: '#586069',
      cursorAccent: '#ffffff',
      selectionBackground: '#c8d3e8',
      black: '#24292e',
      red: '#d73a49',
      green: '#22863a',
      yellow: '#b08800',
      blue: '#0366d6',
      magenta: '#6f42c1',
      cyan: '#1b7c83',
      white: '#6a737d',
      brightBlack: '#959da5',
      brightRed: '#cb2431',
      brightGreen: '#28a745',
      brightYellow: '#dbab09',
      brightBlue: '#2188ff',
      brightMagenta: '#8a63d2',
      brightCyan: '#3192aa',
      brightWhite: '#d1d5da'
    }
  },

  claude: {
    name: 'claude',
    label: 'Claude',
    isDark: true,
    css: {
      canvas: '#1a1510',
      tile: '#231e17',
      titlebar: '#2a2419',
      toolbar: '#1a1510',
      surface: '#231e17',
      textPrimary: '#f0e6d6',
      textSecondary: 'rgba(240, 230, 214, 0.7)',
      textMuted: 'rgba(240, 230, 214, 0.4)',
      border: 'rgba(210, 170, 120, 0.15)',
      primary: '#e8a44a'
    },
    terminal: {
      background: '#231e17',
      foreground: '#f0e6d6',
      cursor: '#e8a44a',
      cursorAccent: '#231e17',
      selectionBackground: '#4a3a25',
      black: '#2a2419',
      red: '#e87a5a',
      green: '#8abf6a',
      yellow: '#e8a44a',
      blue: '#7aade8',
      magenta: '#c89ae8',
      cyan: '#6ac4b0',
      white: '#f0e6d6',
      brightBlack: '#6b5d4d',
      brightRed: '#f09070',
      brightGreen: '#a0d880',
      brightYellow: '#f0b860',
      brightBlue: '#90c0f0',
      brightMagenta: '#d8b0f0',
      brightCyan: '#80d8c8',
      brightWhite: '#faf4ea'
    }
  },

  vino: {
    name: 'vino',
    label: 'Vino',
    isDark: true,
    css: {
      canvas: '#170d14',
      tile: '#1e1219',
      titlebar: '#281822',
      toolbar: '#170d14',
      surface: '#1e1219',
      textPrimary: '#f0dce6',
      textSecondary: 'rgba(240, 220, 230, 0.7)',
      textMuted: 'rgba(240, 220, 230, 0.4)',
      border: 'rgba(180, 100, 140, 0.15)',
      primary: '#c45a7c'
    },
    terminal: {
      background: '#1e1219',
      foreground: '#f0dce6',
      cursor: '#c45a7c',
      cursorAccent: '#1e1219',
      selectionBackground: '#4a2038',
      black: '#281822',
      red: '#e05070',
      green: '#7abf6a',
      yellow: '#d4a04a',
      blue: '#8a8ae0',
      magenta: '#d070a0',
      cyan: '#6ab0b0',
      white: '#f0dce6',
      brightBlack: '#6b4a5a',
      brightRed: '#f06888',
      brightGreen: '#90d880',
      brightYellow: '#e0b860',
      brightBlue: '#a0a0f0',
      brightMagenta: '#e888b8',
      brightCyan: '#80c8c8',
      brightWhite: '#faf0f4'
    }
  }
}

export const THEME_ORDER: ThemeName[] = ['dark', 'light', 'claude', 'vino']

/** Apply a theme's CSS variables to the document root */
export function applyThemeCss(theme: ThemeDef): void {
  const root = document.documentElement
  root.style.setProperty('--canvas', theme.css.canvas)
  root.style.setProperty('--tile', theme.css.tile)
  root.style.setProperty('--titlebar', theme.css.titlebar)
  root.style.setProperty('--toolbar', theme.css.toolbar)
  root.style.setProperty('--surface', theme.css.surface)
  root.style.setProperty('--text-primary', theme.css.textPrimary)
  root.style.setProperty('--text-secondary', theme.css.textSecondary)
  root.style.setProperty('--text-muted', theme.css.textMuted)
  root.style.setProperty('--border', theme.css.border)
  root.style.setProperty('--primary', theme.css.primary)

  // Toggle .dark class for Tailwind dark variant
  root.classList.toggle('dark', theme.isDark)
}
