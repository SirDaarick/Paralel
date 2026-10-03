/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly DEMO_MODE?: string;
  readonly VITE_DEMO_MODE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
