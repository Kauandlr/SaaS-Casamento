CREATE TABLE IF NOT EXISTS "security_rate_limits" (
  "key" text PRIMARY KEY,
  "window_start" timestamp with time zone NOT NULL,
  "count" integer NOT NULL
);
CREATE INDEX IF NOT EXISTS "idx_security_rate_limits_window_start" ON "security_rate_limits" ("window_start");
