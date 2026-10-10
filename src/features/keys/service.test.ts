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

    
    it('publishes the current and previous public keys through JWKS', () => {
        
        const currentPublicJwk = {
            kty: 'OKP',
            crv: 'Ed25519',
            x: 'current-public-key',
            kid: 'gridx-current-key',
            alg: 'EdDSA',
            use: 'sig',
            key_ops: ['verify'],
        };

        const previousPublicJwk = {
            kty: 'OKP',
            crv: 'Ed25519',
            x: 'previous-public-key',
            kid: 'gridx-previous-key',
            alg: 'EdDSA',
            use: 'sig',
            key_ops: ['verify'],
        };

        const keyProvider = {
            publicJwk: currentPublicJwk,
        } as unknown as KeyProvider;

        const keyService = new KeyService(
            keyProvider,
            [previousPublicJwk],
        );

        expect(keyService.getJwks()).toEqual({
            keys: [currentPublicJwk, previousPublicJwk],
        });
        
    });

});