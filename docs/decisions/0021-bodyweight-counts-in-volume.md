# 0021. Bodyweight counts in kg volume once the trainee has weighed in

Date: 2026-10-18 · Status: accepted · Tracker: E22 · Amends: 0017 (0017 stays accepted)

## Context
E18 (decision 0017) kept kg volume to loaded Sets: a Bodyweight Set counted reps only, because
no body mass was known. E22 adds a body log, so Pull-ups and assisted lifts can count kilograms.

## Decision
- **The rule.** With a bodyweight, a Bodyweight Exercise's working Set counts
  `max(0, bodyweight + loadKg) x reps` kg, so Pull-up BW+10 x 8 at 80 kg is 720 and an assisted
  BW-20 x 10 is 600. Those Sets stop counting as `bodyweightReps`. Warm-ups never count.
- **Which bodyweight.** The latest body-log entry on or before the Session's day
  (`bodyweightOn`). Before the first weigh-in the Session counts reps only, as before.
- **Where.** `sessionVolume(session, resolve, bodyweightKg = null)`, `volumeSeries(..., log)`,
  `volumeLine(..., log)` (each Session at its own bodyweight) and `liveProgress({ bodyweightKg })`.
  Callers that pass nothing keep today's figures. Per-Exercise volume (`exerciseVolume`) is unchanged.

## Consequences
Past Sessions' volume moves when an earlier weigh-in is logged or removed; nothing is stored.

## Outcome
Built as E22 (11 tickets on `epic/E22-body-and-deeper-stats`; evidence in `.work/runs/E22/`), with
roadmap R7: a body log (bodyweight and optional measurements) as the synced `bodyLog` setting and a
Body page in Progress; bodyweight counted in Session, series, summary and live volume; tappable bar
and line charts with **Open session**; the Sessions tab calendar days coloured by Workout and
tappable; Progress home's **Last week** card against the trainee's week start; and tappable body maps
on the Program tab. Departures: there is no Stats tab any more, so everything lands in Progress; the
"month calendar in History" is the shipped six-week grid made tappable; bodyweight is logged on the
Body page only; per-Exercise volume and lift series keep reps or signed load.
