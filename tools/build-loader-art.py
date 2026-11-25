#!/usr/bin/env python3
"""Prepares the art of the loading screen from assets/source/loader.webp (508 x 336).

  assets/img/loader.webp   the whole picture, flattened on the page colour (no transparency, so it stays
                           small and arrives fast); the parts that are animated live on the page are
                           cut away: "LOADING...", the progress bar, the percentage and the floating "Z"

usage: python3 tools/build-loader-art.py
"""
from _art import mockup, scene, done

(pw, ph), _ = scene(mockup("loader"), 0, 0, 336, "loader", x0=0, x1=508, fade_bottom=0, scale=0.55, q=72, flatten=(18, 16, 15),
      knock=[[(199,106.5),(310,106.5),(310,122),(199,122)],     # LOADING...
             [(152,128),(341,128),(341,157),(152,157)],         # progress bar
             [(346,130),(384,130),(384,157),(346,157)],         # 0%
             [(291,196),(315,196),(315,222),(291,222)]])        # Z
print(f"POS loader 0 0 508 336 {pw} {ph}")
done()
