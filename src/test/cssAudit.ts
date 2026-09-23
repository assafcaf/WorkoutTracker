// Test-only helpers that read the project's CSS as data. Never imported by shipped code.
//
// The design system is plain CSS with custom properties, which means the palette, the scales
// and the tap-target floor are text on disk — so a unit test can hold them to the documented
// set instead of trusting that a later task did not drift from it. These helpers are what the
// audits in src/styles/*.test.ts measure with.
//
// Parse with `postcss` (a direct devDependency for exactly this reason), not with hand-rolled
// regular expressions: a regex that "works" on today's file quietly stops seeing declarations
// the moment a rule is nested, a comment lands mid-declaration or a selector list wraps. The
// regexes below run only over a single declaration's value, which postcss has already handed
// over whole.
import postcss, { type Declaration, type Rule } from 'postcss'

/** Runs `visit` over every declaration in the stylesheet, in source order. */
function eachDeclaration(css: string, visit: (decl: Declaration, rule: Rule) => void): void {
  postcss.parse(css).walkRules((rule) => {
    rule.each((node) => {
      if (node.type === 'decl') visit(node, rule)
    })
  })
}

/** A rule's selector list, one trimmed selector per entry. */
function selectorsOf(rule: Rule): string[] {
  return rule.selector.split(',').map((selector) => selector.trim())
}

/**
 * The custom properties declared on `:root`, keyed by the full property name as written —
 * `--color-bg`, not `color-bg` — so callers name a token the way the CSS does. Values are
 * returned verbatim (trimmed), including ones that are not plain hex: `--font-sans`,
 * `--shadow-card` and `--safe-bottom`.
 */
export function readTokens(css: string): Map<string, string> {
  const tokens = new Map<string, string>()
  eachDeclaration(css, (decl, rule) => {
    if (!selectorsOf(rule).includes(':root')) return
    if (!decl.prop.startsWith('--')) return
    tokens.set(decl.prop.trim(), decl.value.trim())
  })
  return tokens
}

/** Every custom property name referenced through `var(--…)` anywhere in the stylesheet. */
export function referencedVars(css: string): Set<string> {
  const referenced = new Set<string>()
  eachDeclaration(css, (decl) => {
    for (const match of decl.value.matchAll(/var\(\s*(--[\w-]+)/g)) referenced.add(match[1])
  })
  return referenced
}

// A colour function call — `rgb(11, 11, 15)`, `hsla(210 10% 20% / 50%)` — as written.
const COLOUR_FUNCTION = /\b(?:rgba?|hsla?)\([^()]*\)/gi
// `#fff`, `#0B0B0F` and the alpha-carrying four- and eight-digit forms.
const HEX_COLOUR = /#[0-9a-f]{3,8}\b/gi
// A `var(--…)` reference, fallback and all, which is a token reference and not a colour.
const VAR_REFERENCE = /var\((?:[^()]|\([^()]*\))*\)/gi

// The CSS named colours. `transparent` and `currentColor` are deliberately absent: neither
// carries a palette value of its own, so neither is a definition site for a colour.
const NAMED_COLOURS = new Set(
  `aliceblue antiquewhite aqua aquamarine azure beige bisque black blanchedalmond blue
   blueviolet brown burlywood cadetblue chartreuse chocolate coral cornflowerblue cornsilk
   crimson cyan darkblue darkcyan darkgoldenrod darkgray darkgreen darkgrey darkkhaki
   darkmagenta darkolivegreen darkorange darkorchid darkred darksalmon darkseagreen
   darkslateblue darkslategray darkslategrey darkturquoise darkviolet deeppink deepskyblue
   dimgray dimgrey dodgerblue firebrick floralwhite forestgreen fuchsia gainsboro ghostwhite
   gold goldenrod gray green greenyellow grey honeydew hotpink indianred indigo ivory khaki
   lavender lavenderblush lawngreen lemonchiffon lightblue lightcoral lightcyan
   lightgoldenrodyellow lightgray lightgreen lightgrey lightpink lightsalmon lightseagreen
   lightskyblue lightslategray lightslategrey lightsteelblue lightyellow lime limegreen linen
   magenta maroon mediumaquamarine mediumblue mediumorchid mediumpurple mediumseagreen
   mediumslateblue mediumspringgreen mediumturquoise mediumvioletred midnightblue mintcream
   mistyrose moccasin navajowhite navy oldlace olive olivedrab orange orangered orchid
   palegoldenrod palegreen paleturquoise palevioletred papayawhip peachpuff peru pink plum
   powderblue purple rebeccapurple red rosybrown royalblue saddlebrown salmon sandybrown
   seagreen seashell sienna silver skyblue slateblue slategray slategrey snow springgreen
   steelblue tan teal thistle tomato turquoise violet wheat white whitesmoke yellow
   yellowgreen`.split(/\s+/),
)

/**
 * Every literal colour in the stylesheet's declaration values — hex, `rgb(`/`rgba(`,
 * `hsl(`/`hsla(` and CSS named colours — each as written. Empty means the file defines no
 * colour of its own and can only be getting them from a token.
 */
export function literalColours(css: string): string[] {
  const found: string[] = []
  eachDeclaration(css, (decl) => {
    // Take the functions and the hexes out as they are collected, so what is left to scan for
    // a bare colour name holds no `rgb` and no `#fff`. `var(--…)` goes too: a token reference
    // is not a definition site, whatever its name or its fallback says.
    const remainder = decl.value
      .replace(VAR_REFERENCE, ' ')
      .replace(COLOUR_FUNCTION, (colour) => {
        found.push(colour)
        return ' '
      })
      .replace(HEX_COLOUR, (colour) => {
        found.push(colour)
        return ' '
      })
    for (const word of remainder.match(/[a-z]+/gi) ?? []) {
      if (NAMED_COLOURS.has(word.toLowerCase())) found.push(word)
    }
  })
  return found
}

/**
 * The declarations that apply to one selector, merged across every rule that lists it,
 * later rules winning. Keyed by property name, values verbatim.
 */
export function declarationsFor(css: string, selector: string): Map<string, string> {
  const declarations = new Map<string, string>()
  eachDeclaration(css, (decl, rule) => {
    if (!selectorsOf(rule).includes(selector.trim())) return
    declarations.set(decl.prop.trim(), decl.value.trim())
  })
  return declarations
}

/** The three sRGB channels of an `#rgb` or `#rrggbb` colour, each from 0 to 1. */
function channels(hex: string): [number, number, number] {
  const digits = hex.trim().replace(/^#/, '')
  const pairs =
    digits.length === 3 || digits.length === 4
      ? [...digits.slice(0, 3)].map((digit) => digit + digit)
      : [digits.slice(0, 2), digits.slice(2, 4), digits.slice(4, 6)]
  const [red, green, blue] = pairs.map((pair) => parseInt(pair, 16) / 255)
  return [red, green, blue]
}

/** WCAG 2.1 relative luminance of an `#rrggbb` colour, 0 for black and 1 for white. */
export function relativeLuminance(hex: string): number {
  const [red, green, blue] = channels(hex).map((channel) =>
    channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4,
  )
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue
}

/** WCAG 2.1 contrast ratio between two `#rrggbb` colours, from 1:1 to 21:1. Order-free. */
export function contrastRatio(foreground: string, background: string): number {
  const one = relativeLuminance(foreground)
  const other = relativeLuminance(background)
  return (Math.max(one, other) + 0.05) / (Math.min(one, other) + 0.05)
}
