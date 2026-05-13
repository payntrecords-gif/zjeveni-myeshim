const PBKDF2_ITERATIONS = 600000;
const SALT_LENGTH = 16;

function bytesToHex(bytes) {
  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

function hexToBytes(hex) {
  const pairs = hex.match(/.{1,2}/g) || [];
  return new Uint8Array(pairs.map((pair) => parseInt(pair, 16)));
}

function constantTimeEqual(left, right) {
  const leftLength = left.length;
  const rightLength = right.length;
  const maxLength = Math.max(leftLength, rightLength);
  let mismatch = leftLength ^ rightLength;
  for (let index = 0; index < maxLength; index += 1) {
    const leftCode = index < leftLength ? left.charCodeAt(index) : 0;
    const rightCode = index < rightLength ? right.charCodeAt(index) : 0;
    mismatch |= leftCode ^ rightCode;
  }
  return mismatch === 0;
}

async function derivePasswordHash(password, saltHex) {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    'PBKDF2',
    false,
    ['deriveBits']
  );
  const hashBuffer = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: hexToBytes(saltHex),
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256'
    },
    keyMaterial,
    256
  );
  return bytesToHex(new Uint8Array(hashBuffer));
}

export async function createPasswordRecord(password) {
  const saltHex = bytesToHex(crypto.getRandomValues(new Uint8Array(SALT_LENGTH)));
  const passwordHash = await derivePasswordHash(password, saltHex);
  return { passwordHash, passwordSalt: saltHex };
}

export async function verifyPassword(password, passwordHash, passwordSalt) {
  if (!passwordHash || !passwordSalt) return false;
  const inputHash = await derivePasswordHash(password, passwordSalt);
  return constantTimeEqual(inputHash, passwordHash);
}
