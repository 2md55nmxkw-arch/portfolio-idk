#!/usr/bin/env python3
"""Cuts the dancer of the hidden reel (0401/) out of the generated sheets.

  assets/source/reel-poses-1.webp, reel-poses-2.webp   two sheets of 8 poses on a flat dark background
  assets/source/reel-character.webp                    the character standing (used as the idle pose)
  ->  0401/assets/dancer.webp   one atlas with all 17 poses on a transparent background
      0401/dancer.js            where each pose sits in the atlas, its size, the x of its middle and of its feet

The background is nearly the colour of her trousers, so it is not keyed by colour alone: it is flooded
from the edges of the sheet (the black outline stops the flood), then the enclosed gaps that have
exactly the background colour (between an arm and the head, inside a loop) are opened too.
usage: python3 tools/build-reel-sprites.py [debug-dir]      (needs Pillow, NumPy, ImageMagick 7)
"""
import json, os, subprocess, sys, tempfile
from collections import deque
import numpy as np
from PIL import Image, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC, OUT = f"{ROOT}/assets/source", f"{ROOT}/0401"
DEBUG = sys.argv[1] if len(sys.argv) > 1 else None
NAMES = ['sneak', 'march', 'runbow', 'lunge', 'squat', 'jump', 'bow', 'headache',
         'star', 'spin', 'wink', 'sway', 'strut', 'cheer', 'collapse', 'banzai']

def components(mask):
    """connected regions of a small boolean mask -> list of pixel-index arrays"""
    h, w = mask.shape
    seen = np.zeros_like(mask, bool); out = []
    for y0, x0 in zip(*np.nonzero(mask)):
        if seen[y0, x0]: continue
        q = deque([(y0, x0)]); seen[y0, x0] = True; pts = []
        while q:
            y, x = q.popleft(); pts.append((y, x))
            for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                yy, xx = y + dy, x + dx
                if 0 <= yy < h and 0 <= xx < w and mask[yy, xx] and not seen[yy, xx]:
                    seen[yy, xx] = True; q.append((yy, xx))
        out.append(np.array(pts))
    return out

