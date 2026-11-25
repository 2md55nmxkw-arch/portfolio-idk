#!/usr/bin/env python3
"""Prepares the art of the loading screen.

  assets/img/loader.webp        the whole picture with the girl asleep (assets/source/loader.webp, 508 x 336),
                                flattened on the page colour (no transparency, so it stays small and arrives
                                fast); the parts that are animated live on the page are cut away:
                                "LOADING...", the progress bar, the percentage and the floating "Z"
  assets/img/loader-wake.webp   the girl waking up, four drawings side by side: eyes open, head up, sitting up,
                                looking up. They are frames 5-8 of the reference animation
                                (assets/source/loader.gif), and only what differs from the sleeping picture
                                is kept, so the lamp, the laptop and the cat stay perfectly still
  assets/img/loader-ready.webp  the red "READY." of the last frame, with its underline and sparkle

usage: python3 tools/build-loader-art.py
"""
import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageSequence
from _art import K, SRC, mockup, upscale, key_dark, red_key, scene, save, done

PAGE = (18, 16, 15)   # the colour the pictures are flattened on
SCALE = 0.55

(pw, ph), _ = scene(mockup("loader"), 0, 0, 336, "loader", x0=0, x1=508, fade_bottom=0, scale=SCALE, q=72, flatten=PAGE,
      knock=[[(199,106.5),(310,106.5),(310,122),(199,122)],     # LOADING...
             [(152,128),(341,128),(341,157),(152,157)],         # progress bar
             [(346,130),(384,130),(384,157),(346,157)],         # 0%
             [(291,196),(315,196),(315,222),(291,222)]])        # Z
print(f"POS loader 0 0 508 336 {pw} {ph}")

# ---------- waking up ----------
frames = [f.convert("RGB") for f in ImageSequence.Iterator(Image.open(f"{SRC}/loader.gif"))]
asleep = frames[0]
# frame of the animation, and how many px its drawing sits higher than the sleeping one
# (every frame was drawn anew; measured on the things that do not move: logo, window, lamp, laptop, cat)
WAKE = [(5, 0), (6, 2), (7, 2), (8, 2)]
HERS = (58, 148, 322, 326)   # nothing outside this box belongs to the girl or to the marks around her
BAR = (146, 0, 345, 154)     # ...and this is the progress bar, which is drawn live on the page

def aligned(n, dy):
    im = Image.new("RGB", asleep.size, PAGE)
    im.paste(frames[n], (0, dy))
    return im

def fill_holes(m):
    """Adds to a mask everything it encloses."""
    pad = Image.new("L", (m.width + 2, m.height + 2), 0)
    pad.paste(m, (1, 1))
    ImageDraw.floodfill(pad, (0, 0), 128)
    return pad.crop((1, 1, m.width + 1, m.height + 1)).point(lambda v: 0 if v == 128 else 255)

def drop_specks(m, least=260):
    """Removes the islands of a mask that are too small to be part of the drawing."""
    m = m.copy()
    a = np.asarray(m)
    seen = np.zeros(a.shape, bool)
    for y, x in zip(*np.nonzero(a)):
        if seen[y, x]:
            continue
        probe = m.copy()
        ImageDraw.floodfill(probe, (int(x), int(y)), 77)
        island = np.asarray(probe) == 77
        seen |= island
        if island.sum() < least:
            m.paste(0, mask=Image.fromarray((island * 255).astype("uint8")))
    return m

def changed(im):
    """Mask (reference size) of what differs from the sleeping picture: her, and the marks next to her."""
    blur = lambda p: np.asarray(p.filter(ImageFilter.GaussianBlur(1.2))).astype(float)
    d = np.abs(blur(im) - blur(asleep)).max(2) > 34
    keep = np.zeros_like(d)
    x0, y0, x1, y1 = HERS
    keep[y0:y1, x0:x1] = True
    keep[BAR[1]:BAR[3], BAR[0]:BAR[2]] = False
    m = Image.fromarray(((d & keep) * 255).astype("uint8"))
    m = fill_holes(m.filter(ImageFilter.MaxFilter(13)))         # close the gaps...
    return drop_specks(m.filter(ImageFilter.MinFilter(7)))       # ...and keep a rim of 3 px around the drawing

shots = [aligned(n, dy) for n, dy in WAKE]
masks = [changed(im) for im in shots]
boxes = [m.getbbox() for m in masks]
x0, y0 = min(b[0] for b in boxes) - 3, min(b[1] for b in boxes) - 3
x1, y1 = max(b[2] for b in boxes) + 3, max(b[3] for b in boxes) + 3
x1 += -(x1 - x0) % 5; y1 += -(y1 - y0) % 5                       # whole pixels in the saved file (5 x 4 x 0.55 = 11)
W, H = (x1 - x0) * K, (y1 - y0) * K
sheet = np.zeros((H, W * len(shots), 3)); alpha = np.zeros((H, W * len(shots)))
page = np.array(PAGE) / 255
for i, (im, m) in enumerate(zip(shots, masks)):
    rgb, al = key_dark(upscale(im, f"wake-{i}"))
    flat = rgb * al[..., None] + page * (1 - al[..., None])     # the same treatment as the sleeping picture
    m = m.resize((im.width * K, im.height * K), Image.BICUBIC)
    ImageDraw.Draw(m).rectangle([v * K for v in BAR], fill=0)   # the rim must not bring the bar of the frame along
    m = m.filter(ImageFilter.GaussianBlur(5))
    sheet[:, i * W:(i + 1) * W] = flat[y0 * K:y1 * K, x0 * K:x1 * K]
    alpha[:, i * W:(i + 1) * W] = (np.asarray(m) / 255)[y0 * K:y1 * K, x0 * K:x1 * K]
(sw, sh), _ = save(sheet, alpha, "loader-wake", scale=SCALE, q=72, trim=False)
print(f"POS wake {x0} {y0} {x1 - x0} {y1 - y0}  cell {sw // len(shots)} x {sh}")

# ---------- "READY." ----------
RX, RY, RW, RH = 180, 100, 182, 54
im = upscale(shots[-1].crop((RX, RY, RX + RW, RY + RH)), "ready")
ink = red_key(im)
ink[:(113 - RY) * K, :(210 - RX) * K] = 0                       # the tail of the pen loop around the logo
size, box = save(im, ink, "loader-ready", scale=SCALE, q=80)
print(f"POS ready {RX + box[0] / K:g} {RY + box[1] / K:g} {(box[2] - box[0]) / K:g} {(box[3] - box[1]) / K:g}  {size[0]} x {size[1]}")
done()
