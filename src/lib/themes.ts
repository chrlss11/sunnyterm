/**
 * Theme definitions for SunnyTerm.
 * Each theme defines CSS variables (for the UI) and an xterm color scheme.
 */

export type ThemeName = 'dark' | 'light' | 'nord' | 'dracula' | 'monokai' | 'solarized' | 'tokyo' | 'catppuccin' | 'claude' | 'vino' | 'rose-pine-dawn' | 'github-light' | 'solarized-light'

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
      cursor: '#60a5fa',
      cursorAccent: '#000000',
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
      cursor: '#2563eb',
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

  nord: {
    name: 'nord',
    label: 'Nord',
    isDark: true,
    css: {
      canvas: '#242933',
      tile: '#2e3440',
      titlebar: '#3b4252',
      toolbar: '#242933',
      surface: '#2e3440',
      textPrimary: '#eceff4',
      textSecondary: 'rgba(216, 222, 233, 0.8)',
      textMuted: 'rgba(216, 222, 233, 0.4)',
      border: 'rgba(216, 222, 233, 0.08)',
      primary: '#88c0d0'
    },
    terminal: {
      background: '#2e3440',
      foreground: '#d8dee9',
      cursor: '#88c0d0',
      cursorAccent: '#2e3440',
      selectionBackground: '#434c5e',
      black: '#3b4252',
      red: '#bf616a',
      green: '#a3be8c',
      yellow: '#ebcb8b',
      blue: '#81a1c1',
      magenta: '#b48ead',
      cyan: '#88c0d0',
      white: '#e5e9f0',
      brightBlack: '#4c566a',
      brightRed: '#bf616a',
      brightGreen: '#a3be8c',
      brightYellow: '#ebcb8b',
      brightBlue: '#81a1c1',
      brightMagenta: '#b48ead',
      brightCyan: '#8fbcbb',
      brightWhite: '#eceff4'
    }
  },

  dracula: {
    name: 'dracula',
    label: 'Dracula',
    isDark: true,
    css: {
      canvas: '#21222c',
      tile: '#282a36',
      titlebar: '#343746',
      toolbar: '#21222c',
      surface: '#282a36',
      textPrimary: '#f8f8f2',
      textSecondary: 'rgba(248, 248, 242, 0.75)',
      textMuted: 'rgba(248, 248, 242, 0.4)',
      border: 'rgba(189, 147, 249, 0.12)',
      primary: '#bd93f9'
    },
    terminal: {
      background: '#282a36',
      foreground: '#f8f8f2',
      cursor: '#f8f8f2',
      cursorAccent: '#282a36',
      selectionBackground: '#44475a',
      black: '#21222c',
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

  monokai: {
    name: 'monokai',
    label: 'Monokai',
    isDark: true,
    css: {
      canvas: '#1e1f1c',
      tile: '#272822',
      titlebar: '#33342c',
      toolbar: '#1e1f1c',
      surface: '#272822',
      textPrimary: '#f8f8f2',
      textSecondary: 'rgba(248, 248, 242, 0.75)',
      textMuted: 'rgba(248, 248, 242, 0.4)',
      border: 'rgba(249, 38, 114, 0.12)',
      primary: '#a6e22e'
    },
    terminal: {
      background: '#272822',
      foreground: '#f8f8f2',
      cursor: '#f8f8f0',
      cursorAccent: '#272822',
      selectionBackground: '#49483e',
      black: '#272822',
      red: '#f92672',
      green: '#a6e22e',
      yellow: '#f4bf75',
      blue: '#66d9ef',
      magenta: '#ae81ff',
      cyan: '#a1efe4',
      white: '#f8f8f2',
      brightBlack: '#75715e',
      brightRed: '#f92672',
      brightGreen: '#a6e22e',
      brightYellow: '#f4bf75',
      brightBlue: '#66d9ef',
      brightMagenta: '#ae81ff',
      brightCyan: '#a1efe4',
      brightWhite: '#f9f8f5'
    }
  },

  solarized: {
    name: 'solarized',
    label: 'Solarized',
    isDark: true,
    css: {
      canvas: '#001e26',
      tile: '#002b36',
      titlebar: '#073642',
      toolbar: '#001e26',
      surface: '#002b36',
      textPrimary: '#fdf6e3',
      textSecondary: 'rgba(238, 232, 213, 0.8)',
      textMuted: 'rgba(238, 232, 213, 0.4)',
      border: 'rgba(38, 139, 210, 0.15)',
      primary: '#268bd2'
    },
    terminal: {
      background: '#002b36',
      foreground: '#839496',
      cursor: '#268bd2',
      cursorAccent: '#002b36',
      selectionBackground: '#073642',
      black: '#073642',
      red: '#dc322f',
      green: '#859900',
      yellow: '#b58900',
      blue: '#268bd2',
      magenta: '#d33682',
      cyan: '#2aa198',
      white: '#eee8d5',
      brightBlack: '#586e75',
      brightRed: '#cb4b16',
      brightGreen: '#586e75',
      brightYellow: '#657b83',
      brightBlue: '#839496',
      brightMagenta: '#6c71c4',
      brightCyan: '#93a1a1',
      brightWhite: '#fdf6e3'
    }
  },

  tokyo: {
    name: 'tokyo',
    label: 'Tokyo Night',
    isDark: true,
    css: {
      canvas: '#16161e',
      tile: '#1a1b26',
      titlebar: '#24283b',
      toolbar: '#16161e',
      surface: '#1a1b26',
      textPrimary: '#c0caf5',
      textSecondary: 'rgba(169, 177, 214, 0.8)',
      textMuted: 'rgba(169, 177, 214, 0.4)',
      border: 'rgba(122, 162, 247, 0.1)',
      primary: '#7aa2f7'
    },
    terminal: {
      background: '#1a1b26',
      foreground: '#c0caf5',
      cursor: '#c0caf5',
      cursorAccent: '#1a1b26',
      selectionBackground: '#33467c',
      black: '#15161e',
      red: '#f7768e',
      green: '#9ece6a',
      yellow: '#e0af68',
      blue: '#7aa2f7',
      magenta: '#bb9af7',
      cyan: '#7dcfff',
      white: '#a9b1d6',
      brightBlack: '#414868',
      brightRed: '#f7768e',
      brightGreen: '#9ece6a',
      brightYellow: '#e0af68',
      brightBlue: '#7aa2f7',
      brightMagenta: '#bb9af7',
      brightCyan: '#7dcfff',
      brightWhite: '#c0caf5'
    }
  },

  catppuccin: {
    name: 'catppuccin',
    label: 'Catppuccin',
    isDark: true,
    css: {
      canvas: '#11111b',
      tile: '#1e1e2e',
      titlebar: '#313244',
      toolbar: '#11111b',
      surface: '#1e1e2e',
      textPrimary: '#cdd6f4',
      textSecondary: 'rgba(186, 194, 222, 0.8)',
      textMuted: 'rgba(186, 194, 222, 0.4)',
      border: 'rgba(137, 180, 250, 0.1)',
      primary: '#cba6f7'
    },
    terminal: {
      background: '#1e1e2e',
      foreground: '#cdd6f4',
      cursor: '#f5e0dc',
      cursorAccent: '#1e1e2e',
      selectionBackground: '#45475a',
      black: '#45475a',
      red: '#f38ba8',
      green: '#a6e3a1',
      yellow: '#f9e2af',
      blue: '#89b4fa',
      magenta: '#cba6f7',
      cyan: '#94e2d5',
      white: '#bac2de',
      brightBlack: '#585b70',
      brightRed: '#f38ba8',
      brightGreen: '#a6e3a1',
      brightYellow: '#f9e2af',
      brightBlue: '#89b4fa',
      brightMagenta: '#cba6f7',
      brightCyan: '#94e2d5',
      brightWhite: '#a6adc8'
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
  },

  'rose-pine-dawn': {
    name: 'rose-pine-dawn',
    label: 'Rosé Dawn',
    isDark: false,
    css: {
      canvas: '#f2e9e1',
      tile: '#faf4ed',
      titlebar: '#f2e9e1',
      toolbar: '#f2e9e1',
      surface: '#fffaf3',
      textPrimary: '#575279',
      textSecondary: '#797593',
      textMuted: '#9893a5',
      border: 'rgba(87, 82, 121, 0.12)',
      primary: '#d7827e'
    },
    terminal: {
      background: '#faf4ed',
      foreground: '#575279',
      cursor: '#575279',
      cursorAccent: '#faf4ed',
      selectionBackground: '#dfdad9',
      black: '#f2e9e1',
      red: '#b4637a',
      green: '#286983',
      yellow: '#ea9d34',
      blue: '#56949f',
      magenta: '#907aa9',
      cyan: '#d7827e',
      white: '#575279',
      brightBlack: '#9893a5',
      brightRed: '#b4637a',
      brightGreen: '#286983',
      brightYellow: '#ea9d34',
      brightBlue: '#56949f',
      brightMagenta: '#907aa9',
      brightCyan: '#d7827e',
      brightWhite: '#575279'
    }
  },

  'github-light': {
    name: 'github-light',
    label: 'GitHub',
    isDark: false,
    css: {
      canvas: '#e8ecf0',
      tile: '#ffffff',
      titlebar: '#f6f8fa',
      toolbar: '#f6f8fa',
      surface: '#f6f8fa',
      textPrimary: '#1f2328',
      textSecondary: '#59636e',
      textMuted: '#8b949e',
      border: 'rgba(31, 35, 40, 0.12)',
      primary: '#0969da'
    },
    terminal: {
      background: '#ffffff',
      foreground: '#1f2328',
      cursor: '#0969da',
      cursorAccent: '#ffffff',
      selectionBackground: '#ace2f9',
      black: '#24292f',
      red: '#cf222e',
      green: '#116329',
      yellow: '#9a6700',
      blue: '#0969da',
      magenta: '#8250df',
      cyan: '#1b7c83',
      white: '#6e7781',
      brightBlack: '#8c959f',
      brightRed: '#a40e26',
      brightGreen: '#1a7f37',
      brightYellow: '#7d4e00',
      brightBlue: '#218bff',
      brightMagenta: '#a475f9',
      brightCyan: '#3192aa',
      brightWhite: '#d0d7de'
    }
  },

  'solarized-light': {
    name: 'solarized-light',
    label: 'Solar Light',
    isDark: false,
    css: {
      canvas: '#eee8d5',
      tile: '#fdf6e3',
      titlebar: '#eee8d5',
      toolbar: '#eee8d5',
      surface: '#fdf6e3',
      textPrimary: '#073642',
      textSecondary: '#586e75',
      textMuted: '#93a1a1',
      border: 'rgba(7, 54, 66, 0.1)',
      primary: '#268bd2'
    },
    terminal: {
      background: '#fdf6e3',
      foreground: '#657b83',
      cursor: '#268bd2',
      cursorAccent: '#fdf6e3',
      selectionBackground: '#eee8d5',
      black: '#073642',
      red: '#dc322f',
      green: '#859900',
      yellow: '#b58900',
      blue: '#268bd2',
      magenta: '#d33682',
      cyan: '#2aa198',
      white: '#eee8d5',
      brightBlack: '#002b36',
      brightRed: '#cb4b16',
      brightGreen: '#586e75',
      brightYellow: '#657b83',
      brightBlue: '#839496',
      brightMagenta: '#6c71c4',
      brightCyan: '#93a1a1',
      brightWhite: '#fdf6e3'
    }
  }
}

export const THEME_ORDER: ThemeName[] = ['dark', 'light', 'github-light', 'rose-pine-dawn', 'solarized-light', 'nord', 'dracula', 'monokai', 'solarized', 'tokyo', 'catppuccin', 'claude', 'vino']

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
