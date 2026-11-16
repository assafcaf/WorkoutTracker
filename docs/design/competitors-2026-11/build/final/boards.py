"""Composes the v7 before/after boards (build-plan step 12) and the overview.

before-after-NN.png: the before shot on the left, the after shot on the right, a caption over each.
overview.png: the main screens after, side by side.

Run from the repo root after shoot.sh:  python docs/design/competitors-2026-11/build/final/boards.py
"""
import os
from PIL import Image, ImageDraw, ImageFont

HERE = 'docs/design/competitors-2026-11/build/final'
BUILD = 'docs/design/competitors-2026-11/build'
V6 = 'docs/ux-expert/iterations/v6'

# (NN, title, before path, before caption, after file)
BOARDS = [
    ('01', 'Home', f'{BUILD}/home/before/02-b-rest-day.png', 'Before: Train tab (v6)', '01-home.png'),
    ('02', 'Workout page', f'{BUILD}/home/before/06-workout-page.png', 'Before: Train tab (v6)', '02-workout-page.png'),
    ('03', 'Set screen', f'{BUILD}/live/before/01-now-first-set.png', 'Before (v6)', '03-set.png'),
    ('04', 'Rest', f'{BUILD}/live/before/04-rest.png', 'Before (v6)', '04-rest.png'),
    ('05', 'The PR moment', f'{BUILD}/live/before/05-pr.png', 'Before (v6)', '05-pr.png'),
    ('06', 'All grid', f'{BUILD}/live/before/07-all.png', 'Before (v6)', '06-all.png'),
    ('07', 'Session summary', f'{BUILD}/summary/before/02-past-summary-top.png', 'Before (v6)', '07-summary.png'),
    ('08', 'Progress', f'{BUILD}/progress/before/01-progress-top.png', 'Before (v6)', '08-progress.png'),
    ('09', 'Lift page', f'{BUILD}/progress/before/06-lift-deadlift.png', 'Before (v6)', '09-lift.png'),
    ('10', 'Program', f'{BUILD}/summary/before/04-program-top.png', 'Before (v6)', '10-program.png'),
    ('11', 'Sessions', f'{V6}/recheck/31-sessions.png', 'Before: v6 recheck', '11-sessions.png'),
    ('12', 'Session editor', f'{V6}/recheck/39-edit-past-session.png', 'Before: v6 recheck', '12-session-editor.png'),
    ('13', 'Log a past workout', f'{V6}/recheck/57-log-past-sheet.png', 'Before: v6 recheck', '13-log-past-sheet.png'),
    ('14', 'Tools sheet', f'{V6}/recheck/40-tools-sheet.png', 'Before: v6 recheck', '14-tools-sheet.png'),
    ('15', 'Lift history (from tools)', f'{V6}/recheck/41-tools-lift-history.png', 'Before: v6 recheck', '15-tools-lift-history.png'),
    ('16', 'Swap / Alternatives', f'{V6}/recheck/42-swap-sheet.png', 'Before: v6 recheck', '16-swap-sheet.png'),
    ('17', 'Exercise detail', f'{V6}/walk/33-exercise-detail.png', 'Before: v6 walk', '17-exercise-detail.png'),
    ('18', 'Finish sheet', f'{V6}/recheck/44-finish-sheet.png', 'Before: v6 recheck', '18-finish-sheet.png'),
    ('19', 'Discard confirm', f'{V6}/recheck/45-discard-confirm.png', 'Before: v6 recheck', '19-discard-confirm.png'),
    ('20', 'Exercises: My lifts', f'{V6}/recheck/36-exercises-mylifts.png', 'Before: v6 recheck', '20-exercises-my-lifts.png'),
    ('21', 'Exercises: search', f'{V6}/recheck/37-exercises-search-squat.png', 'Before: v6 recheck', '21-exercises-search.png'),
    ('22', 'Program editor', f'{V6}/recheck/74-program-editor.png', 'Before: v6 recheck', '22-program-editor.png'),
    ('23', 'Muscles', f'{V6}/recheck/70-muscles.png', 'Before: v6 recheck', '23-muscles.png'),
    ('24', 'Body', f'{V6}/walk/15-body.png', 'Before: v6 walk', '24-body.png'),
    ('25', 'Settings', f'{V6}/walk/40-settings.png', 'Before: v6 walk', '25-settings.png'),
    ('26', 'First run', f'{V6}/recheck/71-first-run.png', 'Before: v6 recheck', '26-first-run.png'),
    ('27', 'First run: Sessions', f'{V6}/walk/62-first-run-sessions.png', 'Before: v6 walk', '27-first-run-sessions.png'),
    ('28', 'Snackbar after Discard', f'{V6}/recheck/46-after-discard.png', 'Before: v6 recheck', '28-after-discard.png'),
]

