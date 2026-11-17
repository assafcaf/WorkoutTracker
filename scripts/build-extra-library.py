"""Builds src/data/library/extra-exercises.json from hasaneyldrm/exercises-dataset (MIT text only).

Usage: python3 scripts/build-extra-library.py <path to exercises-dataset/data/exercises.json>

Keeps English names, muscles, equipment and steps; never its media (Gym visual's, not licensed).
Drops every entry that duplicates a free-exercise-db entry (same equipment and near-same name
words) or an earlier entry of its own, so each exercise appears once in the merged library.
"""
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
LIBRARY = ROOT / 'src/data/library/exercises.json'
OUT = ROOT / 'src/data/library/extra-exercises.json'

EQUIPMENT = {
    'body weight': 'body only', 'assisted': 'machine', 'leverage machine': 'machine',
    'smith machine': 'machine', 'sled machine': 'machine', 'skierg machine': 'machine',
    'stationary bike': 'machine', 'elliptical machine': 'machine', 'stepmill machine': 'machine',
    'upper body ergometer': 'machine', 'band': 'bands', 'resistance band': 'bands',
    'kettlebell': 'kettlebells', 'ez barbell': 'e-z curl bar', 'stability ball': 'exercise ball',
    'bosu ball': 'other', 'medicine ball': 'medicine ball', 'barbell': 'barbell', 'olympic barbell': 'barbell',
    'trap bar': 'barbell', 'dumbbell': 'dumbbell', 'cable': 'cable', 'roller': 'foam roll',
    'wheel roller': 'other', 'rope': 'other', 'weighted': 'other', 'tire': 'other', 'hammer': 'other',
}
TARGET = {
    'abs': 'abdominals', 'pectorals': 'chest', 'biceps': 'biceps', 'glutes': 'glutes',
    'delts': 'shoulders', 'triceps': 'triceps', 'upper back': 'middle back', 'lats': 'lats',
    'calves': 'calves', 'quads': 'quadriceps', 'forearms': 'forearms', 'hamstrings': 'hamstrings',
    'spine': 'lower back', 'traps': 'traps', 'adductors': 'adductors', 'serratus anterior': 'chest',
    'abductors': 'abductors', 'levator scapulae': 'neck', 'cardiovascular system': 'quadriceps',
}
SECONDARY = {
    'shoulders': 'shoulders', 'deltoids': 'shoulders', 'rear deltoids': 'shoulders',
    'rotator cuff': 'shoulders', 'hamstrings': 'hamstrings', 'forearms': 'forearms',
    'wrists': 'forearms', 'wrist flexors': 'forearms', 'wrist extensors': 'forearms',
    'grip muscles': 'forearms', 'hands': 'forearms', 'triceps': 'triceps', 'biceps': 'biceps',
    'brachialis': 'biceps', 'quadriceps': 'quadriceps', 'calves': 'calves', 'soleus': 'calves',
    'glutes': 'glutes', 'core': 'abdominals', 'obliques': 'abdominals', 'abdominals': 'abdominals',
    'lower abs': 'abdominals', 'chest': 'chest', 'upper chest': 'chest', 'lower back': 'lower back',
    'rhomboids': 'middle back', 'upper back': 'middle back', 'back': 'middle back',
    'trapezius': 'traps', 'traps': 'traps', 'latissimus dorsi': 'lats', 'lats': 'lats',
    'inner thighs': 'adductors', 'groin': 'adductors', 'sternocleidomastoid': 'neck',
}
# Checked by hand (2026-11-17): the same exercise as a free-exercise-db entry under another name.
KNOWN_DUPLICATES = set('''cable curl|crunch floor|barbell bench press|barbell incline bench press|cable lat pulldown|lever seated row|all fours squad stretch|barbell front chest squat|barbell full zercher squat|barbell jm bench press|barbell rollerout from bench|barbell standing rocking leg calf raise|barbell step-up|barbell wide squat|barbell seated overhead press|cable front shoulder raise|cable high row (kneeling)|cable incline bench press|cable kneeling crunch|cable low seated row|cable lying bicep curl|cable one arm pulldown|cable pushdown|cable pushdown (with rope attachment)|cable reverse-grip pushdown|cable seated chest press|cable seated shoulder internal rotation|cable standing crunch|cable standing crunch (with rope attachment)|cable standing shoulder external rotation|cable triceps pushdown (v-bar)|cable alternate shoulder press|chest stretch with exercise ball|circles knee stretch|crunch (on stability ball)|dumbbell incline bench press|dumbbell incline raise|dumbbell kickback|dumbbell lateral raise|dumbbell lateral to front raise|dumbbell lying pronation on floor|dumbbell lying supination on floor|dumbbell one arm bent-over row|dumbbell pronate-grip triceps extension|dumbbell seated lateral raise|dumbbell seated shoulder press|dumbbell standing around world|dumbbell standing front raise above head|dumbbell step-up|dumbbell stiff leg deadlift|dumbbell upright row|dumbbell seated one leg calf raise - hammer grip|dumbbell single leg split squat|exercise ball hug|gorilla chin|handstand push-up|kettlebell front squat|landmine 180|lever gripless shrug|lever military press|lever seated calf press|lever seated dip|lever standing chest press|lying elbow to knee|medicine ball catch and overhead throw|medicine ball chest push from 3 point stance|medicine ball chest push multiple response|medicine ball chest push single response|medicine ball chest push with run release|medicine ball overhead slam|medicine ball supine chest throw|overhead triceps stretch|pull-in (on stability ball)|rear pull-up|resistance band seated shoulder press|seated glute stretch|sled calf press on leg press|sled hack squat|sled lying squat|smith back shrug|smith decline bench press|smith full squat|spider crawl push up|walk elliptical cross trainer|walking on incline treadmill|wide hand push up|glute-ham raise|jump squat'''.split('|'))