def key(path):
    """RGBA picture with the flat background removed"""
    rgb = Image.open(path).convert('RGB')
    a = np.asarray(rgb).astype(int)
    edge = np.concatenate([a[:8].reshape(-1, 3), a[-8:].reshape(-1, 3), a[:, :8].reshape(-1, 3), a[:, -8:].reshape(-1, 3)])
    bg = np.median(edge, 0)
    # 1. flood from the edges of the sheet
    with tempfile.TemporaryDirectory() as tmp:
        subprocess.run(['magick', path, '-alpha', 'set', '-bordercolor', 'rgb(%d,%d,%d)' % tuple(bg), '-border', '2',
                        '-fuzz', '2.2%', '-fill', 'none', '-draw', 'alpha 0,0 floodfill', '-shave', '2x2', f'{tmp}/k.png'], check=True)
        alpha = np.asarray(Image.open(f'{tmp}/k.png').convert('RGBA'))[..., 3] > 0
    # 2. enclosed gaps that are exactly the background colour
    like = alpha & (np.abs(a - bg).max(2) <= 5)
    small = np.asarray(Image.fromarray((like * 255).astype(np.uint8)).resize((like.shape[1] // 2, like.shape[0] // 2), Image.BOX)) > 127
    opened = 0
    for pts in components(small):
        if len(pts) < 50: continue                      # specks are shading, not gaps
        ys, xs = pts[:, 0] * 2, pts[:, 1] * 2
        # a real gap averages to the background colour itself; her trousers are a shade redder
        if np.abs(a[ys, xs].mean(0) - bg).max() > 1.8: continue
        sel = np.zeros_like(small); sel[pts[:, 0], pts[:, 1]] = True
        big = np.asarray(Image.fromarray((sel * 255).astype(np.uint8)).resize((like.shape[1], like.shape[0]), Image.NEAREST)) > 0
        alpha &= ~(big & like); opened += 1
    # soften the cut by a pixel, and pull the background colour out of the edge pixels
    soft = np.asarray(Image.fromarray((alpha * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(0.7))).astype(float) / 255
    soft = np.minimum(soft, alpha * 1.0 + (1 - alpha) * 0)  # never grow outside the cut
    return np.dstack([a, soft * 255]).astype(np.uint8), opened

def figures(rgba, expect):
    """the separate figures of a sheet, in reading order"""
    alpha = rgba[..., 3] > 40
    k = 4
    low = np.asarray(Image.fromarray((alpha * 255).astype(np.uint8)).resize((alpha.shape[1] // k, alpha.shape[0] // k), Image.BOX)) > 20
    grown = np.asarray(Image.fromarray((low * 255).astype(np.uint8)).filter(ImageFilter.MaxFilter(5))) > 0   # loose bits stay with their figure
    comps = sorted(components(grown), key=len, reverse=True)[:expect]
    out = []
    for pts in comps:
        sel = np.zeros_like(grown); sel[pts[:, 0], pts[:, 1]] = True
        big = np.asarray(Image.fromarray((sel * 255).astype(np.uint8)).resize((alpha.shape[1], alpha.shape[0]), Image.NEAREST)) > 0
        fig = rgba.copy(); fig[..., 3] = np.where(big, fig[..., 3], 0)
        ys, xs = np.nonzero(fig[..., 3] > 40)
        box = (xs.min(), ys.min(), xs.max() + 1, ys.max() + 1)
        out.append((ys.mean(), xs.mean(), Image.fromarray(fig, 'RGBA').crop(box)))
    rows = sorted(out, key=lambda f: f[0])
    half = len(rows) // 2
    return [f[2] for f in sorted(rows[:half], key=lambda f: f[1])] + [f[2] for f in sorted(rows[half:], key=lambda f: f[1])]

sprites = []
for sheet in ('reel-poses-1', 'reel-poses-2'):
    rgba, opened = key(f'{SRC}/{sheet}.webp')
    figs = figures(rgba, 8)
    print(sheet, 'figures', len(figs), 'enclosed gaps opened', opened)
    sprites += figs
rgba, opened = key(f'{SRC}/reel-character.webp')
idle = figures(rgba, 1)[0]
# the standing picture is much larger than the sheets: bring it to the size of a standing pose there
stand = max(sprites[i].height for i in (7, 10, 11))
idle = idle.resize((round(idle.width * stand / idle.height), stand), Image.LANCZOS)
sprites.append(idle); names = NAMES + ['idle']
print('idle', idle.size, 'gaps opened', opened)

# pack into one atlas, 6 per row
PAD, PER = 6, 6
cw = max(s.width for s in sprites) + PAD * 2; ch = max(s.height for s in sprites) + PAD * 2
atlas = Image.new('RGBA', (cw * PER, ch * ((len(sprites) + PER - 1) // PER)), (0, 0, 0, 0))
data = {}
for i, (name, sp) in enumerate(zip(names, sprites)):
    x, y = (i % PER) * cw + PAD, (i // PER) * ch + PAD
    atlas.alpha_composite(sp, (x, y))
    a = np.asarray(sp)[..., 3] > 40
    foot = np.nonzero(a[int(sp.height * 0.9):].any(0))[0]            # where she touches the ground
    data[name] = dict(u=x, v=y, w=sp.width, h=sp.height, ax=int(round(foot.mean())) if len(foot) else sp.width // 2,
                      cx=int(round(np.nonzero(a)[1].mean())))   # the middle of the figure: the motion data places her by it
os.makedirs(f'{OUT}/assets', exist_ok=True)
atlas.save(f'{OUT}/assets/dancer.webp', quality=90, method=6)
open(f'{OUT}/dancer.js', 'w', encoding='utf8').write(
    '// GENERATED by tools/build-reel-sprites.py: where each pose sits in assets/dancer.webp (u, v, w, h), the x of her feet (ax) and of her middle (cx).\n'
    'window.REEL_DANCER = ' + json.dumps(data, indent=1) + ';\n')
print('atlas', atlas.size, os.path.getsize(f'{OUT}/assets/dancer.webp') // 1024, 'KB')
for n in names: print(f"  {n:9s} {data[n]['w']}x{data[n]['h']}  feet x {data[n]['ax']}")
if DEBUG:
    bgc = Image.new('RGBA', atlas.size, (233, 191, 169, 255)); bgc.alpha_composite(atlas); bgc.convert('RGB').save(f'{DEBUG}/atlas-on-cream.png')
    bgm = Image.new('RGBA', atlas.size, (40, 120, 200, 255)); bgm.alpha_composite(atlas); bgm.convert('RGB').save(f'{DEBUG}/atlas-on-blue.png')
