# Hero videos

The hero carousel (`src/components/HeroVideoCarousel.tsx`) plays three short
portrait clips from `public/videos/hero-1.mp4` … `hero-3.mp4` with poster frames
`hero-N.jpg`.

The originals are phone screen recordings (1440x2560 HEVC, ~85–98 MB each).
HEVC does not play in most desktop browsers and the files are far too large for
a web page, so they are re-encoded to H.264 720x1280 (~6–10 MB) before use.
Originals (`public/videos/xappx-*.mp4`) are git-ignored and never deployed.

To re-encode after replacing an original (needs ffmpeg on PATH, or
`npx ffmpeg-static`):

```bash
cd apps/web/public/videos
for i in 1 2 3; do
  ffmpeg -y -i xappx-$i.mp4 -vf "scale=720:1280:flags=lanczos" \
    -c:v libx264 -profile:v high -level 4.0 -pix_fmt yuv420p -preset slow -crf 26 \
    -movflags +faststart -c:a aac -b:a 96k -ac 2 hero-$i.mp4
  ffmpeg -y -ss 0.5 -i hero-$i.mp4 -frames:v 1 -q:v 4 hero-$i.jpg
done
```
