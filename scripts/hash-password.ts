import { stdin as input, stdout as output } from 'node:process';
import { randomBytes, webcrypto } from 'node:crypto';

const iterations = 600_000;
function readPassword(): Promise<string> {
  if (!input.isTTY || !input.setRawMode) {
    return new Promise((resolve) => { input.once('data', (value) => resolve(String(value).trim())); output.write('Senha: '); });
  }
  return new Promise((resolve) => {
    let password = '';
    output.write('Senha: ');
    input.setRawMode!(true);
    input.resume();
    const onData = (value: Buffer) => {
      for (const character of value.toString()) {
        if (character === '\u0003') process.exit(130);
        if (character === '\r' || character === '\n') {
          input.setRawMode!(false); input.pause(); input.off('data', onData); output.write('\n'); resolve(password); return;
        }
        if (character === '\u007f') password = password.slice(0, -1);
        else password += character;
      }
    };
    input.on('data', onData);
  });
}

const password = await readPassword();
if (!password) throw new Error('A senha não pode ser vazia.');
const salt = randomBytes(16);
const key = await webcrypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
const digest = new Uint8Array(await webcrypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations, hash: 'SHA-256' }, key, 256));
const encode = (bytes: Uint8Array) => Buffer.from(bytes).toString('base64url');
console.log(`pbkdf2-sha256$${iterations}$${encode(salt)}$${encode(digest)}`);
