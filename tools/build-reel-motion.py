#!/usr/bin/env python3
"""Reads the motion of the dancer in the reel that 0401/ re-stages, frame by frame, and writes 0401/motion.js.

The source is the unpacked "0401-hidden-reel" pack (its timeline.json and sprite atlases). For each of the
224 frames (14 a second) it notes: which of our poses the drawing is, where the figure stands (the x of
its middle and the y of its lowest point, on the 1024x576 stage), how much it is stretched compared with
the key drawing of that pose, the camera (which view, how far along its pan), how bright the frame is,
and the pale after-image on a few frames. Only numbers leave the pack: no drawings.
usage: python3 tools/build-reel-motion.py <path to the unpacked pack>      (needs Pillow, NumPy)
"""
import json, os, sys
import numpy as np
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PACK = sys.argv[1]
T = json.load(open(PACK + '/timeline.json')); F = T['frames']
ATLAS = [Image.open(f'{PACK}/assets/sprites/atlas-{i}.webp').convert('RGBA') for i in range(T['spriteAtlases'])]
# the frame of the reel that shows each pose most clearly (the ones our own poses were drawn from)
KEYS = {'sneak': 2, 'march': 10, 'runbow': 17, 'lunge': 22, 'squat': 29, 'jump': 35, 'bow': 43, 'headache': 58, 'star': 67,
        'spin': 75, 'wink': 80, 'sway': 87, 'strut': 94, 'cheer': 101, 'collapse': 108, 'banzai': 98}
NAMES = list(KEYS)

def sprite(i):
    s = F[i]['sprite']
    return np.asarray(ATLAS[s['atlas']].crop((s['u'], s['v'], s['u'] + s['w'], s['v'] + s['h']))).astype(float) / 255

def body(a):
    """the figure itself: opaque and not pale (a few frames carry pale scraps of an after-image)"""
    lum = a[..., :3].mean(2)
    return (a[..., 3] > 0.5) & (lum < 0.6)

def box(mask):
    rows = np.nonzero(mask.sum(1) >= 4)[0]; cols = np.nonzero(mask.sum(0) >= 4)[0]
    return cols[0], rows[0], cols[-1] + 1, rows[-1] + 1

def measure(i):
    a = sprite(i); m = body(a); x0, y0, x1, y1 = box(m)
    xs = np.nonzero(m[y0:y1, x0:x1])[1]
    s = F[i]['sprite']
    return dict(cx=s['x'] + x0 + xs.mean(), bottom=s['y'] + y1, w=x1 - x0, h=y1 - y0)

def describe(i, n=40):
    a = sprite(i); x0, y0, x1, y1 = box(body(a)); c = a[y0:y1, x0:x1]
    side = max(c.shape[:2]); sq = np.zeros((side, side, 2))
    oy, ox = side - c.shape[0], (side - c.shape[1]) // 2
    sq[oy:oy + c.shape[0], ox:ox + c.shape[1], 0] = c[..., 3]
    sq[oy:oy + c.shape[0], ox:ox + c.shape[1], 1] = c[..., :3].mean(2) * c[..., 3]
    return np.dstack([np.asarray(Image.fromarray((sq[..., k] * 255).astype(np.uint8)).resize((n, n), Image.BILINEAR)).astype(float) / 255 for k in (0, 1)])

# ---- which pose each frame shows
keys = [describe(KEYS[n]) for n in NAMES]
label = [NAMES[int(np.argmin([np.abs(describe(i) - k).mean() for k in keys]))] for i in range(len(F))]
# a shot = a run of frames where the figure stays in one place; one pose per shot (the commonest),
cuts = [0]
for i in range(1, len(F)):
    a, b = F[i - 1]['sprite'], F[i]['sprite']
    if abs(a['x'] - b['x']) > 60 or abs(a['h'] - b['h']) > 45 or abs(a['w'] - b['w']) > 60: cuts.append(i)
shots = list(zip(cuts, cuts[1:] + [len(F)]))
pose = [None] * len(F)
for n, (a, b) in enumerate(shots):
    seq = label[a:b]; top = max(set(seq), key=seq.count)
    if 'ghost' in F[a]: top = 'bow'                      # the bow with an after-image reads as a back view
    if b - a <= 2 and n and pose[a - 1] == 'squat' and F[a]['view'] == F[a - 1]['view']: top = 'squat'   # the squat, drawn a little smaller
    for i in range(a, b):
        pose[i] = 'banzai' if (top == 'cheer' and label[i] == 'banzai') else top
for i in range(1, len(F)):
    if 'ghost' in F[i] and pose[i] != 'bow': pose[i] = 'bow'

# ---- where it stands and how it is stretched
M = [measure(i) for i in range(len(F))]
ref = {n: M[KEYS[n]] for n in NAMES}
clamp = lambda v, lo, hi: max(lo, min(hi, v))
span = {v: max(f['x'] for f in F if f['view'] == v) or 1 for v in {f['view'] for f in F}}
views = sorted(span)
def light(i):
    lut = np.array(T['tones'][F[i]['tone']][:768], float).reshape(3, 256)
    return lut.mean() / 127.5 - 1                        # 0 = as drawn, above = brighter
base = float(np.median([light(i) for i in range(len(F))]))
rows = []
for i, f in enumerate(F):
    m, r = M[i], ref[pose[i]]
    g = f.get('ghost')
    rows.append([NAMES.index(pose[i]), round(m['cx']), int(m['bottom']),
                 round(clamp(m['w'] / r['w'], 0.86, 1.14) * 100), round(clamp(m['h'] / r['h'], 0.86, 1.14) * 100),
                 views.index(f['view']), round(f['x'] / span[f['view']] * 100), round(clamp(light(i) - base, -0.6, 0.9) * 100),
                 g['frame'] if g else -1, round(g['opacity'] * 100) if g else 0])
caption = [sum(1 for s in T['captionStarts'][:-1] if s <= i) - 1 for i in range(len(F))]
out = dict(fps=T['fps'], poses=NAMES, heights={n: int(ref[n]['h']) for n in NAMES}, captions=T['captionStarts'][:-1], frames=rows)
with open(f'{ROOT}/0401/motion.js', 'w', encoding='utf8') as fh:
    fh.write('// GENERATED by tools/build-reel-motion.py: the dance, frame by frame (14 a second).\n'
             '// frames: [pose, x of the middle, y of the lowest point, width %, height %, view, pan %, light %, after-image of frame, its opacity %]\n'
             'window.REEL_MOTION = ' + json.dumps(out, separators=(',', ':')).replace('"frames":[', '"frames":[\n').replace('],[', '],\n[') + ';\n')
print('frames', len(rows), '| shots', len(shots), '| poses used:', ', '.join(f"{n} {pose.count(n)}" for n in NAMES))
print('key heights in the reel:', out['heights'])
print('light range %d..%d' % (min(r[7] for r in rows), max(r[7] for r in rows)), '| after-images on frames', [i for i, r in enumerate(rows) if r[8] >= 0])
print('pose per shot:', ' '.join(f"{a}:{pose[a]}" for a, b in shots))
