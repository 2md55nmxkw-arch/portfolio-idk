#!/bin/bash
# Cuts the icons out of sheet-3 ("PROJECT ICONS", "LINK ICONS") and turns each into a clean
# white-on-transparent mask (8x upscale, hard-edged). Used in CSS via mask-image + currentColor.
# usage: tools/build-icons.sh   (needs ImageMagick 7)
set -e
D=$(cd "$(dirname "$0")/.." && pwd); SRC=$D/assets/source/sheet-3.webp; OUT=$D/assets/icons
icon(){ # name crop
  magick "$SRC" -crop $2 +repage -colorspace Gray -filter Lanczos -resize 800% -blur 0x1.2 \
    -negate -level 52%,70% -trim +repage -bordercolor black -border 6 \
    -background white -alpha shape -define png:compression-level=9 "$OUT/$1.png"; }
icon crown  50x40+30+401
icon wings  56x44+106+401
icon layers 50x44+30+486
icon puzzle 46x42+114+485
icon github 42x40+229+394
icon k      40x36+236+514
