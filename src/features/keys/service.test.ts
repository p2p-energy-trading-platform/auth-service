import { describe, expect, it } from 'vitest';
import type { KeyProvider } from '../../infrastructure/crypto/key-provider.js';
import { KeyService } from './service.js';


describe('KeyService', () => {

    it('publishes the configured public key through JWKS', () => {

        const publicJwk = {

            kty: 'OKP',
            crv: 'Ed25519',
            x: 'example-public-key',
            kid: 'gridx-test-key',
            alg: 'EdDSA',
            use: 'sig',
            key_ops: ['verify']

        };

        const keyProvider = {
            publicJwk,
        } as unknown as KeyProvider;


        const keyService = new KeyService(keyProvider);

        expect(keyService.getJwks()).toEqual({
            keys: [publicJwk],
        });

        expect(keyService.getJwks().keys[0]).toMatchObject({

            kid: 'gridx-test-key',
            alg: 'EdDSA',
            use: 'sig',
            key_ops: ['verify'],

        });

    });

});