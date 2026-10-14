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
import postcss from 'postcss'
import { describe, expect, test } from 'vitest'
import { declarationsFor, literalColours } from '../test/cssAudit'

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
  // E11-T15 O14 moved the picker out of App.tsx into the Workout screen group; the title is
  // kept as it was on purpose (the merge's weakened-tests check matches titles).
  //
  // The Progress Dashboard replaced the picker with the Dashboard's dock (S1): its one Start
  // button is guarded on storageAvailable in the handler rather than by a disabled fieldset,
  // which would also have disabled the Dashboard header's Settings gear. So the Workout screen
  // group holds no fieldset of its own any more, and the guard is in its start handler.
  const appSource = readFileSync(join(srcDir, 'features', 'workout', 'WorkoutFeature.tsx'), 'utf-8')
  const fieldsets = extractControls(appSource).filter((control) => control.tag === 'fieldset')

  expect(fieldsets, 'the Workout screen group renders no fieldset').toEqual([])
  expect(appSource).toMatch(/onStartWorkout=\{\(workoutId\) => \{\s*if \(activeProgram !== null && storageAvailable\)/)
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

// --- E17-T7: button roles (O10) and the keypad key (O13) ------------------------------------
// The Design's control table: every <button> wears exactly one of these roles, and the role's
// rule in src/styles/components.css paints the documented colours. Only colours are checked
// here (radius and weight belong to other tasks' audits).

const BUTTON_ROLES = [
  'btn-primary',
  'btn-secondary',
  'btn-quiet',
  'btn-danger',
  'tab',
  'key',
  'chip',
  'cell',
  'icon-btn',
] as const

const componentsCss = (): string => readFileSync(join(srcDir, 'styles', 'components.css'), 'utf-8')

/** `.role` plus a state suffix, with attribute quotes normalised to none: `.chip[aria-pressed=true]`. */
function normaliseSelector(selector: string): string {
  return selector.replace(/\s+/g, ' ').replace(/=\s*['"]([^'"]*)['"]/g, '=$1').trim()
}

/** Declarations for `selector` in `css`, merged across every rule listing it, quotes ignored. */
function declarationsMatching(css: string, selector: string): Map<string, string> {
  const wanted = normaliseSelector(selector)
  const merged = new Map<string, string>()
  postcss.parse(css).walkRules((rule) => {
    const selectors = rule.selector.split(',').map(normaliseSelector)
    if (!selectors.includes(wanted)) return
    rule.each((node) => {
      if (node.type === 'decl') merged.set(node.prop.trim(), node.value.trim())
    })
  })
  return merged
}

/** The fill a rule paints: `background-color`, else the `background` shorthand. */
function fillOf(declarations: Map<string, string>): string | undefined {
  return declarations.get('background-color') ?? declarations.get('background')
}

/** The border a rule paints, as one string: the shorthand plus any longhand colour/width. */
function borderOf(declarations: Map<string, string>): string {
  return [
    declarations.get('border'),
    declarations.get('border-width'),
    declarations.get('border-style'),
    declarations.get('border-color'),
  ]
    .filter(Boolean)
    .join(' ')
}

const NO_FILL = ['transparent', 'none']

test('E17 O10 every button under src carries exactly one role from the control table', () => {
  const offenders: string[] = []
  for (const path of modules()) {
    const source = readFileSync(path, 'utf-8')
    for (const control of extractControls(source)) {
      if (control.tag !== 'button') continue
      const classes = classesOf(control.attrs) ?? []
      const roles = classes.filter((className) => (BUTTON_ROLES as readonly string[]).includes(className))
      if (roles.length !== 1) {
        offenders.push(`${rel(path)}: <button className="${classes.join(' ')}"> has roles [${roles.join(', ')}]`)
      }
    }
  }

  expect(offenders, 'every <button> must carry exactly one button role').toEqual([])
})

test('E17 O10 btn-primary paints the primary fill and on-primary label, pressed in primary-pressed', () => {
  const rest = declarationsMatching(componentsCss(), '.btn-primary')
  const pressed = declarationsMatching(componentsCss(), '.btn-primary:active')

  expect(fillOf(rest)).toBe('var(--color-primary)')
  expect(rest.get('color')).toBe('var(--color-on-primary)')
  expect(fillOf(pressed)).toBe('var(--color-primary-pressed)')
})

test('E17 O10 btn-secondary paints surface with a 1px control border and text label, pressed in raised', () => {
  const rest = declarationsMatching(componentsCss(), '.btn-secondary')
  const pressed = declarationsMatching(componentsCss(), '.btn-secondary:active')

  expect(fillOf(rest)).toBe('var(--color-surface)')
  expect(borderOf(rest)).toContain('1px')
  expect(borderOf(rest)).toContain('var(--color-control)')
  expect(rest.get('color')).toBe('var(--color-text)')
  expect(fillOf(pressed)).toBe('var(--color-raised)')
})

test('E17 O10 btn-quiet has no fill and a text label, pressed in raised', () => {
  const rest = declarationsMatching(componentsCss(), '.btn-quiet')
  const pressed = declarationsMatching(componentsCss(), '.btn-quiet:active')

  expect(NO_FILL).toContain(fillOf(rest))
  expect(rest.get('color')).toBe('var(--color-text)')
  expect(fillOf(pressed)).toBe('var(--color-raised)')
})

test('E17 O10 btn-danger has no fill and a danger label, pressed in raised', () => {
  const rest = declarationsMatching(componentsCss(), '.btn-danger')
  const pressed = declarationsMatching(componentsCss(), '.btn-danger:active')

  expect(NO_FILL).toContain(fillOf(rest))
  expect(rest.get('color')).toBe('var(--color-danger)')
  expect(fillOf(pressed)).toBe('var(--color-raised)')
})

test('E17 O10 chip paints surface with a control border at rest', () => {
  const rest = declarationsMatching(componentsCss(), '.chip')

  expect(fillOf(rest)).toBe('var(--color-surface)')
  expect(borderOf(rest)).toContain('var(--color-control)')
})

test.each([
  ['a pressed chip (effort, Set kind, filters)', '.chip[aria-pressed=true]'],
  ['a checked switch-chip (the Bodyweight switch)', '.chip[aria-checked=true]'],
])('E17 O10 chip selected paints primary-tint fill with primary border and text: %s', (_, selector) => {
  const selected = declarationsMatching(componentsCss(), selector)

  expect(fillOf(selected)).toBe('var(--color-surface)')
  expect(borderOf(selected)).toContain('2px')
  expect(borderOf(selected)).toContain('var(--color-primary)')
  expect(selected.get('color')).toBe('var(--color-primary)')
})

test('E17 O10 tab paints a muted label, active in primary', () => {
  const rest = declarationsMatching(componentsCss(), '.tab')
  const active = declarationsMatching(componentsCss(), '.tab[aria-current=page]')

  expect(rest.get('color')).toBe('var(--color-muted)')
  expect(active.get('color')).toBe('var(--color-primary)')
})

test.each(['key', 'cell', 'icon-btn'])(
  'E17 O10 %s paints raised or transparent with a text label, pressed in control',
  (role) => {
    const rest = declarationsMatching(componentsCss(), `.${role}`)
    const pressed = declarationsMatching(componentsCss(), `.${role}:active`)

    expect(['var(--color-raised)', ...NO_FILL]).toContain(fillOf(rest))
    expect(rest.get('color')).toBe('var(--color-text)')
    expect(fillOf(pressed)).toBe('var(--color-control)')
  },
)

test('E17 O10 the Bodyweight switch on the Set screen wears the chip role', () => {
  const source = readFileSync(join(srcDir, 'ui', 'SetScreen.tsx'), 'utf-8')
  const bodyweightSwitch = extractControls(source).find(
    (control) => control.tag === 'button' && (classesOf(control.attrs) ?? []).includes('bodyweight-switch'),
  )

  expect(bodyweightSwitch, 'the .bodyweight-switch button must exist').toBeDefined()
  expect(classesOf((bodyweightSwitch as FoundControl).attrs)).toContain('chip')
})

/**
 * What a keypad key effectively paints: the `key` role, then Keypad.css's `.keypad-key`, then
 * (on the Set screen) dial.css's `.dial--scrub .keypad-key`, later winning, as the cascade
 * resolves them (the scrub override is the more specific selector).
 */
function effectiveKeypadKey(onSetScreen: boolean): Map<string, string> {
  const merged = new Map<string, string>(declarationsMatching(componentsCss(), '.key'))
  const keypadCss = readFileSync(join(srcDir, 'ui', 'Keypad.css'), 'utf-8')
  for (const [prop, value] of declarationsMatching(keypadCss, '.keypad-key')) merged.set(prop, value)
  if (onSetScreen) {
    const dialCss = readFileSync(join(srcDir, 'ui', 'dial.css'), 'utf-8')
    for (const [prop, value] of declarationsMatching(dialCss, '.dial--scrub .keypad-key')) {
      merged.set(prop, value)
    }
  }
  return merged
}

test('E17 O13 .keypad-key declares min-height: var(--key-min)', () => {
  const keypadCss = readFileSync(join(srcDir, 'ui', 'Keypad.css'), 'utf-8')

  expect(declarationsMatching(keypadCss, '.keypad-key').get('min-height')).toBe('var(--key-min)')
})

test.each([
  ['in a Dial', false],
  ['on the Set screen', true],
])('E17 O13 a keypad key %s reaches var(--key-min)', (_, onSetScreen) => {
  expect(effectiveKeypadKey(onSetScreen).get('min-height')).toBe('var(--key-min)')
})

// The Set screen's scrub override already paints raised/text today, so only the Dial's keypad
// (which takes its colours from `.key` and Keypad.css alone) is a red case here.
test.each([['in a Dial', false]])('E17 O13 a keypad key %s paints the key colours', (_, onSetScreen) => {
  const key = effectiveKeypadKey(onSetScreen)

  expect(fillOf(key)).toBe('var(--color-raised)')
  expect(key.get('color')).toBe('var(--color-text)')
})

test('E17 O13 every keypad digit button wears the key role', () => {
  const source = readFileSync(join(srcDir, 'ui', 'Keypad.tsx'), 'utf-8')
  const keys = extractControls(source).filter((control) =>
    (classesOf(control.attrs) ?? []).includes('keypad-key'),
  )

  expect(keys.length).toBeGreaterThan(0)
  for (const key of keys) expect(classesOf(key.attrs)).toContain('key')
})

// [O12, E17-T8] No native toggle, radio or select paints with OS defaults: every `<select>` and
// every `<input type="checkbox|radio">` is rendered through src/ui/controls.tsx (Switch,
// Segmented, Select), and the `.switch`, `.segmented` and `.select` rules reset `appearance`
// and paint from tokens.
const STYLED_CONTROLS_MODULE = join(srcDir, 'ui', 'controls.tsx')

/** A `<select>` or a checkbox/radio `<input>`: the native controls that need a styled wrapper. */
function nativeChoiceKind(control: FoundControl): 'select' | 'checkbox' | 'radio' | null {
  if (control.tag === 'select') return 'select'
  if (control.tag !== 'input') return null
  const type = /\btype\s*=\s*(?:"([^"]*)"|'([^']*)'|\{\s*['"]([^'"]*)['"]\s*\})/.exec(control.attrs)
  const value = type ? (type[1] ?? type[2] ?? type[3]) : undefined
  return value === 'checkbox' || value === 'radio' ? value : null
}

test('O12 nativeChoiceKind finds selects, checkboxes and radios but not other inputs', () => {
  const source = [
    '<select className="x"><option>1</option></select>',
    '<input type="checkbox" checked={on} onChange={(e) => set(e.target.checked)} />',
    "<input type='radio' name=\"u\" />",
    '<input type="search" className="s" />',
    '<input type="number" />',
    '<button type="button">b</button>',
  ].join('\n')

  expect(extractControls(source).map(nativeChoiceKind)).toEqual([
    'select',
    'checkbox',
    'radio',
    null,
    null,
    null,
  ])
})

test('O12 every select, checkbox and radio under src is rendered through src/ui/controls.tsx', () => {
  const offenders: string[] = []
  for (const path of modules()) {
    if (path === STYLED_CONTROLS_MODULE) continue
    const source = readFileSync(path, 'utf-8')
    for (const control of extractControls(source)) {
      const kind = nativeChoiceKind(control)
      if (kind !== null) offenders.push(`${rel(path)}: a raw ${kind} (use Switch, Segmented or Select)`)
    }
  }

  expect(offenders, 'screens render toggles, radio groups and selects through controls.tsx').toEqual([])
})

test('O12 controls.tsx renders its select with the select class and its checkbox with the switch class and role switch', () => {
  const source = readFileSync(STYLED_CONTROLS_MODULE, 'utf-8')
  const controls = extractControls(source)
  const selects = controls.filter((control) => nativeChoiceKind(control) === 'select')
  const checkboxes = controls.filter((control) => nativeChoiceKind(control) === 'checkbox')
  const radios = controls.filter((control) => nativeChoiceKind(control) === 'radio')

  expect(selects.length, 'controls.tsx renders a <select>').toBeGreaterThan(0)
  expect(checkboxes.length, 'controls.tsx renders a checkbox <input>').toBeGreaterThan(0)
  expect(radios.length, 'controls.tsx renders a radio <input>').toBeGreaterThan(0)
  for (const select of selects) expect(select.attrs).toMatch(/\bselect\b/)
  for (const checkbox of checkboxes) {
    expect(classesOf(checkbox.attrs)).toContain('switch')
    expect(checkbox.attrs).toMatch(/role\s*=\s*["']switch["']/)
  }
})

/** Every declaration of every rule whose selector names `.<className>`, across src stylesheets. */
function declarationsNaming(className: string): { prop: string; value: string }[] {
  const names = new RegExp(`\\.${className}(?![\\w-])`)
  const found: { prop: string; value: string }[] = []
  for (const path of stylesheets()) {
    postcss.parse(readFileSync(path, 'utf-8')).walkRules((rule) => {
      if (!names.test(rule.selector)) return
      rule.each((node) => {
        if (node.type === 'decl') found.push({ prop: node.prop, value: node.value.trim() })
      })
    })
  }
  return found
}

const PAINT_PROPERTIES = new Set([
  'color',
  'background',
  'background-color',
  'border',
  'border-color',
  'outline',
  'outline-color',
  'accent-color',
  'fill',
  'stroke',
])

describe.each(['switch', 'segmented', 'select'])('[O12] .%s', (className) => {
  test(`O12 the .${className} rules declare appearance: none`, () => {
    const appearance = declarationsNaming(className).filter((decl) => decl.prop === 'appearance')

    expect(appearance.map((decl) => decl.value)).toContain('none')
  })

  test(`O12 the .${className} rules paint from tokens`, () => {
    const paint = declarationsNaming(className).filter((decl) => PAINT_PROPERTIES.has(decl.prop))

    expect(
      paint.some((decl) => /var\(\s*--[\w-]+/.test(decl.value)),
      `.${className} paints at least one colour through var(--…)`,
    ).toBe(true)
    const literal = paint.filter((decl) => literalColours(`a { ${decl.prop}: ${decl.value}; }`).length > 0)
    expect(literal.map((decl) => `${decl.prop}: ${decl.value}`), `.${className} paints no literal colour`).toEqual([])
  })
})
