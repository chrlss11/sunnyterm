import { createHighlighter, type Highlighter } from 'shiki'
import type { ThemeName } from './themes'

let highlighter: Highlighter | null = null
let initPromise: Promise<Highlighter> | null = null

const SHIKI_THEMES: Record<ThemeName, string> = {
  dark: 'github-dark',
  light: 'github-light',
  claude: 'monokai',
  vino: 'dracula'
}

const EXT_TO_LANG: Record<string, string> = {
  js: 'javascript', jsx: 'jsx', ts: 'typescript', tsx: 'tsx',
  py: 'python', rb: 'ruby', rs: 'rust', go: 'go',
  java: 'java', kt: 'kotlin', swift: 'swift',
  c: 'c', cpp: 'cpp', h: 'c', hpp: 'cpp',
  cs: 'csharp', php: 'php', lua: 'lua',
  sh: 'bash', bash: 'bash', zsh: 'bash', fish: 'bash',
  json: 'json', yaml: 'yaml', yml: 'yaml', toml: 'toml',
  xml: 'xml', html: 'html', htm: 'html', svg: 'xml',
  css: 'css', scss: 'scss', less: 'less',
  md: 'markdown', mdx: 'mdx',
  sql: 'sql', graphql: 'graphql', gql: 'graphql',
  dockerfile: 'dockerfile', docker: 'dockerfile',
  makefile: 'makefile',
  vue: 'vue', svelte: 'svelte',
  r: 'r', dart: 'dart', zig: 'zig',
  tf: 'hcl', hcl: 'hcl',
  prisma: 'prisma',
  env: 'bash', gitignore: 'bash',
  txt: 'text', log: 'text', csv: 'text'
}

async function getHighlighter(): Promise<Highlighter> {
  if (highlighter) return highlighter
  if (initPromise) return initPromise

  initPromise = createHighlighter({
    themes: ['github-dark', 'github-light', 'monokai', 'dracula'],
    langs: Object.values(EXT_TO_LANG).filter((v, i, a) => a.indexOf(v) === i && v !== 'text')
  })

  highlighter = await initPromise
  return highlighter
}

export function getLanguageFromFilename(filename: string): string {
  const lower = filename.toLowerCase()
  // Handle dotfiles like Makefile, Dockerfile
  const base = lower.split('/').pop() || ''
  if (base === 'makefile') return 'makefile'
  if (base === 'dockerfile') return 'dockerfile'
  if (base === '.gitignore' || base === '.env') return 'bash'

  const ext = lower.split('.').pop() || ''
  return EXT_TO_LANG[ext] || 'text'
}

export async function highlightCode(
  code: string,
  lang: string,
  appTheme: ThemeName
): Promise<string> {
  if (lang === 'text' || code.length > 100_000) {
    // Plain text fallback
    const escaped = code
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
    return `<pre style="margin:0;white-space:pre-wrap;word-break:break-all;">${escaped}</pre>`
  }

  try {
    const h = await getHighlighter()
    const theme = SHIKI_THEMES[appTheme] || 'github-dark'

    // Check if language is loaded
    const loadedLangs = h.getLoadedLanguages()
    const effectiveLang = loadedLangs.includes(lang as any) ? lang : 'text'

    if (effectiveLang === 'text') {
      const escaped = code
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
      return `<pre style="margin:0;white-space:pre-wrap;word-break:break-all;">${escaped}</pre>`
    }

    return h.codeToHtml(code, { lang: effectiveLang, theme })
  } catch {
    const escaped = code
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
    return `<pre style="margin:0;white-space:pre-wrap;word-break:break-all;">${escaped}</pre>`
  }
}
