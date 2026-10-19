import { useState } from 'react'
import type { Reminders } from '../contract'
import type { PushTestOutcome } from '../services/push'
import './NotificationSettings.css'

export type NotificationStatus =
  | 'unsupported'
  | 'not-installed'
  | 'denied'
  | 'on'
  | 'off'
  | 'unconfigured'
  | 'signed-out'

export type NotificationSettingsProps = {
  status: NotificationStatus
  /** The last attempt to turn notifications on did not work; shown as one line. */
  failed?: boolean
  onEnable(): void
  onDisable(): void
  /** Taps Send a test notification; shown with push on. */
  onTest?(): void
  /** The last test's answer, shown as one line under the button. */
  testResult?: PushTestOutcome | null
  reminders: Reminders | null
  onRemindersChange(value: Reminders | null): void
  /** The first day of the week, 0 = Sunday ... 6 = Saturday; omitted reads as Monday. */
  weekStart?: number
}

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const DEFAULT_TIME = '18:00'

const EXPLANATIONS: Partial<Record<NotificationStatus, string>> = {
  unsupported: "This browser can't send notifications.",
  'not-installed': 'Add this app to your Home Screen and open it from there to turn on notifications.',
  denied: 'Notifications are blocked. Turn them on for this app in iOS Settings.',
  unconfigured: "Notifications aren't set up on the server yet.",
  'signed-out': 'Sign in to turn on notifications.',
}

/** The one line under Send a test notification. */
function testLine(outcome: PushTestOutcome): string {
  if ('error' in outcome) return `Failed: ${outcome.error}`
  if (outcome.subscriptions === 0) return 'No device is subscribed. Turn notifications off and on again.'
  const bad = outcome.results.find((r) => r.result !== 'sent')
  if (bad) return `Failed: ${[bad.status, bad.reason].filter((p) => p !== null && p !== '').join(' ')}`.trimEnd()
  return `Sent to ${outcome.subscriptions} ${outcome.subscriptions === 1 ? 'device' : 'devices'}`
}

/**
 * The Notifications section (E24-T9, O25, O26): one tap to turn push on when it can work, one
 * line saying why when it can't, and, with push on, the reminder weekdays and time.
 */
export function NotificationSettings(props: NotificationSettingsProps): JSX.Element {
  const { status, failed, onEnable, onDisable, onTest, testResult, reminders, onRemindersChange, weekStart = 1 } = props
  const [draftDays, setDraftDays] = useState<number[]>([])
  const [draftTime, setDraftTime] = useState(DEFAULT_TIME)
  const on = status === 'on'
  const days = reminders?.days ?? draftDays
  const time = reminders?.time ?? draftTime
  const explanation = EXPLANATIONS[status]

  function change(nextDays: number[], nextTime: string): void {
    setDraftDays(nextDays)
    setDraftTime(nextTime)
    if (nextDays.length === 0) {
      onRemindersChange(null)
      return
    }
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone
    onRemindersChange({ days: [...nextDays].sort((a, b) => a - b), time: nextTime, timeZone })
  }

  function toggle(day: number): void {
    change(days.includes(day) ? days.filter((d) => d !== day) : [...days, day], time)
  }

  return (
    <>
      <section className="settings-group" aria-label="Notifications">
        <h2 className="settings-legend">Notifications</h2>
        <div className="settings-card card">
          {explanation ? <p className="settings-action notify-note">{explanation}</p> : null}
          {status === 'off' ? (
            <button type="button" className="settings-action btn-quiet" onClick={onEnable}>
              <span className="settings-action-label">Turn on notifications</span>
            </button>
          ) : null}
          {on ? (
            <button type="button" className="settings-action btn-quiet" onClick={onDisable}>
              <span className="settings-action-label">Turn off</span>
            </button>
          ) : null}
          {on && onTest ? (
            <button type="button" className="settings-action btn-quiet" onClick={onTest}>
              <span className="settings-action-label">Send a test notification</span>
            </button>
          ) : null}
          {on && testResult ? <p className="settings-action notify-note">{testLine(testResult)}</p> : null}
          {failed && status === 'off' ? (
            <p className="settings-action notify-note">Notifications could not be turned on. Try again.</p>
          ) : null}
        </div>
      </section>
      <section className="settings-group" aria-label="Reminders">
        <h2 className="settings-legend">Reminders</h2>
        <div className="settings-card card">
          {!on ? <p className="settings-action notify-note">Turn on notifications first</p> : null}
          <div className="settings-action notify-days">
            {Array.from({ length: 7 }, (_unused, i) => (weekStart + i) % 7).map((day) => (
              <button
                key={day}
                type="button"
                className="chip notify-chip"
                aria-label={WEEKDAYS[day]}
                aria-pressed={on && days.includes(day)}
                disabled={!on}
                onClick={() => toggle(day)}
              >
                {WEEKDAYS[day].slice(0, 3)}
              </button>
            ))}
          </div>
          <label className="settings-action">
            <span className="settings-action-label">Time</span>
            <input
              className="notify-time"
              type="time"
              value={time}
              disabled={!on}
              onChange={(event) => {
                if (!event.target.value) return
                if (days.length === 0) setDraftTime(event.target.value)
                else change(days, event.target.value)
              }}
            />
          </label>
          {on && reminders ? (
            <button type="button" className="settings-action btn-quiet" onClick={() => change([], time)}>
              <span className="settings-action-label">Off</span>
            </button>
          ) : null}
        </div>
      </section>
    </>
  )
}
