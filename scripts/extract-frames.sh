#!/usr/bin/env bash
# Turns the face video into the .webp image sequence the scroll canvas plays.
# Usage: npm run frames -- path/to/face.mp4 [frameCount=120]
set -euo pipefail

SRC="${1:?usage: extract-frames.sh <video> [frameCount]}"
COUNT="${2:-120}"
OUT="public/frames"

DURATION=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$SRC")
FPS=$(awk -v n="$COUNT" -v d="$DURATION" 'BEGIN { printf "%.4f", n / d }')

rm -rf "$OUT/lg" "$OUT/sm"
mkdir -p "$OUT/lg" "$OUT/sm"

# lg: desktop / tablet, sm: phones (the canvas crops to cover, so a lighter file is enough)
ffmpeg -v error -y -i "$SRC" -an -vf "fps=$FPS,scale='min(1600,iw)':-2:flags=lanczos" \
  -frames:v "$COUNT" -c:v libwebp -quality 74 -compression_level 6 "$OUT/lg/%03d.webp"
ffmpeg -v error -y -i "$SRC" -an -vf "fps=$FPS,scale=960:-2:flags=lanczos" \
  -frames:v "$COUNT" -c:v libwebp -quality 70 -compression_level 6 "$OUT/sm/%03d.webp"

ACTUAL=$(ls "$OUT/lg" | wc -l)
read -r W H < <(ffprobe -v error -select_streams v:0 -show_entries stream=width,height -of csv=p=0:s=x "$OUT/lg/001.webp" | tr x ' ')
cat > "$OUT/manifest.json" <<JSON
{ "count": $ACTUAL, "width": $W, "height": $H, "sizes": ["lg", "sm"] }
JSON

echo "Wrote $ACTUAL frames to $OUT ($(du -sh "$OUT/lg" | cut -f1) lg, $(du -sh "$OUT/sm" | cut -f1) sm)"
