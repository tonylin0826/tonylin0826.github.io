# Asset contract — frames manifest (schema v1)

Agreed between **Software Engineer** (site code) and **Visual Asset Producer** (VAP) in the team chat.
Types, validator and helpers: [`src/frames/manifest.ts`](../src/frames/manifest.ts). Full example: [`manifest.sample.json`](./manifest.sample.json).

## Ownership

- **VAP owns `assets/frames/`**, including `assets/frames/manifest.json`.
- Site code **never edits, moves, deletes or regenerates** anything there. We only commit the files unchanged, as delivered.
- Any contract change is **proposed in the team chat and agreed first**, then reflected here.

## Folder layout

Paths in the manifest are **relative to the manifest's folder** (`assets/frames/`).

```
assets/frames/
  manifest.json
  t1-badminton-golf/
    desktop/0001.webp … 0120.webp
    mobile/0001.webp  … 0060.webp
  t2-golf-dogs/ …
  t3-dogs-engineer/ …
```

## Schema v1

```jsonc
{
  "version": 1, "format": "webp", "fps": 24, "background": "#d9d9d9",
  "heroes": ["badminton", "golf", "dogs", "engineer"],
  "clips": [
    { "id": "t1-badminton-golf", "from": "badminton", "to": "golf",
      "variants": {
        "desktop": { "frameCount": 120, "width": 1920, "height": 1080, "pathPattern": "t1-badminton-golf/desktop/{frame:04}.webp" },
        "mobile":  { "frameCount": 60,  "width": 810,  "height": 1080, "pathPattern": "t1-badminton-golf/mobile/{frame:04}.webp" } },
      "heroFrames": { "start": 1, "end": "last" },
      "poster": { "desktop": "t1-badminton-golf/desktop/0001.webp", "mobile": "t1-badminton-golf/mobile/0001.webp" } }
  ]
}
```

| Field | Type | Meaning / rules |
| --- | --- | --- |
| `version` | `1` | Schema version. Anything else is rejected. |
| `format` | `"webp"` | Frame image format. WebP ~q80. |
| `fps` | number > 0 | **Reference only.** Scroll drives playback; used for reduced-motion / autoplay timing. |
| `background` | hex colour (`#rgb` / `#rrggbb`) | Canvas letterbox/fill colour. VAP will update it once the real studio grey is measured (proposed in chat first). |
| `heroes` | string[] | Hero ids in scroll order. Must equal `[clips[0].from, ...clips.map(c => c.to)]`. Unique. Ids may still change. |
| `clips` | Clip[] | Non-empty. **Array order = scroll order.** |
| `clips[].id` | string | Unique clip id, also the folder name (e.g. `t1-badminton-golf`). |
| `clips[].from` / `.to` | string | Hero ids at the start / end of the clip. Clip *i*'s `to` must equal clip *i+1*'s `from`. |
| `clips[].variants` | `{ desktop, mobile }` | Exactly these two variant names (`VariantName`); both required; any other key is an error. |
| `variants.*.frameCount` | integer ≥ 1 | Number of frames; 1-based, no gaps. |
| `variants.*.width` / `.height` | even integers | Desktop 1920×1080 (16:9), mobile 810×1080 (3:4). All frames in a variant share these. |
| `variants.*.pathPattern` | string | Relative path with exactly one token: `{frame:04}` (zero-pad to 4; generic `{frame:0N}` pads to N) or `{frame}` (unpadded). No leading `/`, scheme or `..`. |
| `clips[].heroFrames` | `{ start, end }` | 1-based frame numbers or `"last"` (= `frameCount`). Must fit the smaller variant and `start <= end`. |
| `clips[].poster` | `{ desktop, mobile }` | Path of a real frame for that variant (normally frame 1) — used as the first paint before frames load. Must match the variant's pattern and range. |

## Rules

- Frames are **1-based, zero-padded to 4 digits** (`{frame:04}`), with **no gaps**. `"last"` means `frameCount`.
- **Shared boundary frames:** each clip's last frame is identical to the next clip's first frame. The player draws that frame once, i.e. it **skips frame 1 of every clip after the first** in the global timeline.
- **Hero stills** are clip first/last frames; the site decides how long to hold at each hero while scrolling. In `buildTimeline`, `heroes[0]` maps to clip 0's `heroFrames.start` and `heroes[i≥1]` to clip *i-1*'s `heroFrames.end`.
- Both dimensions of every variant are **even**. The canvas letterboxes/fills extra space with `background`.
- Size budget: mobile target **< 60 KB/frame**.
- Unknown extra keys outside `variants`/`poster` are tolerated (forward-compatible, additive only); breaking changes bump `version`.

## Validation

`parseManifest(json: unknown): FramesManifest` validates at runtime and throws `ManifestError` whose `problems` array (and message) lists **all** issues with JSON-path-like locations, e.g.

```
$.clips[1].from: "tennis" must equal previous clip's to "golf"
$.clips[0].variants.desktop.height: must be even (got 1081)
```

Checks: version, format, fps, background, heroes ↔ clip chain, duplicate clip ids, variants (known names, frameCount, even dims, pattern token), `heroFrames`, poster validity.

Helpers (pure, no DOM): `framePath(variant, frame)`, `resolveHeroFrame(h, frameCount)`, `buildTimeline(manifest, variantName)` → `{ frames: {clipId, frame, path}[], heroIndex: Record<heroId, number> }` with boundary frames de-duplicated.

Tests: `npm test` (`src/frames/manifest.test.ts`, which also validates `docs/manifest.sample.json`).

## Change process

1. Propose the change in the team chat (VAP + Software Engineer; Tony for creative/hero decisions).
2. Agree it, then update this document, the sample, the types/validator and tests together. Breaking changes bump `version`.
3. VAP delivers files under `assets/frames/`; we commit them unchanged.

Currently open: final `background` value (VAP to measure the studio grey); hero ids may still change (e.g. `oreo` → `dogs` already happened: the dog scene has 3 dogs — Rachel, Oreo, Kuro).

## Loading and placeholder fallback

The app loads `/assets/frames/manifest.json` when present; otherwise it falls back to generated placeholder frames at `/placeholder-frames/manifest.json` (same schema). Override the base with `VITE_FRAMES_BASE`.

Placeholders are **ours**: generated by `npm run frames:placeholder` into `public/placeholder-frames/`, **gitignored**, and created automatically by `predev`/`prebuild` if missing. They are never written to `assets/frames/`.
