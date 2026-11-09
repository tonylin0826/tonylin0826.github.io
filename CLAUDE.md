# CLAUDE.md

Guidance for Claude Code when working in this repository.

## What this project is

Tony Lin's personal website (`tonylin0826.github.io`), being rebuilt as a **scroll-driven experience**.

- **`main`** — old 2017 static Bootstrap/Bower site. Tagged `v1-old-site`. Keep untouched until launch.
- **`gh-pages`** — default branch today; compiled Angular 11 build served by GitHub Pages (legacy). Angular source is **not** in this repo.
- **`rebuild`** — (not created yet) future home of the new site. Do not create or start the rebuild until Tony says so.

## Stack / build / test / run

### Rebuild stack — TBD (placeholder)

Stack not chosen yet. Update this section once decided. Expected shape:

- TypeScript (strict)
- npm scripts: `dev`, `build`, `test`, `lint`
- Framework / bundler: TBD

Until then there is no rebuild toolchain to run.

### Current old-site reality

| Branch | What it is | Build | Deploy |
| --- | --- | --- | --- |
| `main` | Static HTML/CSS/JS (Bootstrap 3, jQuery, Bower, typed.js, D3 via CDN) | None — open `index.html` or `python3 -m http.server` | Not the live site |
| `gh-pages` | Compiled Angular 11 + Material + xterm.js output | Source missing; historically `angular-cli-ghpages` | GitHub Pages (live) |

Preview old `main`: open `index.html` or run any static server from the repo root.

## Repo conventions

Tony's instruction (2026-11-08): **no pull requests — push directly**.

- Rebuild work lives on branch `rebuild`. Feature branches branch off `rebuild`, merge back into `rebuild`, and are **pushed directly**.
- `main` stays untouched until launch. At launch, `rebuild` merges into `main` only with Tony's **explicit approval**.
- **Never force-push.**
- **Never push to `main` or `gh-pages` without Tony's approval.**
- Never print, log, or commit secrets/tokens (`GH_TOKEN`, `CLAUDE_CODE_OAUTH_TOKEN`, API keys, `.env`).
- Small, focused commits with clear messages.
- Git identity in this repo: `Software Engineer (bot)` / GitHub no-reply email (already configured).

## Asset contract (READ-ONLY)

Owned by **Visual Asset Producer** (another contributor). Claude Code may **consume** these; never edit, move, delete, or regenerate them. Request changes via Tony.

- `assets/frames/`
- `manifest.json`

Manifest format is to be agreed with Visual Asset Producer and recorded here when settled.

## Code style and quality bar

- TypeScript, strict mode.
- Small focused commits; clear messages; no drive-by refactors or unexplained new dependencies (say why before adding any).
- Tests for core logic.
- Lighthouse **90+** on mobile for performance, accessibility, best practices, and SEO.
- Accessibility: semantic HTML, keyboard navigation, visible focus states, `prefers-reduced-motion` respected for scroll animations, alt text, sufficient contrast.

## Carry-over from the old site

Must plan to carry (or consciously drop with Tony):

| Item | Notes |
| --- | --- |
| Terminal | Bottom-right xterm.js; commands `help`, `profile`, `resume`, `portfolio`, `links`. Command map + copy are portable; Angular wrapper is not — rewrite the UI shell. |
| Resume | Enhancv link (confirm whether to keep link or add a PDF). |
| Social links | LinkedIn URL inconsistency: `tonylintw` vs `tony-lin-b18b29ba` — resolve with Tony. |
| Portfolio list | yeelight.io, Hikoo, ModbusMasterTool, http.io.c (plus older screenshots under `resources/asset/` on `main`). |
| Analytics | GA4 `G-ZFJKSDJ43L` — keep/drop TBD. |
| Deploy | GitHub Pages; plan GitHub Actions at launch, keep `gh-pages` live until then. |
| Images | Oversized background images on live build — replace. |
| PII | DOB / street address / phone in old `main` `index.html` — **do not carry over**. |

## Decisions log

- 2026-11-08: `master` → `main`; tagged `v1-old-site`.
- 2026-11-08: No PRs; push feature/rebuild branches directly. Never force-push; never push `main`/`gh-pages` without approval.
- 2026-11-08: Claude Code adopted for all coding work; this file + `.claude/settings.json` added on `setup/claude-code`.
- Rebuild stack: **TBD**.
- Asset manifest format: **TBD** (agree with Visual Asset Producer).
- GA4 keep/drop: **TBD**.
- LinkedIn URL: **TBD**.
- Resume format (Enhancv vs PDF): **TBD**.
