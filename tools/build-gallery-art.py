#!/usr/bin/env python3
"""Cuts the Gallery-section art out of the mockups and upscales it.

  assets/img/gallery/<slug>.webp     the five pinned photos (desktop mockup)
  assets/img/gallery/<slug>-m.webp   the same photos as drawn in the mobile mockup
  assets/img/gallery/<slug>-lg.webp  the desktop photos at full upscaled size, for the lightbox
  assets/img/gallery-decor.webp      desktop only: scraps, sketches and red strokes behind the photos (y 4..244)

Prints the position of every photo (section coordinates, reference px) for the inline style variables.
usage: python3 tools/build-gallery-art.py
"""
from _art import mockup, cutout, scene, done

SLUGS = ["moon", "cracks", "cat", "tower", "flower"]

# outline of each photo frame, in section coordinates (traced from 4x crops of the mockups)
DESKTOP = (mockup("mockup-desktop"), 1297, [
  [(32,97.5),(177.5,86.3),(186.3,195),(42,209.5)],
  [(180,96.3),(197,96.8),(197.5,89),(207.5,89.5),(208,97.2),(299.5,100),(295,213.8),(172.5,211.3)],
  [(296.3,89),(354,88),(354.5,82),(360.5,82),(361,87.9),(404.5,87),(410,195),(298.8,199.5)],
  [(405.5,77),(463.5,74.2),(464,69),(470,69),(470.5,73.9),(525.5,71.3),(533,190.5),(412,203)],
  [(528,83.8),(634.5,80),(638,201.8),(522,206)],
])
MOBILE = (mockup("mockup-mobile"), 1338, [
  [(38,73.8),(172.5,60.8),(181.3,151.3),(48,168)],
  [(185.5,61.3),(294.5,67),(286.3,170),(177,163.8)],
  [(291.3,56.3),(399.5,55),(405.5,153.5),(297,158)],
  [(402,46.3),(422,44.8),(422.5,40),(434,39.3),(434.3,43.8),(461,41.5),(461.3,38.5),(465.5,38.3),(465.7,41),(522.5,36.3),(531.3,147.5),(410.5,160.5)],
  [(526.3,57),(624.5,45.5),(636.8,150.7),(524.5,163.8)],
])

for (mock, top, polys), suffix in ((DESKTOP, ""), (MOBILE, "-m")):
    for slug, pts in zip(SLUGS, polys):
        (x, y, w, h), (pw, ph) = cutout(mock, top, pts, f"gallery/{slug}{suffix}", q=82)
        print(f"POS {slug}{suffix} {x} {y} {w} {h} {pw} {ph}")
        if not suffix:   # the big copy shown when a photo is opened
            _, (lw, lh) = cutout(mock, top, pts, f"gallery/{slug}-lg", q=86, scale=1)
            print(f"POS {slug}-lg 0 0 0 0 {lw} {lh}")

# ---------- desktop: everything behind the photos ----------
mock, top, photos = DESKTOP
MORE = [(588.8,182),(636.3,183.8),(635,210.8),(586.3,207.5)]
(pw, ph), _ = scene(mock, top, 4, 244, "gallery-decor",
      knock=[[(48,19),(184,1),(182,28),(181,39),(45,60)],                       # heading tag (live)
             [(188,9),(222,9),(222,39),(188,39)],                               # camera icon (live)
             [(54,65),(186,45),(205,56),(300,40),(303,58),(200,74),(100,90),(56,94)]],   # handwritten line (live)
      under=photos + [MORE])
print(f"POS gallery-decor 0 4 667 240 {pw} {ph}")
done()
