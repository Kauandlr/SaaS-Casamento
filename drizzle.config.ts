import { defineConfig } from 'drizzle-kit';
import 'dotenv/config';

export default defineConfig({
  out: './drizzle/postgres',
  schema: './db/schema.ts',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL ?? '',
  },
});
