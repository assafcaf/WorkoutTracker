"""Build docs/design/stats-2026-10/brief-data.json from research/dataset.json plus the brief's
realism adjustments (brief.md 1.3). Run from the repo root:
python docs/design/stats-2026-10/brief-data.py"""
import json, sys, math, copy, datetime as dt
sys.stdout.reconfigure(encoding='utf-8')

SRC = 'docs/design/stats-2026-10/research/dataset.json'
OUT = 'docs/design/stats-2026-10/brief-data.json'
d = json.load(open(SRC, encoding='utf-8'))
prog = json.load(open('src/data/programs/assaf-ab-2026.json', encoding='utf-8'))
cat = {e['id']: e for e in json.load(open('src/data/exercises.json', encoding='utf-8'))}
libl = json.load(open('src/data/library/exercises.json', encoding='utf-8'))
lib = {e['id']: e for e in (libl if isinstance(libl, list) else libl.values())}

plan = {}
order = []
for w in prog['workouts']:
    for x in w['exercises']:
        plan[x['exerciseId']] = {'workout': w['name'][-1], 'sets': x['sets'], 'range': x['repRange']}
        order.append(x['exerciseId'])
STEP = {k: cat[k]['weightStep'] for k in cat}
STEP['assisted-pull-ups'] = 2  # the seed moves assistance in 2 kg steps
MUSCLES = ['chest', 'shoulders', 'triceps', 'lats', 'middle back', 'biceps', 'quadriceps',
           'hamstrings', 'glutes', 'calves', 'lower back', 'abdominals']
OTHER = ['forearms', 'traps']
def musc(eid):
    e = lib[cat[eid]['libraryId']]
    return e['primaryMuscles'], e['secondaryMuscles']
E1RM_LIFTS = [k for k in order if plan[k]['range'][1] <= 10 and k != 'assisted-pull-ups']

def fmt(x):
    return ('%g' % x)

def settext(eid, s):
    if 'loadKg' in s and s.get('loadKg') is not None:
        L = s['loadKg']
        lt = 'BW' + ('+' if L > 0 else '−') + fmt(abs(L))
        return '%s × %d' % (lt, s['reps'])
    if s.get('weightKg') is None:
        return 'BW × %d' % s['reps']
    return '%s × %d' % (fmt(s['weightKg']), s['reps'])

# ---------------- adjustments ----------------
sessions = copy.deepcopy(d['sessions'])
byDate = {s['date']: s for s in sessions}
log = []
DELOAD = ['2026-09-21', '2026-09-23', '2026-09-25']
for date in DELOAD:
    s = byDate[date]
    s['deload'] = True
    s['durationMin'] -= 12
    for e in s['exercises']:
        work = [x for x in e['sets'] if x['kind'] != 'warmup']
        last = work[-1]
        e['sets'].remove(last)
        for x in e['sets']:
            if x['kind'] == 'warmup':
                continue
            if x.get('weightKg') is not None:
                st = STEP[e['id']]
                x['weightKg'] = math.floor(x['weightKg'] * 0.9 / st + 1e-9) * st
            elif x.get('loadKg') is not None and x['loadKg'] < 0:
                x['loadKg'] = x['loadKg'] - 2
            if x.get('rir') is not None:
                x['rir'] = min(3, x['rir'] + 1)
            x['text'] = settext(e['id'], x)
byDate['2026-09-21']['note'] = 'Deload week, back from being sick.'
log.append('Week of 21 Sep is a deload: every working weight x0.9 rounded down to the step, assistance +2 kg, one working set fewer per exercise, RIR +1, sessions 12 min shorter.')

def setpd(date, sets):
    s = byDate[date]
    e = next(e for e in s['exercises'] if e['id'] == 'narrow-grip-pull-down')
    rirs = [x.get('rir') for x in e['sets']]
    e['sets'] = [{'weightKg': w, 'reps': r, 'kind': 'working', 'rir': rirs[i] if i < len(rirs) else None,
                  'text': '%s × %d' % (fmt(w), r)} for i, (w, r) in enumerate(sets)]
