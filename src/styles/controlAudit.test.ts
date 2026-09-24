// [O12] every JSX <button>, <input>, <select> and <fieldset> under src/ (tests excepted)
// carries a className, and each of its classes has a rule in some src/**/*.css file. A
// file-input <input type="file"> counts, and so does the picker's <fieldset> in App.tsx.
// [O14] the picker's <fieldset> (class .workout-picker) resets border, padding and margin
// to zero, since a native fieldset otherwise renders with all three.
//
// The matcher reads `.tsx` source as text rather than parsing it as JSX, per this file's own
// convention (src/styles/cssAudit.test.ts reads CSS as text with postcss for the same reason):
// a hand-rolled JSX parser is not worth carrying for four tag names. The one place a naive
// regex would go wrong is an attribute value containing `=> ...`, whose `>` is not the tag's
// own close -- `extractControls` tracks brace depth so it only treats a bare `>` as the tag's
// end while depth is back to zero.
import { readdirSync, readFileSync } from 'node:fs'
import { join, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { expect, test } from 'vitest'
import { declarationsFor } from '../test/cssAudit'

// src/styles/controlAudit.test.ts -> the repository root.
const repoRoot = resolve(fileURLToPath(import.meta.url), '..', '..', '..')
const srcDir = join(repoRoot, 'src')

/** An absolute path as a repo-relative, '/'-separated one, which is how failures read. */
function rel(absolute: string): string {
  return absolute.slice(repoRoot.length + 1).split(sep).join('/')
}

/** Every file under `dir` whose name matches, absolute and sorted. */
function filesUnder(dir: string, matches: RegExp): string[] {
  const found: string[] = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) found.push(...filesUnder(full, matches))
    else if (matches.test(entry.name)) found.push(full)
  }
  return found.sort()
}

const CONTROL_TAGS = ['button', 'input', 'select', 'fieldset'] as const
const OPEN_TAG = new RegExp(`<(${CONTROL_TAGS.join('|')})(?=[\\s/>])`, 'g')

export type FoundControl = { tag: (typeof CONTROL_TAGS)[number]; attrs: string }

/**
 * Every `<button>`, `<input>`, `<select>` and `<fieldset>` opening tag in `source`, each with
 * its raw attribute text. Stops each tag at the first `>` seen while brace depth is back to
 * zero, so an attribute value holding an arrow function (`onClick={() => ...}`) does not end
 * the tag early at the `>` inside `=>`.
 */
export function extractControls(source: string): FoundControl[] {
  const found: FoundControl[] = []
  for (const match of source.matchAll(OPEN_TAG)) {
    const tag = match[1] as FoundControl['tag']
    const start = (match.index as number) + match[0].length
    let depth = 0
    let i = start
    for (; i < source.length; i++) {
      const ch = source[i]
      if (ch === '{') depth++
      else if (ch === '}') depth--
      else if (ch === '>' && depth === 0) break
    }
    found.push({ tag, attrs: source.slice(start, i) })
  }
  return found
}

/**
 * The classes a `className` attribute carries, reading a plain string or a braced string/
 * template literal with no interpolation. `null` means there is no `className` attribute at
 * all; `[]` means one is present but empty.
 */
export function classesOf(attrs: string): string[] | null {
  const match =
    /className\s*=\s*(?:"([^"]*)"|'([^']*)'|\{\s*"([^"]*)"\s*\}|\{\s*'([^']*)'\s*\}|\{\s*`([^`]*)`\s*\})/.exec(
      attrs,
    )
  if (!match) return null
  const raw = match.slice(1).find((group) => group !== undefined) ?? ''
  return raw.split(/\s+/).filter(Boolean)
}

const modules = (): string[] => filesUnder(srcDir, /\.tsx$/).filter((path) => !path.endsWith('.test.tsx'))
const stylesheets = (): string[] => filesUnder(srcDir, /\.css$/)

/** Every class name any stylesheet under src declares a rule for. */
function classesWithRules(): Set<string> {
  const classes = new Set<string>()
  for (const path of stylesheets()) {
    for (const match of readFileSync(path, 'utf-8').matchAll(/\.(-?[_a-zA-Z][\w-]*)/g)) {
      classes.add(match[1])
    }
  }
  return classes
}

