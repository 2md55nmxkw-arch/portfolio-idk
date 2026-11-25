#!/usr/bin/env python3
"""Cuts the Projects-section art out of the mockups and upscales it.

  assets/img/projects/<slug>.webp     preview strip of each project (desktop mockup)
  assets/img/projects/<slug>-m.webp   the same strips as drawn in the mobile mockup
  assets/img/projects-marks.webp      red pen loop / tape on the right (desktop mockup)
  assets/img/projects-marks-m.webp    red pen loop at the top right (mobile mockup)

Prints the position of every strip (section coordinates, reference px) for the inline style variables.
usage: python3 tools/build-projects-art.py
"""
import numpy as np
from _art import K, mockup, upscale, ramp, red_key, cutout, save, done

SLUGS = ["tzar-hub", "kimera", "endfield-il2dump", "loliland-modloader"]

# outline of each torn photo strip, in section coordinates (traced from 4x crops of the mockups)
DESKTOP = (mockup("mockup-desktop"), 729, [
  [(386.5,66.5),(599,64),(598.5,105),(596,106.5),(595,126),(372.5,128),(374,116),(379.5,110.5),(380,95),(386,92.5)],
  [(389.5,140),(599,135.5),(598.5,147.5),(596,175),(595,200.5),(400,202),(374,201),(380,185),(381.5,165),(385,162.5),(382,154),(385,149)],
  [(391.5,214.5),(599,209.5),(599,235),(596,245),(595,275),(375,276),(379,267.5),(384,252.5),(382,245),(389.5,236),(386,227.5)],
  [(390,289),(599,285),(597.5,315),(595,350),(375,351),(382.5,330),(382,317.5),(389.5,307.5)],
])
MOBILE = (mockup("mockup-mobile"), 854, [
  [(362.5,57.5),(581,57),(580,82.5),(576,87.5),(571.5,115.5),(350,115.5),(354,100),(358.5,87.5),(355,80)],
  [(366.5,126.5),(582,125),(580,152.5),(575,185),(352.5,184.5),(361,167.5),(359,160),(365,145)],
  [(369,195),(583,194),(581,220),(577.5,235),(575,258.5),(353,258),(355,250),(363.5,247.5),(359,229),(365,220),(362,205)],
  [(370,269.5),(583,268),(582.5,290),(579,302.5),(576,330.5),(354,330.5),(360,310),(362.5,297.5),(369.5,290)],
])

for (mock, top, polys), suffix in ((DESKTOP, ""), (MOBILE, "-m")):
    for slug, pts in zip(SLUGS, polys):
        (x, y, w, h), _ = cutout(mock, top, pts, f"projects/{slug}{suffix}")
        print(f"   pos{suffix or '  '} x={x} y={y} w={w} h={h}")

# ---------- red marks, desktop: x 562..667, y 0..396 ----------
mock, top, _ = DESKTOP
X0, W, H = 562, 105, 396
im = upscale(mock.crop((X0, top, X0 + W, top + H)), "marks")
alpha = red_key(im)
h, w = alpha.shape
keep = np.zeros_like(alpha)                 # everything right of the paper, plus the pen loop above the first strip
keep[:, (602 - X0) * K:] = 1
keep[:62 * K, (568 - X0) * K:] = 1
alpha *= keep * (1 - ramp(h, h - 10 * K, h - 1))[:, None] * (1 - ramp(w, w - 4 * K, w - 1))[None, :]
size, box = save(im, alpha, "projects-marks", q=80)
print(f"   pos   x={X0 + box[0] / K:g} y={box[1] / K:g} w={(box[2] - box[0]) / K:g}")

# ---------- red pen loop, mobile: x 560..650, y 0..50 ----------
mock, top, _ = MOBILE
X0, W, H = 560, 90, 50
im = upscale(mock.crop((X0, top, X0 + W, top + H)), "marks-m")
alpha = red_key(im)
size, box = save(im, alpha, "projects-marks-m", q=80)
print(f"   pos-m x={X0 + box[0] / K:g} y={box[1] / K:g} w={(box[2] - box[0]) / K:g}")
done()
