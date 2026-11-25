#!/bin/bash
# Backdrops of the hidden reel (0401/), made from the site's own scenes:
#   city.webp  the rooftop view of the footer, mirrored around the cat and the moon so that
#              the girl sitting next to the cat is not in it (she is the one dancing in front)
#   room.webp  the wall and the window of the changelog page
# usage: tools/build-reel-backdrops.sh      (needs ImageMagick 7)
set -e
D=$(cd "$(dirname "$0")/.." && pwd); OUT=$D/0401/assets; mkdir -p "$OUT"
AXIS=893   # x of the middle of the cat in assets/img/footer-m.webp
magick "$D/assets/img/footer-m.webp" -background '#12100f' -alpha remove -crop $((1654 - AXIS))x576+${AXIS}+0 +repage \
  \( +clone -flop \) +swap +append -quality 84 -define webp:method=6 "$OUT/city.webp"
magick "$D/assets/img/changelog/bg.webp" -crop 850x350+686+0 +repage -filter Lanczos -resize 1200x \
  -quality 84 -define webp:method=6 "$OUT/room.webp"
identify -format '%f %wx%h %b\n' "$OUT/city.webp" "$OUT/room.webp"
