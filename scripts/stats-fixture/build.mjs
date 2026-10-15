// Builds the stats fixture (E18): the audit's 45-Session seed in app format, with the realism
// adjustments of docs/design/stats-2026-10/brief.md 1.3.1 applied, plus the expected values.
//
//   node scripts/stats-fixture/build.mjs [--out <dir>]
//
// Writes, to src/test/fixtures/stats/ (or <dir>):
//   sessions.json   45 Sessions, app format (src/types.ts Session), deload: true on Mon 21,
//                   Wed 23 and Fri 25 Sep
//   expected.json   the numbers a stats screen must show, from brief-data.json (the golden file)
// and the render states the render script seeds (scripts/render-states/, or <dir>/render-states/):
//   stats-45.json   all 45 Sessions, now = Thu 15 Oct 2026 18:05
//   stats-1.json    the first Session, now = Tue 23 Jun 2026 18:05
//   stats-3.json    the first 3 Sessions, now = Sat 27 Jun 2026 18:05
// A render state is { sessions, settings, now, timezone }: see scripts/render-route.mjs.
//
// Dates are Asia/Jerusalem, the zone the seed was written in. The output is deterministic.

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')
const designDir = join(root, 'docs/design/stats-2026-10')
const readJson = (p) => JSON.parse(readFileSync(p, 'utf8'))

const outArg = process.argv.indexOf('--out')
const outDir = outArg > 0 ? resolve(process.argv[outArg + 1]) : join(root, 'src/test/fixtures/stats')
const stateDir = outArg > 0 ? join(outDir, 'render-states') : join(root, 'scripts/render-states')

const seed = readJson(join(designDir, 'research/audit-shots/seed-app-format.json'))
const brief = readJson(join(designDir, 'brief-data.json'))
const steps = Object.fromEntries(readJson(join(root, 'src/data/exercises.json')).map((e) => [e.id, e.weightStep]))
steps['assisted-pull-ups'] = 2 // the seed moves assistance in 2 kg steps

const day = (ms) => new Date(ms).toLocaleDateString('sv-SE', { timeZone: 'Asia/Jerusalem' })
const clean = (n) => Number(n.toFixed(4))

const sessions = structuredClone(seed.sessions).sort((a, b) => a.startedAt - b.startedAt)
if (sessions.length !== brief.sessions.length) throw new Error('seed and brief-data disagree on the Session count')
sessions.forEach((s, i) => {
  if (day(s.startedAt) !== brief.sessions[i].date) throw new Error(`Session ${i} is not on ${brief.sessions[i].date}`)
})
const byDate = Object.fromEntries(sessions.map((s) => [day(s.startedAt), s]))

// 1. The deload week: working weights x0.9 rounded down to the step, assistance +2 kg (more
//    assistance), one working set fewer per exercise, RIR +1.
for (const date of ['2026-09-21', '2026-09-23', '2026-09-25']) {
  const s = byDate[date]
  s.deload = true
  const kept = []
  for (const id of [...new Set(s.entries.map((e) => e.exerciseId))]) {
    const mine = s.entries.filter((e) => e.exerciseId === id)
    const work = mine.filter((e) => e.kind !== 'warmup')
    const dropped = work[work.length - 1]
    for (const e of mine) {
      if (e === dropped) continue
      if (e.kind !== 'warmup') {
        if (e.weightKg != null) e.weightKg = clean(Math.floor((e.weightKg * 0.9) / steps[id] + 1e-9) * steps[id])
        else if (e.loadKg != null && e.loadKg < 0) e.loadKg -= 2
        if (e.rir != null) e.rir = Math.min(3, e.rir + 1)
      }
      kept.push(e)
    }
  }
  s.entries = kept
}

// 2. The regression: Narrow-grip pull-down.
const regress = {
  '2026-10-02': [[47.5, 10], [47.5, 9], [47.5, 8]],
  '2026-10-07': [[46.25, 10], [46.25, 9], [46.25, 9]],
  '2026-10-12': [[46.25, 9], [46.25, 8], [46.25, 8]],
}
for (const [date, sets] of Object.entries(regress)) {
  const mine = byDate[date].entries.filter((e) => e.exerciseId === 'narrow-grip-pull-down')
  if (mine.length !== sets.length) throw new Error(`pull-down on ${date}: ${mine.length} sets, expected ${sets.length}`)
  mine.forEach((e, i) => {
    e.weightKg = sets[i][0]
    e.reps = sets[i][1]
  })
}

// 3. Notes: the brief's, which moves two off B days and adds the deload and elbow notes.
sessions.forEach((s, i) => {
  const note = brief.sessions[i].note
  if (note) s.note = note
  else delete s.note
  if (brief.sessions[i].deload !== (s.deload === true)) throw new Error(`deload flag differs on ${brief.sessions[i].date}`)
})

const write = (dir, name, text) => {
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, name), text)
}
const sessionsJson = '[\n' + sessions.map((s) => JSON.stringify(s)).join(',\n') + '\n]\n'
write(outDir, 'sessions.json', sessionsJson)

const { about: _about, ...expected } = brief
write(outDir, 'expected.json', JSON.stringify(expected, null, 1) + '\n')

const cuts = [
  ['stats-45', sessions.length, '2026-10-15T18:05:00+03:00'],
  ['stats-1', 1, '2026-06-23T18:05:00+03:00'],
  ['stats-3', 3, '2026-06-27T18:05:00+03:00'],
]
for (const [name, n, now] of cuts) {
  const state = { now, timezone: 'Asia/Jerusalem', dpr: 2, settings: seed.settings, sessions: sessions.slice(0, n) }
  write(stateDir, `${name}.json`, JSON.stringify(state, null, 1) + '\n')
}
