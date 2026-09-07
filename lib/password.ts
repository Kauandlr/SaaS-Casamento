function base64url(bytes: Uint8Array): string {
  let value = '';
  for (const byte of bytes) value += String.fromCharCode(byte);
  return btoa(value).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
}

function fromBase64url(value: string): Uint8Array {
  const padded = value.replaceAll('-', '+').replaceAll('_', '/') + '='.repeat((4 - (value.length % 4)) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function equalBytes(left: Uint8Array, right: Uint8Array): boolean {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) difference |= left[index] ^ right[index];
  return difference === 0;
}

export async function verifyPassword(password: string, encoded: string): Promise<boolean> {
  const [algorithm, iterationText, saltText, digestText] = encoded.split('$');
  if (algorithm !== 'pbkdf2-sha256' || !iterationText || !saltText || !digestText) return false;
  const iterations = Number(iterationText);
  if (!Number.isSafeInteger(iterations) || iterations < 100_000 || iterations > 2_000_000) return false;
  try {
    const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
    const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt: fromBase64url(saltText) as unknown as BufferSource, iterations, hash: 'SHA-256' }, key, 256);
    return equalBytes(new Uint8Array(bits), fromBase64url(digestText));
  } catch { return false; }
}

export async function verifyPlainPassword(password: string, expected: string): Promise<boolean> {
  const [actualDigest, expectedDigest] = await Promise.all([
    crypto.subtle.digest('SHA-256', new TextEncoder().encode(password)),
    crypto.subtle.digest('SHA-256', new TextEncoder().encode(expected)),
  ]);
  return equalBytes(new Uint8Array(actualDigest), new Uint8Array(expectedDigest));
}

export { base64url };
