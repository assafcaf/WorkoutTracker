import { Switch } from './controls'
import './Settings.css'

export type GymEquipmentSwitchesProps = {
  /** Every equipment type the library carries, except `body only` (E5-T16), in the order given. */
  equipmentTypes: string[]
  /**
   * The gym's saved equipment, or `null` when nothing has been saved yet -- rendered as every
   * type in `equipmentTypes` switched on (E5-T16).
   */
  gymEquipment: string[] | null
  /** Called with the next full gym equipment list when a type is switched. */
  onChange(list: string[]): void
}

/**
 * "My gym's equipment" (E5-T16): a switch per equipment type, on when `gymEquipment` is `null`
 * (nothing saved yet, so everything counts as available) or includes the type. Switching one
 * reports the next full list: the effective list (`gymEquipment ?? equipmentTypes`) with the
 * type added or removed. It lives on Program › Exercises, beside the "My gym only" chip it
 * feeds (V2-09), rather than in Settings.
 */
export function GymEquipmentSwitches({ equipmentTypes, gymEquipment, onChange }: GymEquipmentSwitchesProps): JSX.Element {
  function toggle(type: string): void {
    const effective = gymEquipment ?? equipmentTypes
    onChange(effective.includes(type) ? effective.filter((item) => item !== type) : [...effective, type])
  }
  return (
    <fieldset className="settings-group" aria-label="My gym's equipment">
      <div className="settings-card">
        {equipmentTypes.map((type) => (
          <div key={type} className="settings-action">
            <Switch
              checked={gymEquipment === null || gymEquipment.includes(type)}
              onChange={() => toggle(type)}
              label={type}
            />
          </div>
        ))}
      </div>
    </fieldset>
  )
}
