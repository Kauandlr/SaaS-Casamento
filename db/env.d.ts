declare namespace Cloudflare {
  interface Env {
    HYPERDRIVE: Hyperdrive;
    DATABASE_URL?: string;
    AUTH_USER_ID?: string;
    AUTH_EMAIL?: string;
    AUTH_DISPLAY_NAME?: string;
    AUTH_PASSWORD?: string;
    OPENAI_API_KEY?: string;
    OPENAI_MODEL?: string;
  }
}
