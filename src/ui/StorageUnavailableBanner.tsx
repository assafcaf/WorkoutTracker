/**
 * Tells the trainee that sets cannot be saved, shown when `isStorageAvailable()` is false.
 *
 * Presentational: it holds no state, reads no storage and takes no props. E1-T6 decides when
 * to mount it and disables the logging controls alongside it.
 */
export function StorageUnavailableBanner(): JSX.Element {
  return <div />
}
