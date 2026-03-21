/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL: string;
  readonly VITE_API_KEY: string;
  readonly VITE_STRIPE_PUBLISHABLE_KEY: string;
  readonly VITE_HEDERA_NETWORK: string;
  readonly VITE_HEDERA_APP_NAME: string;
  readonly VITE_HEDERA_APP_DESCRIPTION: string;
  readonly VITE_WALLETCONNECT_PROJECT_ID: string;
  readonly VITE_HCS_TOPIC_ID: string;
  /** Cuenta Hedera del recolector de fees (0.0.x) para el dashboard público. */
  readonly VITE_FEE_COLLECTOR_ID?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
