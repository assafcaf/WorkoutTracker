// A disabled Save button must not look enabled (fix-save-disabled): it renders identically to
// an enabled one today, using the Action bar's lime `background: var(--color-accent)` with
// `opacity: 1` regardless of the `disabled` attribute. This reads the CSS as data (the audits'
// own convention, src/test/cssAudit.ts) to require a `:disabled` rule for `.program-editor-save`
// that mutes the background and/or reduces opacity, and shows a `not-allowed` cursor.
import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, test } from 'vitest'
import { declarationsFor } from '../test/cssAudit'

const srcDir = resolve(fileURLToPath(import.meta.url), '..', '..')
const programEditorCss = readFileSync(join(srcDir, 'ui', 'ProgramEditor.css'), 'utf-8')
const appShellCss = readFileSync(join(srcDir, 'ui', 'AppShell.css'), 'utf-8')
const merged = new Map([
  ...declarationsFor(appShellCss, '.program-editor-save'),
  ...declarationsFor(programEditorCss, '.program-editor-save'),
])
const disabled = new Map([
  ...declarationsFor(appShellCss, '.program-editor-save:disabled'),
  ...declarationsFor(programEditorCss, '.program-editor-save:disabled'),
])

describe('O16 a disabled Save is styled as disabled', () => {
  test('the CSS declares a :disabled rule for .program-editor-save', () => {
    expect(disabled.size, 'expected a .program-editor-save:disabled rule').toBeGreaterThan(0)
  })

  test('the :disabled rule mutes opacity and/or background away from the enabled lime', () => {
    const enabledBackground = merged.get('background')
    const opacityChanged = disabled.has('opacity') && disabled.get('opacity') !== '1'
    const backgroundChanged =
      disabled.has('background') && disabled.get('background') !== enabledBackground
    expect(
      opacityChanged || backgroundChanged,
      'disabled Save must differ in opacity or background from the enabled lime style',
    ).toBe(true)
  })

  test('the :disabled rule shows a not-allowed cursor', () => {
    expect(disabled.get('cursor')).toBe('not-allowed')
  })
})
