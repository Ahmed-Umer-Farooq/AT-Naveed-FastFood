# AT Naveed Food

Single-page site for AT Naveed Food (Pabbi Kajor Stop). Static — no build step.

## Hero

The hero is a scroll-scrubbed sprite animation built from `hero-video.mp4`:
three scenes (loaded fries cheese-pull, zinger burger, chicken wrap) with the
background removed per frame, packed into a WebP sprite atlas.

* `hero-sprites/hero-cutout-lg.webp` — 640x360 cells, desktop (>= 900px)
* `hero-sprites/hero-cutout-sm.webp` — 384x216 cells, mobile

96 frames, 12x8 grid, 8px clamp-to-edge gutter around every cell. Playback
moves `background-position` over a window clipped to exactly one cell, so
neighbouring frames never bleed in. Scroll progress drives the frame through a
damped lerp; `prefers-reduced-motion` holds a single static frame.

## Local preview

Serve the folder over HTTP (not `file://`) and open the root:

    npx serve .

## Deploy

Vercel, static, no build command. `vercel.json` sets long-lived immutable
cache headers for `/hero-sprites/*` and `/uploads/*`.
