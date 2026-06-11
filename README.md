# Encoder · YouTube Video Optimizer

Compress and optimize screen recordings into YouTube-compatible MP4 **entirely in the browser**.
[ffmpeg.wasm](https://ffmpegwasm.netlify.app/) (ffmpeg compiled to WebAssembly) does the encoding —
the video **never leaves the user's device**.

## What it does

- H.264 (`libx264`, `high` profile, `yuv420p`) + AAC audio, `+faststart` — YouTube's recommended format
- Adjustable quality (CRF), resolution cap (downscale only), frame-rate cap, encode speed
- Output downloads under the original name with a `_small` suffix
- Large inputs are read **lazily via WORKERFS** (by byte range), so the whole file is never loaded into memory

## Files

| File | Purpose |
|------|---------|
| `index.html` | The app (UI + ffmpeg loading logic) |
| `.nojekyll` | Tells GitHub Pages to skip Jekyll processing |

Both sit in the repository root. (No service worker is needed — see below.)

## Deploy on GitHub Pages

1. Push `index.html` and `.nojekyll` to the repo root.
2. **Settings → Pages → Source: Deploy from a branch**, branch `main`, folder `/ (root)`, **Save**.
3. Open `https://<username>.github.io/<repo>/`.

## Single-threaded by design

This build uses the **single-threaded** ffmpeg.wasm core. That core does not need
`SharedArrayBuffer` or cross-origin isolation, so **no COOP/COEP service worker is required** —
it runs on plain static hosting like GitHub Pages with no extra setup.

(The multi-threaded core was tried but proved unstable in 32-bit WASM at high core
counts — freezing on startup. Single-thread is slower but reliable.)

## ffmpeg loading detail

The `@ffmpeg/ffmpeg` class worker must be same-origin, so it is loaded from a blob and its
relative imports are rewritten to absolute CDN URLs (`toBlobURLPatched`). Core and wasm are
loaded from the jsDelivr CDN via `toBlobURL` (`esm` build, v0.12.10).

## Limits

- The browser saves output to the **Downloads** folder (it can't write back to the source folder).
- Single-threaded WASM encoding is far slower than native ffmpeg, and the *output* must fit in
  memory. For very long recordings, or when you just want speed, the native `yt_convert.py`
  script is the better tool.