// Controls that already carry a className but not yet a rule, because the rule belongs to a
// different task's outcome: the pager control (E6-T7's "Show more") and the Alternatives
// overlay's Close button (E6-T4). Excluded from the "has a rule" half of the audit only -- they
// still have to carry a className, which they already do.
const RULE_EXEMPT_CLASSES = new Set(['library-show-more', 'alternatives-overlay-close'])

test('O12 extractControls finds a control whose attrs hold an arrow function', () => {
  const source = [
    '<button',
    '  type="button"',
    '  onClick={() => onUndoSwap(plan.exerciseId)}',
    '>',
    '  Undo swap',
    '</button>',
  ].join('\n')

  const [control] = extractControls(source)
  expect(control.tag).toBe('button')
  expect(control.attrs).toContain('onUndoSwap')
})

test('O12 extractControls finds every control tag, ignoring other elements', () => {
  const source = [
    '<div className="wrap">',
    '  <button type="button" className="a">x</button>',
    '  <input type="search" className="b" />',
    '  <select className="c"><option>1</option></select>',
    '  <fieldset className="d"><legend>e</legend></fieldset>',
    '  <label className="not-a-control">f</label>',
    '</div>',
  ].join('\n')

  expect(extractControls(source).map((control) => control.tag)).toEqual([
    'button',
    'input',
    'select',
    'fieldset',
  ])
})

test('O12 classesOf reads a static string className, splitting multiple classes', () => {
  expect(classesOf('type="button" className="a b"')).toEqual(['a', 'b'])
  expect(classesOf('className={"a"}')).toEqual(['a'])
  expect(classesOf('className={`a`}')).toEqual(['a'])
})

test('O12 classesOf returns null when there is no className attribute at all', () => {
  expect(classesOf('type="button" onClick={onCancel}')).toBeNull()
})

test('O12 classesOf returns an empty array for an empty className', () => {
  expect(classesOf('className=""')).toEqual([])
})

test('O12 every control under src carries a className', () => {
  const offenders: string[] = []
  for (const path of modules()) {
    const source = readFileSync(path, 'utf-8')
    for (const control of extractControls(source)) {
      const classes = classesOf(control.attrs)
      if (classes === null || classes.length === 0) {
        offenders.push(`${rel(path)}: <${control.tag}> has no className`)
      }
    }
  }

  expect(offenders, 'every control must carry a className with a rule').toEqual([])
})

test('O12 every class a control carries has a rule in some stylesheet under src', () => {
  const declared = classesWithRules()
  const offenders: string[] = []
  for (const path of modules()) {
    const source = readFileSync(path, 'utf-8')
    for (const control of extractControls(source)) {
      const classes = classesOf(control.attrs) ?? []
      for (const className of classes) {
        if (RULE_EXEMPT_CLASSES.has(className)) continue
        if (!declared.has(className)) {
          offenders.push(`${rel(path)}: <${control.tag} className="${className}"> has no rule`)
        }
      }
    }
  }

  expect(offenders, 'every control class must have a rule in some stylesheet under src').toEqual(
    [],
  )
})

test('O12 the picker\'s fieldset in App.tsx carries the workout-picker class', () => {
  const appSource = readFileSync(join(srcDir, 'App.tsx'), 'utf-8')
  const fieldset = extractControls(appSource).find(
    (control) => control.tag === 'fieldset' && control.attrs.includes('storageAvailable'),
  )

  expect(fieldset, 'the picker\'s fieldset (guarding on storageAvailable) must exist').toBeDefined()
  expect(classesOf((fieldset as FoundControl).attrs)).toEqual(['workout-picker'])
})

test('O14 .workout-picker resets border, padding and margin to zero', () => {
  const merged = new Map<string, string>()
  for (const path of stylesheets()) {
    for (const [prop, value] of declarationsFor(readFileSync(path, 'utf-8'), '.workout-picker')) {
      merged.set(prop, value)
    }
  }

  expect(merged.get('border')).toBe('0')
  expect(merged.get('padding')).toBe('0')
  expect(merged.get('margin')).toBe('0')
})
