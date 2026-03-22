/**
 * Parse a curl command string into HTTP request components.
 * Handles: URL, -X/--request method, -H/--header, -d/--data/--data-raw body
 */
export interface ParsedCurl {
  method: string
  url: string
  headers: { key: string; value: string }[]
  body: string
}

export function parseCurl(input: string): ParsedCurl | null {
  // Normalize: remove line continuations and collapse whitespace
  const cmd = input
    .replace(/\\\n/g, ' ')
    .replace(/\\\r\n/g, ' ')
    .trim()

  // Must start with "curl"
  if (!cmd.match(/^curl\s/i)) return null

  const headers: { key: string; value: string }[] = []
  let method = ''
  let url = ''
  let body = ''

  // Tokenize respecting quotes
  const tokens = tokenize(cmd)

  // Skip "curl"
  let i = 1
  while (i < tokens.length) {
    const token = tokens[i]

    if ((token === '-X' || token === '--request') && i + 1 < tokens.length) {
      method = tokens[++i].toUpperCase()
    } else if ((token === '-H' || token === '--header') && i + 1 < tokens.length) {
      const h = tokens[++i]
      const colonIdx = h.indexOf(':')
      if (colonIdx > 0) {
        headers.push({
          key: h.slice(0, colonIdx).trim(),
          value: h.slice(colonIdx + 1).trim()
        })
      }
    } else if ((token === '-d' || token === '--data' || token === '--data-raw' || token === '--data-binary') && i + 1 < tokens.length) {
      body = tokens[++i]
    } else if (token.startsWith('-')) {
      // Skip unknown flags; if next token doesn't start with -, consume it as value
      if (i + 1 < tokens.length && !tokens[i + 1].startsWith('-')) {
        i++
      }
    } else {
      // Positional argument = URL
      if (!url) url = token
    }

    i++
  }

  if (!url) return null

  // Infer method if not specified
  if (!method) {
    method = body ? 'POST' : 'GET'
  }

  return { method, url, headers, body }
}

/** Tokenize a shell command respecting single and double quotes */
function tokenize(input: string): string[] {
  const tokens: string[] = []
  let current = ''
  let inSingle = false
  let inDouble = false
  let escape = false

  for (let i = 0; i < input.length; i++) {
    const ch = input[i]

    if (escape) {
      current += ch
      escape = false
      continue
    }

    if (ch === '\\' && !inSingle) {
      escape = true
      continue
    }

    if (ch === "'" && !inDouble) {
      inSingle = !inSingle
      continue
    }

    if (ch === '"' && !inSingle) {
      inDouble = !inDouble
      continue
    }

    if ((ch === ' ' || ch === '\t' || ch === '\n') && !inSingle && !inDouble) {
      if (current) {
        tokens.push(current)
        current = ''
      }
      continue
    }

    current += ch
  }

  if (current) tokens.push(current)
  return tokens
}