OVERVIEW = [
    ('Home', '01-home.png'), ('Workout page', '02-workout-page.png'), ('Set', '03-set.png'),
    ('Rest', '04-rest.png'), ('Summary', '07-summary.png'), ('Progress', '08-progress.png'),
    ('Lift page', '09-lift.png'),
]

W = 390          # every shot is drawn at 390 css px wide
H = 844          # and cropped or padded to one phone screen
GAP = 32
PAD = 32
CAP = 64
INK = (20, 21, 24)
INK3 = (108, 109, 117)
PAPER = (246, 246, 243)
LINE = (227, 227, 222)


def font(size, bold=False):
    names = ['arialbd.ttf', 'Arial Bold.ttf', 'DejaVuSans-Bold.ttf'] if bold else ['arial.ttf', 'Arial.ttf', 'DejaVuSans.ttf']
    for name in names:
        try:
            return ImageFont.truetype(name, size)
        except OSError:
            continue
    return ImageFont.load_default()


def phone(path):
    """The shot scaled to 390 wide, cut to one 844-tall screen (a full-page shot keeps its top)."""
    img = Image.open(path).convert('RGB')
    img = img.resize((W, round(img.height * W / img.width)), Image.LANCZOS)
    if img.height >= H:
        return img.crop((0, 0, W, H))
    canvas = Image.new('RGB', (W, H), PAPER)
    canvas.paste(img, (0, 0))
    return canvas


def frame(board, img, x, y):
    ImageDraw.Draw(board).rectangle((x - 1, y - 1, x + W, y + H), outline=LINE)
    board.paste(img, (x, y))


def before_after(nn, title, before, before_caption, after):
    width = PAD * 2 + W * 2 + GAP
    height = PAD + 40 + CAP + H + PAD
    board = Image.new('RGB', (width, height), (255, 255, 255))
    draw = ImageDraw.Draw(board)
    draw.text((PAD, PAD), f'{nn}  {title}', fill=INK, font=font(26, bold=True))
    top = PAD + 40
    for i, (path, caption) in enumerate([(before, before_caption), (f'{HERE}/after/{after}', 'After: v7, Ledger & Instrument')]):
        x = PAD + i * (W + GAP)
        draw.text((x, top + 14), caption, fill=INK if i else INK3, font=font(18, bold=bool(i)))
        draw.text((x, top + 38), os.path.relpath(path, 'docs/design/competitors-2026-11').replace('\\', '/') if i == 0 else f'build/final/after/{after}',
                  fill=INK3, font=font(12))
        frame(board, phone(path), x, top + CAP)
    out = f'{HERE}/before-after-{nn}.png'
    board.save(out, optimize=True)
    return out


def overview():
    width = PAD * 2 + W * len(OVERVIEW) + GAP * (len(OVERVIEW) - 1)
    height = PAD + 48 + 36 + H + PAD
    board = Image.new('RGB', (width, height), (255, 255, 255))
    draw = ImageDraw.Draw(board)
    draw.text((PAD, PAD), 'WorkoutTracker v7: Ledger & Instrument, the main screens after', fill=INK, font=font(30, bold=True))
    for i, (caption, name) in enumerate(OVERVIEW):
        x = PAD + i * (W + GAP)
        draw.text((x, PAD + 56), caption, fill=INK, font=font(20, bold=True))
        frame(board, phone(f'{HERE}/after/{name}'), x, PAD + 48 + 36)
    board.save(f'{HERE}/overview.png', optimize=True)


if __name__ == '__main__':
    for row in BOARDS:
        print(before_after(*row))
    overview()
    print(f'{HERE}/overview.png')
