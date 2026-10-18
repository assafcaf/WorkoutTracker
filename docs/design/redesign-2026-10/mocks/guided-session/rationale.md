# Guided Session: rationale (revision 2)

The app works like a coach. Today reads the plan in a sentence, the workout is a stream of steps on a rail, and History and Progress read as a training journal.

## Key decisions

1. **The rail is the session.** A 2 px rail at x = 28 has ✓ nodes for done steps, a 12 px oxblood dot for the current step and hollow nodes for upcoming ones. Done steps compress to read-only 40 px lines, with a fixed 76 px label column.
2. **Confirm or adjust.** One 64 px bar, `Done · 62.5 × 8`, logs the set as planned. Tapping the values opens the Adjust sheet: set type, 64 px steppers and a keypad. To fix a logged set, use ⋯ → `Edit logged sets`, a sheet with 56 px rows. This replaces the tappable 40 px lines and resolves the tap-target conflict.
3. **Workout mode is crisp, not warm.**
   - Serif is limited to one coach line per screen (on the set card, or the Finish card).
   - The rest coach line is set in Plex 17.
   - Active cards are white.
   - The PR banner is a white inset with a 3 px accent rule.
   - The set-3 line gets a 2 px rule and the `PR` tag; there are no peach fills.
4. **Rest is a step.** It has an 80 px timer, ±15 s and an accent drain bar. At 0:00 the stream scrolls itself to set 4. The Finish card collapses the last exercise and carries its effort chips.
5. **A hub with no tab bar.** Today has three states:
   - before the workout: `Start Workout A`;
   - paused: the Resume card, `1 of 7 exercises · 14 min`, and the next step in the paragraph;
   - finished: `Workout A, done.`, with Workout B on Thursday and `Not synced · saved on this phone · Retry` as the error state in P.
6. **Journal, not a dashboard.** History opens with a narrative sentence, and the volume chart follows as evidence. Weeks read as entries, each with a coach summary and its sessions. This week's muscle map and family bars sit inside the This-week entry. Progress leads with `Back squat e1RM up 8.3 kg in three weeks.`, then the chart, then records as dated entries and the other lifts as one-line deltas.
7. **Type roles are strict.** Newsreader is used for at most two elements outside workout mode and one inside. Figures in serif sentences are set as whole Plex spans that do not wrap (`60 × 10`, `9,840 kg`). The simulation awards PRs only on Back squat, matching the canonical summary.

## Checklist (principles §5): an honest self-check

| # | Result | Evidence |
|---|---|---|
| 1 | Pass | Measured share of pixels that are neither warm-chroma nor family-coloured: S3 92.3%, S4 91.5%, S5a 91.4%, F2 91.4%, S5b 91.2%, S6a 97.6%. |
| 2 | Pass | The accent appears only on the primary bar, current node, focus, active tab and segment, the chosen RIR chip, and the PR tag and rule. `Edit`, `Save`, `Add exercise…` and the rest offer are ink. The Plates sheet closes with an outline button. |
| 3 | Pass | Family colours only in bars and 8 px dots; the heat ramp only in body maps. |
| 4 | Pass | S3 uses 12/15/17/20/22/64 and S4 uses 12/15/17/22/80, with weights 400/500/600. |
| 5 | Pass | Tabular figures throughout. The × sits inside the Plex span. |
| 6 | Pass | Cards 8, sheet tops 12, buttons, chips and tokens 6, inputs, tags and the PR inset 4. Pills only on toggles. |
| 7 | Pass | No decoration. The silhouette has a smaller head, no neck block and narrower shoulders. |
| 8 | Pass | Fixed 76 px label column in the stream; chart right padding is 24. |
| 9 | Pass | Hairlines everywhere; one shadow, on sheets. |
| 10 | Pass | Lucide geometry, with the stroke attribute scaled so every icon renders a 1.5 px line. The status-bar glyphs are system glyphs. |
| 11 | Pass | Verb-led, sentence case, no exclamation marks. |
| 12 | Pass | Values 64 px; timer 80 px. |
| 13 | Pass | In-workout numerals are in ink (14.8:1) or secondary (8.7:1). `New PR` is accent on white, 9.4:1. Muted is used only for units and caps labels. |
| 14 | Pass | Done lines are not tap targets. Edits use 56 px rows, the Session plan back button is 56 px, and keypad keys are 64 px with 8 px gaps. |
| 15 | Pass | Full-width 64 px bar at y 738–802. |
| 16 | Pass | Rare and destructive actions are in ⋯. Discard is in danger with an icon. |
| 17 | Pass | The card shows exercise, set n/N, one coach line, values, target, last time and the primary. |
| 18 | n/a | Light only. |
| 19 | Pass | Full-screen stream; Pause leads to the Resume card. |
| 20 | Pass | One accent bar per frame. The post-session Today's primary is `Retry sync` while unsynced; once synced there is no primary (a rest day). |
| 21 | Pass | `Done` logs the set and starts rest. |
| 22 | Pass | 2 taps (Start Workout A → Begin). |
| 23 | Pass | Undo snackbars; the only confirm is Finish early. |
| 24 | Pass | Short tools are sheets, plans and pages are full screen, and sheets never stack. |
| 25 | Pass | Empty and offline, PR, over-time, post-session and sync error. |

Known limits:
- S7b is scrolled to the end of Workout A so that `Add exercise…`, drag handles and remove show above the sets sheet. The header tokens (`[A/B Split]`, `[Three] sessions a week`, on one line) appear in P.
- The static S6a shows the session rows only partly; the page scrolls in P.

## Tap counts

| Task | Taps | Sequence |
|---|---|---|
| Start today's workout | 2 | Start Workout A → Begin |
| Log a set as planned | 1 | Done · 62.5 × 8 |
| Change weight one step, then log | 3 | Values → + → Done · 65 × 8 |
| Type a weight, then log | 5 | Values → number → 6 → 5 → Done |
| Finish, all sets done | 1 | Finish workout card → primary |
| Finish early | 3 | ⋯ → Finish early → Finish workout |

## Shades changed or added (revision 2, at the reviewer's art-direction request)

| Role | Hex | Contrast |
|---|---|---|
| page (cooler) | `#F5F6F8` | muted 5.42:1, secondary 8.66:1, ink 14.77:1 on it |
| fill | `#ECEEF1` | muted 5.04:1 on it |
| hairline | `#E0E3E8` | graphic only |
| border | `#C2C7CF` | graphic only |
| accent (deeper oxblood, was `#9A3412`) | `#7F2A0E` | white on it 9.38:1; as text 8.67:1 on page |
| accent pressed | `#651F09` | darker still |
| accent tint (now unused on large areas) | `#F6ECE8` | — |
| Workout B bars | `#B4B9C2` | 1.97:1 on white; graphic, labelled by a legend |
| snackbar | `#14213D` with `#FBEDE6` action | 13.96:1 |
| scrim | ink at 40% | — |
