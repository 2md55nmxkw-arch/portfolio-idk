#!/bin/bash
# Cuts the texture swatches out of sheet-3 ("BACKGROUNDS") and turns them into seamless tiles.
set -e
# usage: tools/build-textures.sh   (needs ImageMagick 7)
D=$(cd "$(dirname "$0")/.." && pwd)
SRC=${1:-$D/assets/source/sheet-3.webp}; OUT=${2:-$D/assets/tex}; T=${3:-$(mktemp -d)}
up(){ magick "$SRC" -crop $1 +repage -filter Lanczos -resize 400% "$2"; }                      # 4x so tiles stay sharp on hi-dpi
hp(){ magick "$1" \( +clone -blur 0x$3 \) -compose mathematics -define compose:args=0,-1,1,0.5 -composite "$2"; }  # remove large blotches, keep grain
seam(){ read W H < <(identify -format '%w %h\n' "$1")
  magick -size ${W}x${H} xc:black -fill white -draw "rectangle $((W*22/100)),$((H*22/100)) $((W*78/100)),$((H*78/100))" -blur 0x$((W*7/100)) "$T/mask.png"
  magick \( "$1" -roll +$((W/2))+$((H/2)) \) "$1" "$T/mask.png" -composite "$2"; }
# --- dark page background: swatch 3 (fine grain; the cracked swatch 1 tiles too visibly)
up 114x100+297+762 $T/dark-up.png
magick $T/dark-up.png -colorspace Gray $T/dark-g.png; hp $T/dark-g.png $T/dark-hp.png 36; seam $T/dark-hp.png $T/dark-s.png
magick $T/dark-s.png -function Polynomial "${DG:-0.2},${DO:--0.02}" +level-colors black,'#f6dccf' -quality 82 "$OUT/dark.webp"
# --- paper: swatch 2 (cream, fine specks and hairline cracks)
up 108x116+170+747 $T/paper-up.png
magick $T/paper-up.png -colorspace Gray $T/paper-g.png; hp $T/paper-g.png $T/paper-hp.png 60; seam $T/paper-hp.png $T/paper-s.png
magick $T/paper-s.png -function Polynomial "${PG:-0.8},${PO:-0.505}" +level-colors '#2a1c1a','#ffdbc9' -quality 84 "$OUT/paper.webp"
# --- red: swatch 4 (grunge), flattened to the tag colour of the mockup
up 106x116+430+747 $T/red-up.png
magick $T/red-up.png -colorspace Gray $T/red-g.png; hp $T/red-g.png $T/red-hp.png 40; seam $T/red-hp.png $T/red-s.png
magick $T/red-s.png -function Polynomial "${RG:-1.15},${RO:--0.075}" +level-colors '#7a0f1a','#f23f4c' -quality 84 "$OUT/red.webp"
