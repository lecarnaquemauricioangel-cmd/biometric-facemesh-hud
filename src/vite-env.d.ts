/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_FACE_MODEL_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
