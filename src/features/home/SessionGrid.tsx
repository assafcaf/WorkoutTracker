import type { HomeCalendar } from './homeModel'

/**
 * Twelve weeks of the A/B calendar (home.md §2, Block 3): one column per week, the week's first
 * day on top. A Session day is filled in its workout's colour -- the Sessions calendar's own
 * tokens (`workoutToneAt`) -- an empty day is heat-0, today is outlined in live and future days
 * are blank. Month labels sit under the columns where a month starts.
 */
export function SessionGrid({ calendar }: { calendar: HomeCalendar }): JSX.Element {
  return (
    <span className="home-grid-wrap">
      <span className="home-grid" role="img" aria-label={`${calendar.count} sessions in the last 12 weeks`}>
        {calendar.weeks.map((week) =>
          week.days.map((day) => (
            <span
              key={day.at}
              className="home-grid-day"
              data-tone={day.tone ?? undefined}
              data-today={day.today && day.tone === null ? 'true' : undefined}
              data-future={day.future ? 'true' : undefined}
            />
          )),
        )}
      </span>
      <span className="home-grid-months" aria-hidden="true">
        {calendar.months.map((month, i) => (
          <span key={i} className="home-grid-month">
            {month}
          </span>
        ))}
      </span>
    </span>
  )
}
