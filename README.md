# tonylin-site

Tony Lin's personal website — a scroll-driven experience built with Vite + TypeScript (strict, no framework), GSAP and xterm.js.

## Scripts

| Script | What it does |
| --- | --- |
| `npm run dev` | Start the Vite dev server |
| `npm run build` | Typecheck, then production build to `dist/` |
| `npm run preview` | Serve the production build locally |
| `npm test` | Run Vitest once |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run frames:placeholder` | Generate placeholder frames into `public/placeholder-frames/` |

`dev` and `build` generate placeholder frames automatically if missing.

## Frames

Frames are loaded from `/assets/frames/` when its `manifest.json` exists, otherwise from the generated `/placeholder-frames/`. Override with `VITE_FRAMES_BASE` (see `.env.example`).

## Placeholder frames

`public/placeholder-frames/` (3 clips × (120 desktop + 60 mobile) = 540 WebP files + `manifest.json`) is **gitignored and generated** by `npm run frames:placeholder` from `docs/manifest.sample.json`, automatically on `predev`/`prebuild` when missing. This keeps the repo light. Flags: `--if-missing` (skip when up to date), `--force` (regenerate). It never touches `assets/frames/`.

## Asset contract

`assets/frames/` and `manifest.json` are owned by the Visual Asset Producer and are read-only here. See [docs/asset-contract.md](docs/asset-contract.md).

## legacy/

The 2017 v1 site, kept for reference only. It is not built or deployed and contains PII that must not be carried over.
