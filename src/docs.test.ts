import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, test } from 'vitest'

const root = resolve(__dirname, '..')
const contextDoc = readFileSync(resolve(root, 'CONTEXT.md'), 'utf-8')
const decision0004 = readFileSync(
  resolve(root, 'docs/decisions/0004-one-palette-one-shell-audited-as-data.md'),
  'utf-8',
)
const readme = readFileSync(resolve(root, 'docs/decisions/README.md'), 'utf-8')

describe('docs follow the Court design decision (O20)', () => {
  test('CONTEXT.md Token entry states the token count as 49', () => {
    const tokenEntryMatch = contextDoc.match(/\*\*Token\*\*:\n([\s\S]*?)\n\n/)
    expect(tokenEntryMatch).not.toBeNull()
    const tokenEntry = tokenEntryMatch![1]
    expect(tokenEntry).toMatch(/49/)
    expect(tokenEntry).not.toMatch(/29/)
  })

  test('CONTEXT.md no longer claims the palette is dark-only', () => {
    expect(contextDoc).not.toMatch(/dark-only/)
  })

  test('decision 0004 status line marks it superseded by 0009 for palette, dark-only and font rules', () => {
    const statusLine = decision0004.split('\n').find((line) => line.startsWith('Date:'))
    expect(statusLine).toBeDefined()
    expect(statusLine).toMatch(/superseded by 0009/)
    expect(statusLine).toMatch(/palette/)
    expect(statusLine).toMatch(/dark-only/)
    expect(statusLine).toMatch(/font/)
  })

  test('decision 0009 (Court design language) exists', () => {
    expect(
      existsSync(
        resolve(root, 'docs/decisions/0009-court-a-light-mellow-sport-design-language.md'),
      ),
    ).toBe(true)
  })

  test('docs/decisions/README.md indexes decision 0009', () => {
    expect(readme).toMatch(/\[0009\]\(0009-court-a-light-mellow-sport-design-language\.md\)/)
  })
})
