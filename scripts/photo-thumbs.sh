#!/usr/bin/env bash
# Makes the 160px WebP copies of the player photos in public/photos/sm, which avatars and chart labels use (see playerThumbUrl in
# src/lib/players.ts). Run it after adding or changing a photo. Needs ffmpeg.
set -euo pipefail
cd "$(dirname "$0")/../public/photos"
mkdir -p sm
for f in *.*; do
  ffmpeg -v error -y -i "$f" -vf "crop='min(iw,ih)':'min(iw,ih)',scale=160:160:flags=lanczos" -c:v libwebp -quality 82 "sm/${f%.*}.webp"
done
