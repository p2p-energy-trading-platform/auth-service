import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { generateKeyPair, exportPKCS8, exportSPKI } from 'jose';

const SECRETS_DIR = join(process.cwd(), 'secrets');
const PRIVATE_KEY_PATH = join(SECRETS_DIR, 'auth-private.pem');
const PUBLIC_KEY_PATH = join(SECRETS_DIR, 'auth-public.pem');

async function ensureKeysExist() {
  if (existsSync(PRIVATE_KEY_PATH) && existsSync(PUBLIC_KEY_PATH)) {
    return;
  }

  console.log('Generating local Ed25519 dev/test keypair in ./secrets...');

  if (!existsSync(SECRETS_DIR)) {
    mkdirSync(SECRETS_DIR, { recursive: true });
  }

  const { privateKey, publicKey } = await generateKeyPair('EdDSA', { extractable: true });
  const privatePem = await exportPKCS8(privateKey);
  const publicPem = await exportSPKI(publicKey);

  writeFileSync(PRIVATE_KEY_PATH, privatePem, 'utf8');
  writeFileSync(PUBLIC_KEY_PATH, publicPem, 'utf8');

  console.log('Keys generated successfully.');
}

ensureKeysExist().catch((err) => {
  console.error('Failed to generate dev keys:', err);
  process.exit(1);
});