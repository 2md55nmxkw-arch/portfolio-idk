#!/usr/bin/env python3
"""Cuts the About-section art out of the mockup / asset sheet and upscales it.

  assets/img/about.webp          portrait panel (desktop mockup, section x300..667, y10..236), paper area cut away
  assets/img/about-m.webp        the same panel as drawn in the mobile mockup (section x320..667, y2..226)
  assets/img/about-strokes.webp  red brush strokes on the left (mockup, keyed by redness)
  assets/img/cat.webp            the mascot silhouette (sheet-1)

usage: python3 tools/build-about-art.py
"""
import numpy as np
from PIL import Image, ImageDraw, ImageFilter
from _art import K, mockup, upscale, ramp, poly, red_key, save, done

desktop = mockup("mockup-desktop")
TOP = 489  # mockup y of the About section's top edge

# ---------- portrait panel ----------
def portrait(mock, top, box, paper, name):
    """box = section-local (x0, y0, w, h); paper = outline of the sheet that overlaps the picture -> transparent."""
    x0, y0, w, h = box
    im = upscale(mock.crop((x0, top + y0, x0 + w, top + y0 + h)), name)
    m = poly(im.size, paper, x0, y0).filter(ImageFilter.MaxFilter(15)).filter(ImageFilter.GaussianBlur(2))
    alpha = 1 - np.asarray(m) / 255
    hh, ww = alpha.shape
    alpha *= ramp(ww, 0, 10 * K)[None, :] * (1 - ramp(ww, ww - 7 * K, ww - 1))[None, :]
    alpha *= ramp(hh, 0, 5 * K)[:, None] * (1 - ramp(hh, hh - 7 * K, hh - 1))[:, None]
    save(im, alpha, name)

portrait(desktop, TOP, (300, 10, 367, 226),
  [(296,26),(300,26),(306,30),(308,42),(320,40),(332,47),(333,64),(324,66),(336,74),(340,82),(352,84),(356,100),(362,118),(368,134),
   (398,138),(400,150),(393,164),(386,176),(382,186),(360,200),(354,206),(357,221),(338,222),(300,227),(296,227)], "about")

mobile = mockup("mockup-mobile")
portrait(mobile, 628, (320, 2, 347, 224),
  [(316,20),(335,20),(338,34),(345,45),(352,58),(361,63),(375,90),(383,110),(390,120),(400,125),(418,127),(411,140),(405,152),
   (402,166),(400,178),(381,186),(375,192),(373,205),(371,216),(330,220),(316,220)], "about-m")

# ---------- red brush strokes ----------
im = upscale(desktop.crop((0, TOP, 210, TOP + 215)), "strokes")
alpha = red_key(im)
h, w = alpha.shape
alpha *= (1 - ramp(h, h - 12 * K, h - 1))[:, None] * (1 - ramp(w, w - 6 * K, w - 1))[None, :]
save(im, alpha, "about-strokes", q=80)

# ---------- mascot ----------
sheet = mockup("sheet-1")
im = upscale(sheet.crop((1205, 30, 1355, 210)), "cat")
g = np.asarray(im.convert("L").filter(ImageFilter.GaussianBlur(1.2))).astype(float) / 255
line = np.clip((g - 0.38) / 0.16, 0, 1)                      # cream outline + eyes
hard = Image.fromarray(((g > 0.42) * 255).astype(np.uint8)).copy()   # closed outline (copy: fromarray images are read-only)
ImageDraw.floodfill(hard, (0, 0), 128)                        # everything outside the cat
shape = Image.fromarray(((np.asarray(hard) != 128) * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(1.1))
cream, ink = np.array([239, 213, 200.]), np.array([14, 12, 12.])
rgb = (ink + (cream - ink) * line[..., None]).astype(np.uint8)
save(rgb, np.asarray(shape) / 255, "cat", scale=0.6, q=90)
done()
