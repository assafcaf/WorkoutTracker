import { useState } from 'react'
import type { Reminders } from '../contract'
import type { PushTestOutcome } from '../services/push'
import { Icon } from './icons'
import { SettingsPage } from './SettingsPage'
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

/** DX-23: what an unavailable Reminders row says after its name, in a few words. */
const SHORT_REASONS: Partial<Record<NotificationStatus, string>> = {
  unsupported: 'Not available in this browser',
  'not-installed': 'Add to Home Screen to turn on',
  denied: 'Blocked in iOS Settings',
  unconfigured: 'Not set up yet',
  'signed-out': 'Sign in to turn on',
}

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
 * The Reminders group (E24-T9, O25, O26; V2-09 folded Notifications into it). DX-23: while push
 * cannot work here, the group is one row -- "Reminders · Add to Home Screen to turn on ›" --
 * opening a short how-to; while it is off, one "Turn on notifications" row; only with push on do
 * the reminder weekdays (a 7-column row of 44 px chips) and time show. No disabled control shows.
 */
export function NotificationSettings(props: NotificationSettingsProps): JSX.Element {
  const { status, failed, onEnable, onDisable, onTest, testResult, reminders, onRemindersChange, weekStart = 1 } = props
  const [draftDays, setDraftDays] = useState<number[]>([])
  const [draftTime, setDraftTime] = useState(DEFAULT_TIME)
  const [howTo, setHowTo] = useState(false)
  const on = status === 'on'
  const days = reminders?.days ?? draftDays
  const time = reminders?.time ?? draftTime
  const reason = SHORT_REASONS[status]
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
    // V2-09: Notifications and Reminders are one group, as one card: turn push on, then when.
    <section className="settings-group" aria-label="Reminders">
      {/* DX-23: while unavailable, the one Reminders row names the group itself. */}
      {reason ? null : <h2 className="settings-legend">Reminders</h2>}
      <div className="settings-card">
        {reason ? (
          <button
            type="button"
            className="settings-action btn-quiet"
            aria-haspopup="dialog"
            onClick={() => setHowTo(true)}
          >
            <span className="settings-action-label">Reminders</span>
            <span className="settings-action-value">{reason}</span>
            <Icon name="ChevronRight" size={18} />
          </button>
        ) : null}
        {status === 'off' ? (
          <button type="button" className="settings-action btn-quiet" onClick={onEnable}>
            <span className="settings-action-label">Turn on notifications</span>
          </button>
        ) : null}
        {failed && status === 'off' ? (
          <p className="settings-action notify-note">Notifications could not be turned on. Try again.</p>
        ) : null}
        {on ? (
          <>
            <div className="settings-action notify-days" role="group" aria-label="Reminder days">
              {Array.from({ length: 7 }, (_unused, i) => (weekStart + i) % 7).map((day) => (
                <button
                  key={day}
                  type="button"
                  className="chip notify-chip"
                  aria-label={WEEKDAYS[day]}
                  aria-pressed={days.includes(day)}
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
                onChange={(event) => {
                  if (!event.target.value) return
                  if (days.length === 0) setDraftTime(event.target.value)
                  else change(days, event.target.value)
                }}
              />
            </label>
            {reminders ? (
              <button type="button" className="settings-action btn-quiet" onClick={() => change([], time)}>
                <span className="settings-action-label">Off</span>
              </button>
            ) : null}
            {onTest ? (
              <button type="button" className="settings-action btn-quiet" onClick={onTest}>
                <span className="settings-action-label">Send a test notification</span>
              </button>
            ) : null}
            {testResult ? <p className="settings-action notify-note">{testLine(testResult)}</p> : null}
            <button type="button" className="settings-action btn-quiet" onClick={onDisable}>
              <span className="settings-action-label">Turn off notifications</span>
            </button>
          </>
        ) : null}
      </div>
      {howTo && explanation ? (
        <SettingsPage title="Reminders" onBack={() => setHowTo(false)}>
          <p className="notify-howto">{explanation}</p>
        </SettingsPage>
      ) : null}
    </section>
  )
}
