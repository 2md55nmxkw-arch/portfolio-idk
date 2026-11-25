#!/usr/bin/env python3
"""Cuts the footer scene (the girl and the cat on the roof under the red moon) out of the mockups.

  assets/img/footer.webp     desktop: full width, footer y 1..286 (fades in over the first 5 px,
                             where the Notes decor fades out); logo, links, slashes and stamp cut away
  assets/img/footer-m.webp   mobile: full width, footer y 0..246; the row with logo and links is live HTML

usage: python3 tools/build-footer-art.py
"""
from _art import mockup, scene, done

(pw, ph), _ = scene(mockup("mockup-desktop"), 1714, 1, 286, "footer", fade_top=5, fade_bottom=0, scale=0.62,
      knock=[[(420,34),(612,14),(615,2),(646,2),(646,46),(614,50),(425,74),(420,74)],   # logo + star
             [(444,76),(614,66),(616,190),(444,191)],                                   # links
             [(444,194),(532,192),(532,224),(444,224)],                                 # slashes
             [(566,198),(650,196),(650,242),(566,242)]])                                # stamp
print(f"POS footer 0 1 667 285 {pw} {ph}")

(pw, ph), _ = scene(mockup("mockup-mobile"), 1688, 0, 246, "footer-m", fade_top=2, fade_bottom=4, scale=0.62,
      knock=[[(0,0),(246,0),(246,19.5),(0,19.5)]])     # already drawn by the Notes decor
print(f"POS footer-m 0 0 667 246 {pw} {ph}")
done()
