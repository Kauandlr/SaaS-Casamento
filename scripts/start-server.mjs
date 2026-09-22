import { chmod, readFile, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import path from 'node:path';

const configPath = path.resolve('dist/server/wrangler.json');
const config = JSON.parse(await readFile(configPath, 'utf8'));
if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL must be set before starting the server.');
const runtimeKeys = [
  'NODE_ENV',
  'DATABASE_URL',
  'APP_URL',
  'RESEND_API_KEY',
  'RESEND_FROM_EMAIL',
  'AUTH_USER_ID',
  'AUTH_EMAIL',
  'AUTH_DISPLAY_NAME',
  'AUTH_PASSWORD_HASH',
  'AUTH_PASSWORD',
  'OPENAI_API_KEY',
  'OPENAI_MODEL',
  'OPENAI_BASE_URL',
  'TURNSTILE_SITE_KEY',
  'TURNSTILE_SECRET_KEY',
];
const runtimeValues = Object.fromEntries(
  runtimeKeys.filter((key) => process.env[key]).map((key) => [key, process.env[key]]),
);

// Wrangler loads local secrets from .dev.vars beside its configuration file.
// A separate, private file keeps credentials out of wrangler.json and build output.
const devVarsPath = path.join(path.dirname(configPath), '.dev.vars');
await writeFile(devVarsPath, Object.entries(runtimeValues)
  .map(([key, value]) => `${key}=${JSON.stringify(value)}`)
  .join('\n') + '\n', { mode: 0o600 });
await chmod(devVarsPath, 0o600);
for (const key of runtimeKeys) delete config.vars?.[key];
config.hyperdrive = [];
await writeFile(configPath, `${JSON.stringify(config)}\n`);

const wrangler = process.platform === 'win32' ? 'wrangler.cmd' : 'wrangler';
const child = spawn(wrangler, ['dev', '--config', configPath, '--env-file', devVarsPath, ...process.argv.slice(2)], {
  env: process.env,
  stdio: 'inherit',
});
child.on('exit', (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  else process.exit(code ?? 1);
});
