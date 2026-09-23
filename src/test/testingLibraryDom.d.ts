// `@testing-library/dom` 10.4.0's own `ByRoleOptions` type omits `exact`, even though the
// installed runtime (`dist/queries/role.js`) already matches `name` exactly by default and
// simply ignores an `exact` key passed alongside it -- so `{ name, exact: true }` behaves the
// same as `{ name }` at runtime, but fails `tsc` as an excess property. Augmented here, rather
// than dropped from the call sites that pass it (E5-T15's tests), so a literal `exact: true`
// stays legible next to `getByText`'s, which does support it.
import '@testing-library/dom'

declare module '@testing-library/dom' {
  interface ByRoleOptions {
    exact?: boolean
  }
}
