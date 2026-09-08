import { readFile, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import path from 'node:path';

const configPath = path.resolve('dist/server/wrangler.json');
const config = JSON.parse(await readFile(configPath, 'utf8'));
const runtimeKeys = ['DATABASE_URL', 'AUTH_USER_ID', 'AUTH_EMAIL', 'AUTH_DISPLAY_NAME', 'AUTH_PASSWORD'];
const runtimeValues = Object.fromEntries(
  runtimeKeys
    .filter((key) => process.env[key])
    .map((key) => [key, process.env[key]]),
);

config.vars = { ...config.vars, ...runtimeValues };
if (process.env.DATABASE_URL && Array.isArray(config.hyperdrive)) {
  config.hyperdrive = config.hyperdrive.map((binding) => ({
    ...binding,
    localConnectionString: process.env.DATABASE_URL,
  }));
}
await writeFile(configPath, `${JSON.stringify(config)}\n`);

const wrangler = process.platform === 'win32' ? 'wrangler.cmd' : 'wrangler';
const child = spawn(wrangler, ['dev', '--config', configPath, ...process.argv.slice(2)], {
  env: process.env,
  stdio: 'inherit',
});
child.on('exit', (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  else process.exit(code ?? 1);
});
