/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_REVENUECAT_WEB_KEY: string
  readonly VITE_REVENUECAT_IOS_KEY: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
