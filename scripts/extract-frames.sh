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

# lg: desktop / retina, sm: phones (the canvas crops to cover, so a lighter file is enough).
# Light denoise removes video compression blocks before upscaling, unsharp brings back edges.
CLEAN="hqdn3d=1.5:1.5:3:3"
SHARP="unsharp=5:5:0.8:5:5:0"
ffmpeg -v error -y -i "$SRC" -an -vf "fps=$FPS,$CLEAN,scale=1920:-2:flags=lanczos,$SHARP" \
  -frames:v "$COUNT" -c:v libwebp -quality 88 -compression_level 6 -preset photo "$OUT/lg/%03d.webp"
# sm: phones. Portrait centre crop (2:3) at the source's full height, upscaled to 600x900,
# every other frame. Phones show the face large, so a portrait crop keeps detail where it
# matters and the decoded frames stay small enough to cache on the GPU.
SM_COUNT=$(( COUNT / 2 ))
SM_FPS=$(awk -v n="$SM_COUNT" -v d="$DURATION" 'BEGIN { printf "%.4f", n / d }')
ffmpeg -v error -y -i "$SRC" -an -vf "fps=$SM_FPS,$CLEAN,crop=ih*2/3:ih,scale=600:900:flags=lanczos,$SHARP" \
  -frames:v "$SM_COUNT" -c:v libwebp -quality 86 -compression_level 6 -preset photo "$OUT/sm/%03d.webp"

ACTUAL=$(ls "$OUT/lg" | wc -l)
read -r W H < <(ffprobe -v error -select_streams v:0 -show_entries stream=width,height -of csv=p=0:s=x "$OUT/lg/001.webp" | tr x ' ')
SM_ACTUAL=$(ls "$OUT/sm" | wc -l)
cat > "$OUT/manifest.json" <<JSON
{ "count": $ACTUAL, "width": $W, "height": $H, "sm": { "count": $SM_ACTUAL, "width": 600, "height": 900 } }
JSON

echo "Wrote $ACTUAL frames to $OUT ($(du -sh "$OUT/lg" | cut -f1) lg, $(du -sh "$OUT/sm" | cut -f1) sm)"
