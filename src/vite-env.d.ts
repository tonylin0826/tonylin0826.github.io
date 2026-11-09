/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Optional override for the frames base URL (folder containing manifest.json). */
  readonly VITE_FRAMES_BASE?: string;
}

/** Compile-time: false when a production build found no assets/frames/manifest.json. */
declare const __HAS_ASSET_FRAMES__: boolean;

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
