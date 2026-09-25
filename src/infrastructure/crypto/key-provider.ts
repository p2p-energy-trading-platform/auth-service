import { readFile } from 'node:fs/promises';

import { exportJWK, importPKCS8, importSPKI, type JWK } from 'jose';

interface KeyProviderOptions {
  privateKeyPath: string;
  publicKeyPath: string;
  keyId: string;
}

export class KeyProvider {
  private constructor(
    readonly privateKey: CryptoKey,
    readonly publicKey: CryptoKey,
    readonly publicJwk: JWK,
    readonly keyId: string,
  ) {}

  static async fromFiles(options: KeyProviderOptions): Promise<KeyProvider> {
    const [privatePem, publicPem] = await Promise.all([
      readFile(options.privateKeyPath, 'utf8'),
      readFile(options.publicKeyPath, 'utf8'),
    ]);

    const privateKey = await importPKCS8(privatePem, 'EdDSA');
    const publicKey = await importSPKI(publicPem, 'EdDSA');

    const publicJwk = await exportJWK(publicKey);

    return new KeyProvider(
      privateKey,
      publicKey,
      {
        ...publicJwk,
        kid: options.keyId,
        alg: 'EdDSA',
        use: 'sig',
        key_ops: ['verify'],
      },
      options.keyId,
    );
  }
}
