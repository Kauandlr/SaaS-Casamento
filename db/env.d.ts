declare namespace Cloudflare {
  interface Env {
    HYPERDRIVE: Hyperdrive;
    DATABASE_URL?: string;
    AUTH_USER_ID?: string;
    AUTH_EMAIL?: string;
    AUTH_DISPLAY_NAME?: string;
    AUTH_PASSWORD_HASH?: string;
    AUTH_PASSWORD?: string;
  }
}
