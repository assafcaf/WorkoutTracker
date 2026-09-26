// fix-picker-search: the Add exercise overlay's search input carries `.library-search`, whose
// rule in src/ui/LibraryList.css sets `flex: 1` for the Exercises page's row layout. Inside the
// picker's flex column (`.program-editor-picker`) that same `flex: 1` makes the input grow to
// fill the overlay's height instead of staying a single line. jsdom does not lay out CSS, so
// this reads the stylesheet as data (src/test/cssAudit's own convention) and checks the rule
// rather than rendered pixels.
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { expect, test } from 'vitest'
import { declarationsFor } from '../test/cssAudit'

const cssPath = resolve(fileURLToPath(import.meta.url), '..', 'ProgramEditor.css')
const css = readFileSync(cssPath, 'utf-8')

test('the picker search input does not grow vertically inside the overlay', () => {
  const declarations = declarationsFor(css, '.program-editor-picker .library-search')
  const flex = declarations.get('flex')
  const flexGrow = declarations.get('flex-grow')
  const staysSingleLine = flex === 'none' || flex === '0' || flexGrow === '0'
  expect(staysSingleLine).toBe(true)
})
