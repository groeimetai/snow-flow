interface ImportMetaEnv {
  readonly VITE_SNOW_CODE_SERVER_HOST: string
  readonly VITE_SNOW_CODE_SERVER_PORT: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
