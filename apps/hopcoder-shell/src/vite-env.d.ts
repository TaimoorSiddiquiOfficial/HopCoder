/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_AZURE_PROJECT_ENDPOINT: string
  readonly VITE_AZURE_AGENT_NAME: string
  readonly VITE_AZURE_API_VERSION: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