setpd('2026-10-02', [(47.5, 10), (47.5, 9), (47.5, 8)])
setpd('2026-10-07', [(46.25, 10), (46.25, 9), (46.25, 9)])
setpd('2026-10-12', [(46.25, 9), (46.25, 8), (46.25, 8)])
byDate['2026-10-07']['note'] = 'Right elbow sore on pull-downs, dropped the weight.'
log.append('Narrow-grip pull-down regresses: 2 Oct 47.5 x 10/9/8, 7 Oct 46.25 x 10/9/9 (note: elbow sore), 12 Oct 46.25 x 9/8/8.')
# note fixes: notes that named an exercise not in that day's workout
n1 = byDate['2026-10-02']['note']; byDate['2026-10-02']['note'] = None; byDate['2026-09-30']['note'] = n1
n2 = byDate['2026-07-03']['note']; byDate['2026-07-03']['note'] = None; byDate['2026-07-01']['note'] = n2
log.append('Session notes moved to an A day: "%s" Fri 2 Oct -> Wed 30 Sep; "%s" Fri 3 Jul -> Wed 1 Jul (both name A exercises but sat on B days).' % (n1, n2))

# label check
for s in sessions:
    D = dt.date.fromisoformat(s['date'])
    lab = D.strftime('%a ') + str(D.day) + D.strftime(' %b')
    if lab != s['label']:
        log.append('LABEL MISMATCH %s %s' % (s['date'], s['label']))

# ---------------- per-lift computation ----------------
def working(e):
    return [x for x in e['sets'] if x['kind'] != 'warmup']
def straight(e):
    return [x for x in e['sets'] if x['kind'] not in ('warmup', 'drop')]
def lever(x):
    """comparable 'weight' of a set: kg for loaded, signed load for BW/assisted (BW = 0)."""
    if x.get('weightKg') is not None:
        return x['weightKg']
    return x.get('loadKg') or 0.0
def leverText(eid, w):
    k = cat[eid]
    if not k['bodyweight'] and eid != 'assisted-pull-ups':
        return fmt(w) + ' kg'
    if w == 0:
        return 'BW'
    return 'BW' + ('+' if w > 0 else '−') + fmt(abs(w))

