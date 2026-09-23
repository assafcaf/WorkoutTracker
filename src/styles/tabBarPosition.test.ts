// fix-layout [G3]: the tab bar sits at the top, audited as data -- the same pattern
// src/styles/overlay.test.ts already uses to read src/ui/TabBar.css, per
// docs/decisions/0004-one-palette-one-shell-audited-as-data.md.
//
// Defect (operator, iPhone): "The bar must be at the top and not the bottom." Before this task
// src/ui/TabBar.css's `.tab-bar` is `position: sticky; bottom: 0; padding-bottom:
// var(--safe-bottom);`. This holds it to `position: fixed` (the only mechanism that pins it to
// the very top of the viewport from the first frame, regardless of where it sits in the DOM --
// a sticky bar would need to be the first thing in document flow to behave the same way, and
// src/ui/AppShell.tsx renders it last), `top: 0` and no `bottom`, clearing `--safe-top` instead
// of `--safe-bottom`. Because a fixed bar is taken out of document flow, `.app-shell` (the
// shell's own outer container, src/ui/AppShell.css) must reserve top clearance so the header
// does not render underneath it -- reusing `--tap-min` (the bar's own tap-target floor,
// src/ui/TabBar.css's `.tab-bar-tab`) rather than inventing a new token, so the documented
// thirty-six-token set (src/styles/tokens.test.ts) does not have to grow for this.
//
// Untouched by this file, and proven elsewhere:
// - Tab order/names/click wiring and the five-tab count: src/ui/AppShell.test.tsx.
// - `.tab-bar-tab`'s min-height: var(--tap-min) tap-target floor: src/styles/cssAudit.test.ts's
//   O4, off the bare `.tab-bar-tab` selector this task does not touch.
// - The overlay layer sitting above the bar: src/styles/overlay.test.ts's z-index comparison,
//   which by its own design "makes no assumption about where the tab bar sits" and needs no
//   change here.
// - src/ui/AppShell.test.tsx's "AppShell lays the header, the main region, the action bar and
//   the tab bar out in that order" asserts document order, not visual position, and stays true
//   unchanged: `.tab-bar` moves to the top of the *viewport* through `position: fixed`, not by
//   moving earlier in the DOM.
import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { expect, test } from 'vitest'
import { declarationsFor } from '../test/cssAudit'

// src/styles/tabBarPosition.test.ts -> the repository root.
const repoRoot = resolve(fileURLToPath(import.meta.url), '..', '..', '..')
const srcDir = join(repoRoot, 'src')
const tabBarPath = join(srcDir, 'ui', 'TabBar.css')
const appShellPath = join(srcDir, 'ui', 'AppShell.css')

function tabBarDeclarations(): Map<string, string> {
  return declarationsFor(readFileSync(tabBarPath, 'utf-8'), '.tab-bar')
}

function appShellDeclarations(): Map<string, string> {
  return declarationsFor(readFileSync(appShellPath, 'utf-8'), '.app-shell')
}

function tabBarTabDeclarations(): Map<string, string> {
  return declarationsFor(readFileSync(tabBarPath, 'utf-8'), '.tab-bar-tab')
}

test('G3 .tab-bar is pinned to the top of the viewport with position: fixed; top: 0, and declares no bottom offset', () => {
  const declared = tabBarDeclarations()

  expect(declared.get('position'), '.tab-bar must declare position: fixed').toBe('fixed')
  expect(declared.get('top'), '.tab-bar must sit at top: 0').toMatch(/^0(px)?$/)
  expect(declared.get('bottom'), '.tab-bar must no longer declare a bottom offset').toBeUndefined()
})

test('G3 .tab-bar clears the top safe-area inset instead of the bottom one', () => {
  const declared = tabBarDeclarations()
  const values = [...declared.values()].join(' ')

  expect(values, '.tab-bar must clear --safe-top now that it sits at the top').toMatch(
    /var\(\s*--safe-top\s*\)/,
  )
  expect(
    values,
    '.tab-bar must no longer clear --safe-bottom -- that inset belongs to a bar at the bottom',
  ).not.toMatch(/var\(\s*--safe-bottom\s*\)/)
})