SYNONYM = {'ups': 'up', 'flye': 'fly', 'flie': 'fly', 'alternating': 'alternate', 'rollerout': 'rollout', 'squad': 'quad', 'db': 'dumbbell', 'bb': 'barbell', 'kb': 'kettlebell', 'lever': 'machine',
           'leverage': 'machine', 'pushup': 'push', 'pullup': 'pull', 'situp': 'sit', 'chinup': 'chin'}
STOP = {'with', 'the', 'a', 'an', 'on', 'to', 'and', 'of', 'in', 'male', 'female', 'version', 'up',
        'medium', 'standard', 'regular', 'normal', 'basic', 'pov'}
# Words that only restate the equipment, ignored when comparing names of the same equipment.
EQUIPMENT_WORDS = {'barbell', 'dumbbell', 'cable', 'machine', 'kettlebell', 'band', 'smith', 'ez', 'bar',
                   'body', 'weight', 'bodyweight', 'weighted', 'lever', 'leverage', 'assisted', 'ball', 'stability'}


def clean_name(name: str) -> str:
    name = re.sub(r'\((male|female)\)', '', name, flags=re.I)
    name = re.sub(r'\bv\. ?\d+\b', '', name)
    name = re.sub(r'\((back|side|front) pov\)', '', name, flags=re.I)
    name = re.sub(r'\s+', ' ', name).strip(' -')
    return name[:1].upper() + name[1:]


def words(name: str) -> frozenset:
    out = []
    for w in re.findall(r'[a-z0-9]+', name.lower()):
        if len(w) > 3 and w.endswith('s'):
            w = w[:-1]
        w = SYNONYM.get(w, w)
        if w not in STOP:
            out.append(w)
    return frozenset(out)


def same(a: frozenset, b: frozenset) -> bool:
    if a == b or (a - EQUIPMENT_WORDS) == (b - EQUIPMENT_WORDS):
        return True
    union = a | b
    return len(union) > 0 and len(a & b) / len(union) >= 0.8


def slug(name: str) -> str:
    return 'edb-' + re.sub(r'[^a-z0-9]+', '-', name.lower()).strip('-')


def main(src: str) -> None:
    library = json.loads(LIBRARY.read_text(encoding='utf-8'))
    taken = [(words(e['name']), e['equipment']) for e in library]
    ids = {e['id'] for e in library}
    source = json.loads(Path(src).read_text(encoding='utf-8'))
    kept, dropped = [], []
    for x in source:
        name = clean_name(x['name'].replace('в°', '°'))
        if name.lower() in KNOWN_DUPLICATES:
            dropped.append(name)
            continue
        equipment = EQUIPMENT.get(x['equipment'], 'other')
        key = words(name)
        twin = next((t for t in taken if t[1] == equipment and same(key, t[0])), None)
        if twin is not None or not key:
            dropped.append(name)
            continue
        primary = TARGET.get(x['target'])
        if primary is None:
            dropped.append(name)
            continue
        secondary = sorted({SECONDARY[m] for m in x['secondary_muscles'] if m in SECONDARY} - {primary})
        text = name.lower()
        category = 'stretching' if 'stretch' in text or 'pose' in text else (
            'cardio' if x['body_part'] == 'cardio' else 'strength')
        entry_id = slug(name)
        while entry_id in ids:
            entry_id += '-2'
        ids.add(entry_id)
        steps = (x.get('instruction_steps') or {}).get('en') or []
        kept.append({
            'id': entry_id, 'name': name, 'force': None, 'level': 'beginner', 'mechanic': None,
            'equipment': equipment, 'primaryMuscles': [primary], 'secondaryMuscles': secondary,
            'instructions': steps, 'category': category, 'images': [],
        })
        taken.append((key, equipment))
    kept.sort(key=lambda e: e['id'])
    with OUT.open('w', encoding='utf-8', newline='\n') as out:  # LF on every OS
        out.write(json.dumps(kept, indent=1, ensure_ascii=False) + '\n')
    print(f'{len(source)} read, {len(kept)} kept, {len(dropped)} dropped as duplicates or unmapped')


if __name__ == '__main__':
    main(sys.argv[1])