lifts = {}
for eid in order:
    kind = 'assisted' if eid == 'assisted-pull-ups' else ('bodyweight' if cat[eid]['bodyweight'] else 'loaded')
    pts = []
    maxW = None; bestAt = {}; bestE = None; bestBW = None
    for s in sessions:
        e = next((e for e in s['exercises'] if e['id'] == eid), None)
        if not e:
            continue
        st = straight(e); wk = working(e)
        W = max(lever(x) for x in st)
        repsAtW = max(x['reps'] for x in st if lever(x) == W)
        e1 = None
        if eid in E1RM_LIFTS:
            cands = [x['weightKg'] * (1 + x['reps'] / 30) for x in st if x['reps'] <= 10]
            e1 = round(max(cands), 1) if cands else None
        pr = None; also = []
        first = maxW is None
        if not first and not s.get('deload'):
            if W > maxW + 1e-9:
                gain = W - maxW
                if kind == 'assisted':
                    pr = {'kind': 'Least assistance', 'text': '%s × %d' % (leverText(eid, W), repsAtW), 'gain': '−%s kg assistance' % fmt(gain)}
                elif kind == 'bodyweight' and maxW <= 0:
                    pr = {'kind': 'First added load', 'text': '%s × %d' % (leverText(eid, W), repsAtW), 'gain': '+%s kg' % fmt(gain)}
                else:
                    pr = {'kind': 'Heaviest weight', 'text': '%s × %d' % (leverText(eid, W), repsAtW), 'gain': '+%s kg' % fmt(gain)}
            # rep PRs at a weight already lifted
            reps_cands = []
            for x in st:
                w = lever(x)
                if w in bestAt and x['reps'] > bestAt[w]:
                    reps_cands.append((w, x['reps'], x['reps'] - bestAt[w]))
            if reps_cands:
                w, r, g = max(reps_cands)
                rp = {'kind': 'Rep record', 'text': '%s × %d' % (leverText(eid, w), r), 'gain': '+%d rep%s' % (g, '' if g == 1 else 's')}
                if pr is None:
                    pr = rp
                else:
                    also.append(rp)
            if e1 is not None and bestE is not None and e1 >= bestE + 0.5:
                ep = {'kind': 'Estimated 1RM', 'text': '%.1f kg (estimated)' % e1, 'gain': '+%s kg' % fmt(round(e1 - bestE, 1))}
                if pr is None:
                    pr = ep
                else:
                    also.append(ep)
        # update history (deloads included: they never beat records anyway)
        for x in st:
            w = lever(x)
            bestAt[w] = max(bestAt.get(w, 0), x['reps'])
        maxW = W if maxW is None else max(maxW, W)
        if e1 is not None:
            bestE = e1 if bestE is None else max(bestE, e1)
        p = {'date': s['date'], 'label': s['label'], 'deload': bool(s.get('deload')),
             'sets': ' · '.join(x['text'] + (' (drop)' if x['kind'] == 'drop' else '') + (' (failure)' if x['kind'] == 'failure' else '') for x in wk),
             'warmups': ' · '.join(x['text'] for x in e['sets'] if x['kind'] == 'warmup') or None,
             'top': '%s × %d' % (leverText(eid, W), repsAtW), 'topLever': W, 'topReps': repsAtW,
             'bestSetReps': max(x['reps'] for x in st), 'totalReps': sum(x['reps'] for x in wk),
             'e1rm': e1, 'rir': [x.get('rir') for x in wk],
             'pr': pr, 'alsoBeat': also or None, 'note': s['note']}
        pts.append(p)
    # verdict
    nd = [p for p in pts if not p['deload']]
    def below(a, b):
        return a['topLever'] < b['topLever'] - 1e-9 or (abs(a['topLever'] - b['topLever']) < 1e-9 and a['topReps'] < b['topReps'])
    verdict = None; why = None
    if len(nd) < 4:
        verdict = 'too new'; why = '%d sessions; a verdict needs 4' % len(nd)
    else:
        last4 = nd[-4:]
        prior = nd[-6:-2]
        best_prior = max(prior, key=lambda p: (p['topLever'], p['topReps']))
        if below(nd[-1], best_prior) and below(nd[-2], best_prior):
            verdict = 'slipping'; why = 'last 2 sessions below %s (%s)' % (best_prior['top'], best_prior['label'])
        elif not any(p['pr'] for p in last4):
            lastpr = next((p for p in reversed(pts) if p['pr']), None)
            since = lastpr['label'] if lastpr else pts[0]['label']
            n = len([p for p in nd if p['date'] > (lastpr['date'] if lastpr else '')])
            weeks = (dt.date.fromisoformat(d['today']) - dt.date.fromisoformat(lastpr['date'])).days / 7 if lastpr else None
            verdict = 'stalled'; why = 'no record since %s: %d sessions, %.1f weeks' % (since, n, weeks)
        else:
            verdict = 'moving'; why = '%d record(s) in the last 4 sessions' % sum(1 for p in last4 if p['pr'])
    # next step (0006): reps at the latest top weight vs sets x top of range
    last = pts[-1]
    pl = plan[eid]
    reps_at_top = sum(int(t.split('×')[1]) for t in last['sets'].split(' · ') if '(drop)' not in t and t.split(' ×')[0].strip() == last['top'].split(' ×')[0].replace(' kg', '').strip())
    topw = last['top'].split(' ×')[0].replace(' kg', '').strip()
    n_at_top = sum(1 for t in last['sets'].split(' · ') if '(drop)' not in t and t.split(' ×')[0].strip() == topw)
    target = n_at_top * pl['range'][1]
    lifts[eid] = {'name': cat[eid].get('name') or d['derived']['series'][eid]['name'], 'workout': pl['workout'], 'kind': kind,
                  'prescription': '%d × %d–%d' % (pl['sets'], pl['range'][0], pl['range'][1]),
                  'step': STEP[eid], 'e1rmShown': eid in E1RM_LIFTS,
                  'verdict': verdict, 'verdictWhy': why,
                  'nextStep': {'repsAtTop': reps_at_top, 'target': target, 'at': last['top'].split(' ×')[0], 'ready': reps_at_top >= target},
                  'points': pts}

