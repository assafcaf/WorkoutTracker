// Ambient types for the `jsdom` devDependency. jsdom ships no types of its own and
// `@types/jsdom` is not installed; only `src/pwa/offline.test.ts` imports it directly, to put
// the app that came out of the service worker's cache into a window of its own. Declared here
// rather than adding a types package for one test file.
declare module 'jsdom' {
  export type JSDOMOptions = {
    /** The document's URL, which decides how relative URLs inside it resolve. */
    url?: string
    /** 'outside-only' gives the window a JS realm and `eval`, but runs no <script> itself. */
    runScripts?: 'dangerously' | 'outside-only'
    /** Supplies requestAnimationFrame and friends. */
    pretendToBeVisual?: boolean
  }

  export class JSDOM {
    constructor(html?: string, options?: JSDOMOptions)
    readonly window: Window & typeof globalThis
  }
}
