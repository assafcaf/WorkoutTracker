const BOM = '﻿'

function sniffDelimiter(text: string): string {
  let commas = 0
  let semis = 0
  let quoted = false
  for (const ch of text) {
    if (ch === '"') quoted = !quoted
    else if (!quoted) {
      if (ch === '\n' || ch === '\r') break
      if (ch === ',') commas++
      else if (ch === ';') semis++
    }
  }
  return semis > commas ? ';' : ','
}

export function parseCsv(text: string): string[][] {
  const src = text.startsWith(BOM) ? text.slice(1) : text
  const delim = sniffDelimiter(src)
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let quoted = false
  let pending = false
  for (let i = 0; i < src.length; i++) {
    const ch = src[i]
    if (quoted) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          field += '"'
          i++
        } else quoted = false
      } else field += ch
    } else if (ch === '"') {
      quoted = true
      pending = true
    } else if (ch === delim) {
      row.push(field)
      field = ''
      pending = true
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && src[i + 1] === '\n') i++
      if (pending) {
        row.push(field)
        rows.push(row)
      }
      row = []
      field = ''
      pending = false
    } else {
      field += ch
      pending = true
    }
  }
  if (pending || field !== '' || row.length > 0) {
    row.push(field)
    rows.push(row)
  }
  return rows
}

function quoteField(f: string): string {
  return /[",;\r\n]/.test(f) ? `"${f.replace(/"/g, '""')}"` : f
}

export function writeCsv(rows: string[][]): string {
  return rows.map((r) => r.map(quoteField).join(',') + '\r\n').join('')
}

export function withBom(text: string): string {
  return text.startsWith(BOM) ? text : BOM + text
}

/** Column positions by name; keys of the result are the names as passed. A missing required name throws, naming it; a missing optional name is absent. */
export function headerIndex(
  header: string[],
  required: string[],
  optional: string[] = [],
): Record<string, number> {
  const norm = header.map((h) => h.trim().toLowerCase())
  const out: Record<string, number> = {}
  for (const name of required) {
    const i = norm.indexOf(name.trim().toLowerCase())
    if (i < 0) throw new Error(`Missing column: ${name}`)
    out[name] = i
  }
  for (const name of optional) {
    const i = norm.indexOf(name.trim().toLowerCase())
    if (i >= 0) out[name] = i
  }
  return out
}
