
import { describe, it, expect, beforeAll } from 'vitest';
import { generateKeyPair, jwtVerify } from 'jose';

import { JwtSigner } from '../../infrastructure/crypto/jwt-signer.js';
import type { KeyProvider } from '../../infrastructure/crypto/key-provider.js';
import { KeyService } from './service.js';

describe('GridX JWT and JWKS Security Tests', () => {

    const ISSUER = 'https://auth.gridx.io';
    const AUDIENCE = 'gridx-services';
    const TTL_SECONDS = 3600;

    const CURRENT_KEY_ID = 'gridx-current-key';
    const PREVIOUS_KEY_ID = 'gridx-previous-key';

    let currentPrivateKey: CryptoKey;
    let currentPublicKey: CryptoKey;
    let previousPrivateKey: CryptoKey;
    let previousPublicKey: CryptoKey;

    let currentKeyProvider: KeyProvider;

    beforeAll(async () => {

        const currentPair = await generateKeyPair('EdDSA');
        const previousPair = await generateKeyPair('EdDSA');

        currentPrivateKey = currentPair.privateKey;
        currentPublicKey = currentPair.publicKey;

        previousPrivateKey = previousPair.privateKey;
        previousPublicKey = previousPair.publicKey;

        currentKeyProvider = {
            keyId: CURRENT_KEY_ID,
            privateKey: currentPrivateKey,
            publicKey: currentPublicKey,
        } as unknown as KeyProvider;

    });


    it('TC-01 signs a valid access token with the expected claims', async () => {

        const signer = new JwtSigner(
        currentKeyProvider,
        ISSUER,
        AUDIENCE,
        TTL_SECONDS,
        );

        const token = await signer.signAccessToken({
        sub: 'user-123',
        roles: ['prosumer'],
        });

        const { payload, protectedHeader } = await jwtVerify(
        token,
        currentPublicKey,
        { issuer: ISSUER, audience: AUDIENCE },
        );

        expect(protectedHeader.kid).toBe(CURRENT_KEY_ID);
        expect(payload.sub).toBe('user-123');
        expect(payload.roles).toEqual(['prosumer']);

    });

    it('TC-02 includes issued-at and expiration timestamps', async () => {

        const signer = new JwtSigner(

            currentKeyProvider,
            ISSUER,
            AUDIENCE,
            TTL_SECONDS,

        );

        const token = await signer.signAccessToken({ sub: 'user-123' });

        const { payload } = await jwtVerify(token, currentPublicKey, {

            issuer: ISSUER,
            audience: AUDIENCE,

        });

        expect(payload.iat).toBeDefined();
        expect(payload.exp).toBeDefined();
        expect(payload.exp! - payload.iat!).toBe(TTL_SECONDS);

    });

    it('TC-03 rejects an expired access token', async () => {

        const signer = new JwtSigner(

            currentKeyProvider,
            ISSUER,
            AUDIENCE,
            -1,

        );

        const token = await signer.signAccessToken({
            sub: 'expired-user',
        });

        await expect(

            jwtVerify(token, currentPublicKey, {
                issuer: ISSUER,
                audience: AUDIENCE,
            }),

        ).rejects.toMatchObject({
            code: 'ERR_JWT_EXPIRED',
        });

    });

    
    it('TC-04 rejects a token signed with an unrelated key', async () => {

        const signer = new JwtSigner(

            currentKeyProvider,
            ISSUER,
            AUDIENCE,
            TTL_SECONDS,

        );

        const token = await signer.signAccessToken({
            sub: 'user-123',
        });

        const unrelatedPair = await generateKeyPair('EdDSA');

        await expect(

            jwtVerify(token, unrelatedPair.publicKey, {
                issuer: ISSUER,
                audience: AUDIENCE,
            }),

        ).rejects.toMatchObject({
            code: 'ERR_JWS_SIGNATURE_VERIFICATION_FAILED',
        });
        
    });

    it('TC-05 rejects a token with an unknown key ID', async () => {

        const signer = new JwtSigner(

            currentKeyProvider,
            ISSUER,
            AUDIENCE,
            TTL_SECONDS,

        );

        const token = await signer.signAccessToken({
            sub: 'user-123',
        });

        await expect(

            jwtVerify(

                token,
                async (header) => {

                    if (header.kid !== 'some-other-key') {
                        throw new Error('Unknown signing key');
                    }

                    return currentPublicKey;

                },
                { issuer: ISSUER, audience: AUDIENCE },

            ),

        ).rejects.toThrow('Unknown signing key');

    });

    
    it('TC-06 verifies a token signed with the current key', async () => {
        const signer = new JwtSigner(

            currentKeyProvider,
            ISSUER,
            AUDIENCE,
            TTL_SECONDS,

        );

        const token = await signer.signAccessToken({
            sub: 'current-user',
        });

        const { payload } = await jwtVerify(token, currentPublicKey, {

            issuer: ISSUER,
            audience: AUDIENCE,

        });

        expect(payload.sub).toBe('current-user');

    });

    
    it('TC-07 verifies a token signed with a trusted previous key', async () => {
       
        const previousKeyProvider = {

            keyId: PREVIOUS_KEY_ID,
            privateKey: previousPrivateKey,
            publicKey: previousPublicKey,

        } as unknown as KeyProvider;

        const previousSigner = new JwtSigner(

            previousKeyProvider,
            ISSUER,
            AUDIENCE,
            TTL_SECONDS,

        );

        const token = await previousSigner.signAccessToken({
            sub: 'previous-key-user',
        });

        const { payload, protectedHeader } = await jwtVerify(

            token,
            async (header) => {

                if (header.kid === CURRENT_KEY_ID) {
                    return currentPublicKey;
                }

                if (header.kid === PREVIOUS_KEY_ID) {
                    return previousPublicKey;
                }

                throw new Error('Untrusted signing key');

            },
            { issuer: ISSUER, audience: AUDIENCE },

        );

        expect(payload.sub).toBe('previous-key-user');
        expect(protectedHeader.kid).toBe(PREVIOUS_KEY_ID);

    });

    it('TC-08 rejects a token signed with a retired key', async () => {

        const previousKeyProvider = {

            keyId: PREVIOUS_KEY_ID,
            privateKey: previousPrivateKey,
            publicKey: previousPublicKey,

        } as unknown as KeyProvider;

        const previousSigner = new JwtSigner(

            previousKeyProvider,
            ISSUER,
            AUDIENCE,
            TTL_SECONDS,

        );

        const token = await previousSigner.signAccessToken({
            sub: 'retired-key-user',
        });

        await expect(

            jwtVerify(

                token,
                async (header) => {

                    if (header.kid !== CURRENT_KEY_ID) {
                        throw new Error('Untrusted signing key');
                    }

                    return currentPublicKey;

                },
                { issuer: ISSUER, audience: AUDIENCE },

            ),

        ).rejects.toThrow('Untrusted signing key');

    });

    it('TC-09 publishes the current public key through JWKS', () => {
        const publicJwk = {

            kty: 'OKP',
            crv: 'Ed25519',
            x: 'current-public-key',
            kid: CURRENT_KEY_ID,
            alg: 'EdDSA',
            use: 'sig',
            key_ops: ['verify'],

        };

        const keyService = new KeyService({
            publicJwk,
        } as unknown as KeyProvider);

        expect(keyService.getJwks()).toEqual({
            keys: [publicJwk],
        });

    });

    it('TC-10 publishes current and previous public keys through JWKS', () => {
        const currentPublicJwk = {

            kty: 'OKP',
            crv: 'Ed25519',
            x: 'current-public-key',
            kid: CURRENT_KEY_ID,
            alg: 'EdDSA',
            use: 'sig',
            key_ops: ['verify'],

        };

        const previousPublicJwk = {

            kty: 'OKP',
            crv: 'Ed25519',
            x: 'previous-public-key',
            kid: PREVIOUS_KEY_ID,
            alg: 'EdDSA',
            use: 'sig',
            key_ops: ['verify'],

        };

        const keyService = new KeyService(
            {
                publicJwk: currentPublicJwk,
            } as unknown as KeyProvider,
            [previousPublicJwk],
        );

        expect(keyService.getJwks()).toEqual({
            keys: [currentPublicJwk, previousPublicJwk],
        });

    });

});
