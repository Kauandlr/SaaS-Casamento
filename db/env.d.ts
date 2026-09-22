declare namespace Cloudflare {
  interface Env {
    NODE_ENV?: string;
    HYPERDRIVE: Hyperdrive;
    DATABASE_URL?: string;
    APP_URL?: string;
    RESEND_API_KEY?: string;
    RESEND_FROM_EMAIL?: string;
    AUTH_USER_ID?: string;
    AUTH_EMAIL?: string;
    AUTH_DISPLAY_NAME?: string;
    AUTH_PASSWORD_HASH?: string;
    /** @deprecated Generate AUTH_PASSWORD_HASH with `npm run auth:hash`. */
    AUTH_PASSWORD?: string;
    OPENAI_API_KEY?: string;
    OPENAI_MODEL?: string;
    OPENAI_BASE_URL?: string;
    TURNSTILE_SITE_KEY?: string;
    TURNSTILE_SECRET_KEY?: string;
  }
}
