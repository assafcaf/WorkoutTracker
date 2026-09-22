/**
 * The whole app: loads the catalog and programs, resolves the active program, and renders the
 * picker or a route to Settings — or a hard-error screen when the programs fail to load.
 *
 * E1-T6 stub: not yet wired. The eventual implementation:
 *  - loads `loadCatalog()` / `loadPrograms(catalog)`; a thrown Error renders a `role="alert"`
 *    hard-error screen naming the problem, with no picker.
 *  - awaits `isStorageAvailable()`; when false, mounts `<StorageUnavailableBanner />` and
 *    disables the logging controls (e.g. by wrapping `<ProgramPicker>` in a disabled
 *    `<fieldset>`, since `ProgramPicker` itself takes no disabled prop).
 *  - awaits `getActiveProgramId(programs)`; when the stored id named a program no longer in
 *    `programs`, shows the fallback on screen (e.g. text matching /no longer/i).
 *  - renders `<ProgramPicker>` for the active program, plus a `button` named "Settings" that
 *    switches to `<Settings>` (with a `button` named "Back" to return to the picker).
 *    E1-T7 and E1-T8 extend this routing with the exercise list and the history list.
 */
export function App(): JSX.Element {
  return <div />
}
