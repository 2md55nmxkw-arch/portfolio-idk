#!/usr/bin/env python3
"""Cuts the Lab-section illustration out of the mockups and upscales it.

  assets/img/lab.webp     desktop: full-width strip, section y 0..199
  assets/img/lab-m.webp   mobile:  full-width strip, section y -10..152

The dark background is keyed out (colour-to-alpha) so the page texture shows through.
Live elements (tag, text, checklist paper) are cut away; things that sit in front of the
checklist paper (side of the PC tower, the loose disc, the pin) stay opaque.
usage: python3 tools/build-lab-art.py
"""
from _art import mockup, scene, ellipse, done

# ---------- desktop (section top = mockup y 1107) ----------
NOTE = [(503,16),(520,17),(545,19),(560,20),(580,21.5),(600,23),(620,25),(633,26),(632,40),(630,52),(629,62),(628,75),(626,90),(625,100),
        (624,120),(622,135),(622,146),(600,146.5),(580,146),(560,145.5),(540,144),(521,143),(520,139.5),(506,138.5),(500,138),(499,120),(498,100),
        (497,75),(497,60),(498,48),(500,36),(502,25)]
DISC = [(558,171),(561,163),(568,155),(578,149),(590,145),(604,143),(618,144),(628,148),(634,155),(636.5,164),(635,173),(630,181),(622,187),
        (611,192),(600,193.5),(588,192),(576,189),(566,184),(560,178)]
scene(mockup("mockup-desktop"), 1107, 0, 199, "lab",
      knock=[[(0,0),(272,0),(272,143),(0,143)],                       # tag + text (live)
             [(545,0),(667,0),(667,17),(545,17)],                     # end of the red tape from Projects
             NOTE,                                                    # checklist paper (live)
             [(40,212),(47,205),(185,187),(192,196),(192,201),(40,201)]],  # corner of the Gallery tag
      opaque=[[(468,59),(506,79),(507,181),(468,181)],                # side of the PC tower
              DISC, ellipse(528, 16.5, 7, 8.5)])                      # loose disc, pin

# ---------- mobile (section top = mockup y 1206) ----------
scene(mockup("mockup-mobile"), 1206, -10, 152, "lab-m",
      knock=[[(0,-10),(338,-10),(338,113),(0,113)],                   # tag + text (live)
             [(0,-10),(387,-10),(387,0),(0,0)], [(447,-10),(667,-10),(667,0),(447,0)],   # bottom edge of the Projects paper
             [(30,156),(38,149),(180,131.5),(186,139),(228,139),(228,153),(30,153)]])    # Gallery tag + camera
done()
