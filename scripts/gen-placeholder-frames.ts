/**
 * Placeholder frame generator.
 *
 * Reads docs/manifest.sample.json (source of truth), validates it with parseManifest, and writes
 * every frame (WebP) plus manifest.json into public/placeholder-frames/ (gitignored).
 * NEVER writes to assets/frames/ (owned by the Visual Asset Producer).
 *
 * Usage: tsx scripts/gen-placeholder-frames.ts [--if-missing] [--force]
 */
import { existsSync } from 'node:fs';
import { mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import {
  framePath,
  parseManifest,
  VARIANT_NAMES,
  type Clip,
  type FramesManifest,
  type Variant,
  type VariantName,
} from '../src/frames/manifest';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SAMPLE = path.join(ROOT, 'docs', 'manifest.sample.json');
const OUT_DIR = path.join(ROOT, 'public', 'placeholder-frames');
const PROTECTED_DIR = path.join(ROOT, 'assets', 'frames');

const FONT = "'DejaVu Sans', Arial, sans-serif";
const HERO_BG = '#8a8f98'; // neutral hero colour, independent of clip
const HERO_FG = '#ffffff';

// ---------------------------------------------------------------------------
// Colour helpers
// ---------------------------------------------------------------------------

function hsl(h: number, s: number, l: number): string {
  const hh = ((h % 360) + 360) % 360;
  return `hsl(${hh.toFixed(1)}, ${s.toFixed(1)}%, ${l.toFixed(1)}%)`;
}

function escapeXml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ---------------------------------------------------------------------------
// SVG rendering
// ---------------------------------------------------------------------------

interface FrameJob {
  clip: Clip;
  clipIndex: number;
  clipCount: number;
  variantName: VariantName;
  variant: Variant;
  frame: number;
  file: string;
}

function renderSvg(job: FrameJob): string {
  const { clip, clipIndex, clipCount, variantName, variant, frame } = job;
  const { width: w, height: h, frameCount } = variant;
  // Text stays inside the central 3:4 safe zone (width = 0.75 * height, or full width if narrower).
  const safeW = Math.min(w, h * 0.75);
  const cx = w / 2;
  const t = frameCount > 1 ? (frame - 1) / (frameCount - 1) : 0;

  const isHeroFirst = frame === 1;
  const isHeroLast = frame === frameCount;
  const heroId = isHeroFirst ? clip.from : isHeroLast ? clip.to : null;

  const parts: string[] = [];
  if (heroId !== null) {
    // Hero frames: identical across the clip boundary (no clip id / frame number / progress).
    parts.push(`<rect width="${w}" height="${h}" fill="${HERO_BG}"/>`);
    // Fit the label to 86% of the safe width (bold sans-serif averages ~0.62em per glyph).
    const label = `HERO: ${heroId}`;
    const heroFont = Math.min(safeW * 0.13, (safeW * 0.86) / (label.length * 0.62));
    parts.push(
      `<text x="${cx}" y="${h * 0.5}" text-anchor="middle" dominant-baseline="middle" ` +
        `font-family="${FONT}" font-weight="700" font-size="${heroFont.toFixed(1)}" fill="${HERO_FG}">` +
        `${escapeXml(label)}</text>`,
    );
    parts.push(
      `<text x="${cx}" y="${h * 0.5 + safeW * 0.16}" text-anchor="middle" font-family="${FONT}" ` +
        `font-size="${safeW * 0.05}" fill="${HERO_FG}" fill-opacity="0.85">${escapeXml(variantName)}</text>`,
    );
  } else {
    const baseHue = (clipIndex / clipCount) * 360 + 20;
    const hue = baseHue + t * 30; // subtle hue drift
    const light = 38 + 14 * Math.sin(t * Math.PI * 2); // subtle lightness drift
    const bg = hsl(hue, 55, light);
    const fg = '#ffffff';
    const num = String(frame).padStart(4, '0');

    parts.push(`<rect width="${w}" height="${h}" fill="${bg}"/>`);
    // Big frame number.
    parts.push(
      `<text x="${cx}" y="${h * 0.5}" text-anchor="middle" dominant-baseline="middle" ` +
        `font-family="${FONT}" font-weight="700" font-size="${safeW * 0.3}" fill="${fg}">${num}</text>`,
    );
    // Clip id, variant, "frame N / total".
    parts.push(
      `<text x="${cx}" y="${h * 0.5 - safeW * 0.27}" text-anchor="middle" font-family="${FONT}" ` +
        `font-weight="700" font-size="${safeW * 0.055}" fill="${fg}">${escapeXml(clip.id)}</text>`,
    );
    parts.push(
      `<text x="${cx}" y="${h * 0.5 - safeW * 0.2}" text-anchor="middle" font-family="${FONT}" ` +
        `font-size="${safeW * 0.045}" fill="${fg}" fill-opacity="0.85">${escapeXml(variantName)} ${w}x${h}</text>`,
    );
    parts.push(
      `<text x="${cx}" y="${h * 0.5 + safeW * 0.26}" text-anchor="middle" font-family="${FONT}" ` +
        `font-size="${safeW * 0.055}" fill="${fg}">frame ${frame} / ${frameCount}</text>`,
    );
    // Progress bar near the bottom, inside the safe zone.
    const barW = safeW * 0.8;
    const barH = Math.max(6, h * 0.014);
    const barX = cx - barW / 2;
    const barY = h * 0.9;
    parts.push(`<rect x="${barX}" y="${barY}" width="${barW}" height="${barH}" rx="${barH / 2}" fill="#000" fill-opacity="0.3"/>`);
    parts.push(`<rect x="${barX}" y="${barY}" width="${Math.max(barH, barW * t)}" height="${barH}" rx="${barH / 2}" fill="${fg}"/>`);
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${parts.join('')}</svg>`;
}

async function renderFrame(job: FrameJob): Promise<number> {
  const svg = Buffer.from(renderSvg(job));
  const out = await sharp(svg).webp({ quality: 50, effort: 0 }).toBuffer();
  const abs = path.join(OUT_DIR, job.file);
  await writeFile(abs, out);
  return out.length;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function countsKey(m: FramesManifest): string {
  return JSON.stringify(
    m.clips.map((c) => [c.id, ...VARIANT_NAMES.map((n) => [c.variants[n].frameCount, c.variants[n].width, c.variants[n].height])]),
  );
}

async function isUpToDate(sample: FramesManifest): Promise<boolean> {
  const manifestPath = path.join(OUT_DIR, 'manifest.json');
  if (!existsSync(manifestPath)) return false;
  try {
    const existing = parseManifest(JSON.parse(await readFile(manifestPath, 'utf8')));
    if (countsKey(existing) !== countsKey(sample)) return false;
  } catch {
    return false;
  }
  for (const clip of sample.clips) {
    for (const n of VARIANT_NAMES) {
      const v = clip.variants[n];
      for (let f = 1; f <= v.frameCount; f++) {
        if (!existsSync(path.join(OUT_DIR, framePath(v, f)))) return false;
      }
    }
  }
  return true;
}

function fmtBytes(n: number): string {
  return n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${(n / 1024).toFixed(0)} KB`;
}

async function main(): Promise<void> {
  const args = new Set(process.argv.slice(2));
  const known = new Set(['--if-missing', '--force']);
  for (const a of args) {
    if (!known.has(a)) throw new Error(`Unknown argument "${a}" (supported: --if-missing, --force)`);
  }

  if (path.resolve(OUT_DIR) === PROTECTED_DIR || OUT_DIR.startsWith(PROTECTED_DIR + path.sep)) {
    throw new Error('Refusing to write into assets/frames/ (owned by the Visual Asset Producer)');
  }

  const sample = parseManifest(JSON.parse(await readFile(SAMPLE, 'utf8')));

  if (args.has('--if-missing') && !args.has('--force') && (await isUpToDate(sample))) {
    console.log('placeholder frames: up to date, skipping (use --force to regenerate)');
    return;
  }

  const started = Date.now();
  await rm(OUT_DIR, { recursive: true, force: true });

  const jobs: FrameJob[] = [];
  const dirs = new Set<string>();
  sample.clips.forEach((clip, clipIndex) => {
    for (const variantName of VARIANT_NAMES) {
      const variant = clip.variants[variantName];
      for (let frame = 1; frame <= variant.frameCount; frame++) {
        const file = framePath(variant, frame);
        dirs.add(path.dirname(path.join(OUT_DIR, file)));
        jobs.push({ clip, clipIndex, clipCount: sample.clips.length, variantName, variant, frame, file });
      }
    }
  });
  await Promise.all([...dirs].map((d) => mkdir(d, { recursive: true })));

  // Small worker pool.
  let next = 0;
  let totalBytes = 0;
  const workers = Array.from({ length: Math.max(1, os.cpus().length) }, async () => {
    while (true) {
      const i = next++;
      const job = jobs[i];
      if (!job) return;
      try {
        const size = await renderFrame(job); // read-modify-write must not span an await
        totalBytes += size;
      } catch (err) {
        throw new Error(`Failed rendering ${job.file}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  });
  await Promise.all(workers);

  const manifestPath = path.join(OUT_DIR, 'manifest.json');
  await writeFile(manifestPath, JSON.stringify(sample, null, 2) + '\n');
  totalBytes += (await stat(manifestPath)).size;

  const secs = ((Date.now() - started) / 1000).toFixed(1);
  console.log(`placeholder frames: ${jobs.length} frames + manifest.json, ${fmtBytes(totalBytes)}, ${secs}s -> public/placeholder-frames/`);
}

main().catch((err) => {
  console.error(`gen-placeholder-frames failed: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
