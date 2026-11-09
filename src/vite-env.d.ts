/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Optional override for the frames base URL (folder containing manifest.json). */
  readonly VITE_FRAMES_BASE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
