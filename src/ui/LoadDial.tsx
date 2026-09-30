export type LoadDialProps = {
  /** The Exercise's weight step: the Rungs' spacing from -60 to +100 kg. */
  step: number
  /** The signed load in kg; 0 is plain bodyweight and reads `BW`. */
  value: number
  onChange(value: number): void
}

/**
 * The Load Dial under the reps Dial on a Bodyweight Exercise (E14-T14): a group "Load" with
 * "Decrease load" / "Increase load", a readout button "Load" (`BW`, `BW+10`, `BW−20`) and a
 * listbox "Load ladder" of `loadLadder(step)` Rungs.
 *
 * STUB (E14-T14 test-designer): not yet implemented.
 */
export function LoadDial(props: LoadDialProps): JSX.Element | null {
  void props
  return null
}
