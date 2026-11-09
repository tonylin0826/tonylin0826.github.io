/// <reference types="vitest/config" />
import { createReadStream, existsSync, statSync } from 'node:fs';
import { cp } from 'node:fs/promises';
import { dirname, extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, type Plugin } from 'vite';

const ROOT = dirname(fileURLToPath(import.meta.url));
const FRAMES_DIR = resolve(ROOT, 'assets/frames');
const FRAMES_URL = '/assets/frames/';

const MIME: Record<string, string> = {
  '.json': 'application/json',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
};

/**
 * assets/frames/ is owned by the Visual Asset Producer (read-only for us).
 * - dev: serve /assets/frames/* straight from the folder (if it exists).
 * - build: copy the folder to dist/assets/frames (if it exists).
 * Nothing is ever written to assets/frames.
 */
function framesPlugin(): Plugin {
  let outDir = resolve(ROOT, 'dist');
  return {
    name: 'serve-and-copy-frames',
    configResolved(config) {
      outDir = resolve(config.root, config.build.outDir);
    },
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = (req.url ?? '').split('?')[0] ?? '';
        if (!url.startsWith(FRAMES_URL) || !existsSync(FRAMES_DIR)) return next();
        // Resolve the file and guard against path traversal.
        const rel = normalize(decodeURIComponent(url.slice(FRAMES_URL.length)));
        const file = join(FRAMES_DIR, rel);
        if (!file.startsWith(FRAMES_DIR + sep) || !existsSync(file) || !statSync(file).isFile()) {
          return next();
        }
        res.setHeader('Content-Type', MIME[extname(file).toLowerCase()] ?? 'application/octet-stream');
        createReadStream(file).pipe(res);
      });
    },
    async closeBundle() {
      if (!existsSync(FRAMES_DIR)) return;
      await cp(FRAMES_DIR, join(outDir, 'assets/frames'), { recursive: true });
    },
  };
}

export default defineConfig(({ command }) => ({
  base: '/',
  define: {
    // Build: only probe /assets/frames/manifest.json if it exists (avoids a console 404). Dev always probes.
    __HAS_ASSET_FRAMES__: JSON.stringify(
      command === 'serve' || existsSync(resolve(FRAMES_DIR, 'manifest.json')),
    ),
  },
  publicDir: 'public',
  plugins: [framesPlugin()],
  build: {
    target: 'es2020', // Safari 14+ safe
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
}));
