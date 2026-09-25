/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_KIX_PROTOCOL_MODE?: string;
  readonly VITE_KIX_PROTOCOL_API_BASE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