# records table per lift (new definition)
for eid, L in lifts.items():
    pts = L['points']
    hv = max(pts, key=lambda p: (p['topLever'], p['topReps'], -dt.date.fromisoformat(p['date']).toordinal()))
    if L['kind'] == 'loaded':
        rec = {'Heaviest set': '%s · %s' % (hv['top'], hv['label'])}
    elif L['kind'] == 'assisted':
        rec = {'Least assistance': '%s · %s' % (hv['top'], hv['label'])}
    elif hv['topLever'] > 0:
        rec = {'Heaviest added load': '%s · %s' % (hv['top'], hv['label'])}
        un = [p for p in pts if p['topLever'] == 0]
        bu = max(un, key=lambda p: (p['bestSetReps'], -dt.date.fromisoformat(p['date']).toordinal()))
        rec['Most reps, bodyweight only'] = '%d · %s' % (bu['bestSetReps'], bu['label'])
    else:
        rec = {}
    if L['e1rmShown']:
        be = max((p for p in pts if p['e1rm']), key=lambda p: (p['e1rm'], -dt.date.fromisoformat(p['date']).toordinal()))
        rec['Best estimated 1RM'] = '%.1f kg · %s' % (be['e1rm'], be['label'])
    if L['kind'] != 'loaded':
        cur = pts[-1]['topLever']
        same = [p for p in pts if abs(p['topLever'] - cur) < 1e-9]
        bm = max(same, key=lambda p: (p['bestSetReps'], -dt.date.fromisoformat(p['date']).toordinal()))
        rec['Most reps in a set' if cur == 0 else 'Most reps at %s' % leverText(eid, cur)] = '%d · %s' % (bm['bestSetReps'], bm['label'])
    L['records'] = rec

# ---------------- sessions and weeks ----------------
def monday(date):
    D = dt.date.fromisoformat(date)
    return (D - dt.timedelta(days=D.weekday())).isoformat()
srows = []
for s in sessions:
    ws = 0; wu = 0; kg = 0.0; bwr = 0; prs = []
    mus = {m: 0.0 for m in MUSCLES + OTHER}
    for e in s['exercises']:
        for x in e['sets']:
            if x['kind'] == 'warmup':
                wu += 1; continue
            ws += 1
            if x.get('weightKg') is not None:
                kg += x['weightKg'] * x['reps']
            else:
                bwr += x['reps']
            pri, sec = musc(e['id'])
            for m in pri: mus[m] += 1
            for m in sec: mus[m] += 0.5
        p = next(p for p in lifts[e['id']]['points'] if p['date'] == s['date'])
        if p['pr']:
            prs.append('%s · %s · %s · %s' % (lifts[e['id']]['name'], p['pr']['kind'], p['pr']['text'], p['pr']['gain']))
    srows.append({'date': s['date'], 'label': s['label'], 'workout': s['day'], 'startedAt': s['startedAt'],
                  'durationMin': s['durationMin'], 'workingSets': ws, 'warmupSets': wu, 'loadedKg': int(kg + 0.5),
                  'bodyweightReps': bwr, 'prCount': len(prs), 'prs': prs, 'note': s['note'], 'deload': bool(s.get('deload')),
                  'muscleSets': mus})
weeks = []
start = dt.date.fromisoformat('2026-06-22')
for i in range(17):
    wk = (start + dt.timedelta(days=7 * i)).isoformat()
    rows = [r for r in srows if monday(r['date']) == wk]
    mus = {m: sum(r['muscleSets'][m] for r in rows) for m in MUSCLES + OTHER}
    weeks.append({'weekOf': wk, 'pattern': ''.join(r['workout'] for r in rows) or '-',
                  'sessions': len(rows), 'workingSets': sum(r['workingSets'] for r in rows),
                  'warmupSets': sum(r['warmupSets'] for r in rows), 'loadedKg': sum(r['loadedKg'] for r in rows),
                  'bodyweightReps': sum(r['bodyweightReps'] for r in rows), 'prCount': sum(r['prCount'] for r in rows),
                  'deload': any(r['deload'] for r in rows), 'muscleSets': mus})
# planned per week (1 primary, 0.5 secondary, x sessionsPerWeek / workouts)
planned = {m: 0.0 for m in MUSCLES + OTHER}
for eid, pl in plan.items():
    pri, sec = musc(eid)
    for m in pri: planned[m] += pl['sets'] * 1.5
    for m in sec: planned[m] += pl['sets'] * 0.5 * 1.5
two = weeks[-3:-1]  # 28 Sep (BAB) + 5 Oct (ABA)
avg2 = {m: (two[0]['muscleSets'][m] + two[1]['muscleSets'][m]) / 2 for m in MUSCLES + OTHER}
four = weeks[-5:-1]
avg4 = {m: sum(w['muscleSets'][m] for w in four) / 4 for m in MUSCLES + OTHER}

