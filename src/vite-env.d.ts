/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_BASE?: string
  readonly VITE_DB_MODE?: 'turso' | 'local'
  readonly VITE_TURSO_URL?: string
  readonly VITE_ADMIN_PASS_HASH?: string
  readonly VITE_ANALYTICS_ENDPOINT?: string
  readonly VITE_ANALYTICS_SAMPLE?: string
  readonly VITE_SITE_NAME?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

declare module '*.wasm?url' {
  const src: string
  export default src
}
