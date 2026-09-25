/**
 * Three short beeps that mark a rest period running out (E8-T5, spec O10).
 *
 * One `AudioContext` is made lazily, on the first `unlockRestSound()` call -- which the set
 * screen makes on every `Log set` press, so the context exists (and is running) by the time a
 * rest period can end, satisfying iOS's rule that audio only starts from a user gesture. Where
 * `AudioContext` does not exist on this host, both functions are silent no-ops.
 */

export function unlockRestSound(): void {
  throw new Error('not implemented')
}

export function playRestOver(): void {
  throw new Error('not implemented')
}
