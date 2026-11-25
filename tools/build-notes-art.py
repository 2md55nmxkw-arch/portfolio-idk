#!/usr/bin/env python3
"""Cuts the Notes-section decor out of the mockups and upscales it.

  assets/img/notes-decor.webp     desktop: full-width strip, section y 0..178
                                  (sketch sheets, the "0401" scraps, the hairline that closes the section)
  assets/img/notes-decor-m.webp   mobile: x 0..246, y 108..200 (sketch sheets and the "0401" scraps)

The heading, the handwritten line and the sheet with the list are live HTML, so they are cut away.
usage: python3 tools/build-notes-art.py
"""
from _art import mockup, scene, done

(pw, ph), _ = scene(mockup("mockup-desktop"), 1542, 0, 178, "notes-decor",
      knock=[[(48,5),(120,0),(199,0),(199,41),(120,50),(48,61)],          # heading tag
             [(76,58),(262,42),(264,60),(200,68),(200,82),(76,96)],       # handwritten line
             [(284,0),(652,0),(652,150),(284,150)]])                     # sheet with the list
print(f"POS notes-decor 0 0 667 178 {pw} {ph}")

(pw, ph), _ = scene(mockup("mockup-mobile"), 1510, 108, 200, "notes-decor-m", x0=0, x1=246,
      knock=[[(63,96),(215,90),(215,112),(63,125)]])                      # last handwritten line
print(f"POS notes-decor-m 0 108 246 92 {pw} {ph}")
done()