test('G3 .app-shell reserves top clearance so its header and content do not render underneath the fixed tab bar', () => {
  const declared = appShellDeclarations()
  const paddingTop = declared.get('padding-top')

  expect(
    paddingTop,
    '.app-shell must declare its own padding-top (not folded into a padding shorthand) to account for the tab bar',
  ).toBeDefined()
  expect(paddingTop).toMatch(/var\(\s*--tap-min\s*\)/)
})

// [G3b, fix-layout follow-up] The bar's own rendered height is not just --tap-min: TabBar.css's
// `.tab-bar` also carries `padding-top: var(--safe-top)` (G3's own top-safe-area clearance), so
// on a notched iPhone the fixed bar is taller than --tap-min alone by however tall the notch
// inset is. `.app-shell`'s padding-top must account for *both* -- --tap-min alone (what the
// test above still, correctly, requires) is not sufficient on its own: it passes even when
// --safe-top is left out of the calc, which is exactly the bug a code review caught in the
// merged fix (src/ui/AppShell.css's `.app-shell { padding-top: var(--tap-min); }` never
// references --safe-top at all). This test is strictly stronger than the one above and must
// keep passing together with it.
test('G3b .app-shell top clearance accounts for --safe-top as well as --tap-min, matching the bar’s own rendered height', () => {
  const declared = appShellDeclarations()
  const paddingTop = declared.get('padding-top')

  expect(
    paddingTop,
    '.app-shell must declare its own padding-top to account for the fixed tab bar',
  ).toBeDefined()
  expect(
    paddingTop,
    '.app-shell padding-top must reference --tap-min (the bar’s own tap-target floor)',
  ).toMatch(/var\(\s*--tap-min\s*\)/)
  expect(
    paddingTop,
    '.app-shell padding-top must also reference --safe-top -- the bar itself pads its top by --safe-top (TabBar.css), so clearance that only accounts for --tap-min is too short on a notched device',
  ).toMatch(/var\(\s*--safe-top\s*\)/)
})

// [O11, fix-the-ui-audit] --tap-min alone (44px) is shorter than what `.tab-bar-tab` actually
// renders at once its padding and gap are counted, so a screen's header title can still sit
// partly under the bar even with G3b's fix in place. `.tab-bar-tab` gets an explicit `height`
// that is the bar's true rendered height, and `.app-shell`'s padding-top must clear exactly
// that height plus --safe-top -- the same expression, so the two can never drift apart again.
test('O11 .tab-bar-tab declares a height and .app-shell padding-top clears that height plus --safe-top, using the same expression', () => {
  const tabTabHeight = tabBarTabDeclarations().get('height')
  expect(tabTabHeight, '.tab-bar-tab must declare an explicit height').toBeDefined()

  const paddingTop = appShellDeclarations().get('padding-top')
  expect(paddingTop, '.app-shell must declare its own padding-top').toBeDefined()

  const heightExpression = (tabTabHeight as string).replace(/^calc\((.*)\)$/, '$1').trim()
  expect(
    paddingTop,
    '.app-shell padding-top must equal .tab-bar-tab’s own height expression plus --safe-top',
  ).toBe(`calc(${heightExpression} + var(--safe-top))`)
})

test('O11 .tab-bar-tab’s height expression names only existing tokens', () => {
  const tabTabHeight = tabBarTabDeclarations().get('height') as string

  expect(tabTabHeight).toMatch(/var\(\s*--tap-min\s*\)/)
  expect(
    [...tabTabHeight.matchAll(/var\(\s*(--[\w-]+)/g)].map((match) => match[1]),
    'the height expression must reference no token besides --tap-min and --space-3',
  ).toEqual(['--tap-min', '--space-3'])
})
