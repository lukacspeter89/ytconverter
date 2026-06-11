# Encoder · YouTube Video Optimizer

Compress and optimize screen recordings into YouTube-compatible MP4 **entirely in the browser**.
[ffmpeg.wasm](https://ffmpegwasm.netlify.app/) (ffmpeg compiled to WebAssembly) does the encoding —
the video **never leaves the user's device**.

## What it does

- H.264 (`libx264`, `high` profile, `yuv420p`) + AAC audio, `+faststart` — YouTube's recommended format
- Adjustable quality (CRF), resolution cap (downscale only), frame-rate cap, encode speed
- Output downloads under the original name with a `_small` suffix
- **Multi-threaded** ffmpeg when the browser is cross-origin isolated; automatic single-thread fallback otherwise

## Files

| File | Purpose |
|------|---------|
| `index.html` | The app (UI + ffmpeg loading logic) |
| `coi-serviceworker.js` | Adds COOP/COEP headers so `SharedArrayBuffer` (multithreading) works on GitHub Pages |
| `.nojekyll` | Tells GitHub Pages to skip Jekyll processing |

All three must sit in the repository root.

## Deploy on GitHub Pages

1. Push `index.html`, `coi-serviceworker.js`, and `.nojekyll` to the repo root.
2. **Settings → Pages → Source: Deploy from a branch**, branch `main`, folder `/ (root)`, **Save**.
3. Open `https://<username>.github.io/<repo>/`.

On the very first visit the service worker installs and the page reloads once to gain
cross-origin isolation — this is expected. After that, multithreading is active.

## How the GitHub Pages multithreading fix works

`SharedArrayBuffer` (required by multi-threaded ffmpeg.wasm) is only available in a
**cross-origin isolated** context, which needs two HTTP response headers:

```
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: require-corp
```

GitHub Pages can't set custom headers, so `coi-serviceworker.js` registers a service
worker that injects them into every response. The page then reports
`window.crossOriginIsolated === true`, and `index.html` loads `@ffmpeg/core-mt`.
If isolation can't be established, it transparently falls back to the single-thread core.

> Note: a service worker **cannot** be inlined into the HTML — browsers only register
> worker scripts from a real same-origin URL (not `blob:`/`data:`), so it lives in its own file.

## ffmpeg loading detail

The `@ffmpeg/ffmpeg` class worker must be same-origin, so it is loaded from a blob and its
relative imports are rewritten to absolute CDN URLs (`toBlobURLPatched`). Core, wasm, and the
pthread worker are all loaded from the jsDelivr CDN via `toBlobURL` (`esm` builds, v0.12.10).

## Limits

- The browser saves output to the **Downloads** folder (it can't write back to the source folder).
- WASM encoding is heavier than native ffmpeg: comfortable for clips up to a few minutes /
  a few hundred MB. For very large (1 GB+) files, native ffmpeg is the better tool.