out = {
    'about': 'Canonical shared content for the stats concepts. Built from research/dataset.json plus the realism adjustments in brief.md section 1.3. Today is Thu 15 Oct 2026. Every number a mock shows comes from here.',
    'today': d['today'],
    'adjustments': log,
    'rules': {
        'workingSets': 'Every set that is not a warm-up. Drop and failure sets count as full sets for volume and muscle sets; drop sets never set records.',
        'e1rm': 'Epley w x (1 + r/30), only for lifts programmed at 10 reps or fewer (%s), only from sets of 10 reps or fewer. Always labelled estimated.' % ', '.join(E1RM_LIFTS),
        'pr': 'At most one record per lift per session, first match wins: Heaviest weight (or Least assistance, or First added load) > Rep record (more reps in one set at a weight or assistance already lifted) > Estimated 1RM (+0.5 kg or more, e1RM lifts only). A lift\'s first session is its baseline, not a record. Deload sessions never set records.',
        'verdict': 'Needs 4 non-deload sessions of the lift, else "too new". slipping: the last 2 sessions are both below the best top set of the 4 sessions before them (lower weight, or same weight and fewer reps). stalled: no record in the last 4 non-deload sessions. moving: otherwise. Deload sessions are skipped, gaps never count.',
        'muscleSets': '1 per primary muscle, 0.5 per secondary, working sets only, 12 muscles; forearms and traps are counted but only shown in drill-downs.',
        'week': 'Calendar week Monday 00:00 to Sunday, by session start. Volume comparisons use 2-week windows (one ABA + one BAB week).',
    },
    'plannedMuscleSetsPerWeek': planned,
    'muscleSetsAvgLast2FullWeeks': avg2,
    'muscleSetsAvgLast4FullWeeks_includesDeload': avg4,
    'weeks': weeks,
    'sessions': srows,
    'lifts': lifts,
    'consistency': {
        'sessionsPerWeek': [w['sessions'] for w in weeks],
        'last4FullWeeks': '%d of 12' % sum(w['sessions'] for w in weeks[-5:-1]),
        'last8FullWeeks': '%d of 24' % sum(w['sessions'] for w in weeks[-9:-1]),
        'adherence16FullWeeks': '%d of 48' % sum(w['sessions'] for w in weeks[:-1]),
        'medianDurationMin': sorted(r['durationMin'] for r in srows)[len(srows) // 2],
    },
}
json.dump(out, open(OUT, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)

# ---------------- console summary ----------------
print('\n'.join(log))
for eid, L in lifts.items():
    p = L['points']
    print('%-24s %s %-9s %-55s | last %s e1 %s | next %d/%d at %s | rec %s' % (
        L['name'], L['workout'], L['verdict'], L['verdictWhy'], p[-1]['top'], p[-1]['e1rm'],
        L['nextStep']['repsAtTop'], L['nextStep']['target'], L['nextStep']['at'], L['records']))
print()
for r in srows[-12:]:
    print(r['label'], r['workout'], r['durationMin'], r['workingSets'], r['loadedKg'], r['bodyweightReps'], r['prCount'], r['note'])
    for x in r['prs']: print('     ', x)
print()
for w in weeks:
    print(w['weekOf'], w['pattern'], w['sessions'], w['workingSets'], w['warmupSets'], w['loadedKg'], w['bodyweightReps'], w['prCount'], 'DELOAD' if w['deload'] else '',
          ' '.join('%s=%g' % (m[:5], w['muscleSets'][m]) for m in MUSCLES))
print('planned', {m: planned[m] for m in MUSCLES})
print('avg2   ', {m: avg2[m] for m in MUSCLES})
print('avg4   ', {m: avg4[m] for m in MUSCLES})
print(out['consistency'])
print('total PRs', sum(r['prCount'] for r in srows))
for eid in ['back-squat', 'deadlift', 'db-bench-press', 'assisted-pull-ups', 'push-ups', 'hyper-extension', 'narrow-grip-pull-down']:
    print(eid, ' | '.join('%s %s%s%s' % (p['label'], p['top'], ' e%s' % p['e1rm'] if p['e1rm'] else '', ' *' if p['pr'] else '') + (' D' if p['deload'] else '') for p in lifts[eid]['points']))
