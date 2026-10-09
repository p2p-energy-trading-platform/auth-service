import Fastify from 'fastify';
import { afterEach, describe, expect, it } from 'vitest';

import type { KeyService } from '../../features/keys/service.js';
import jwksRoute from './jwks.js';


describe('JWKS HTTP route', () => {

    const app = Fastify();

    const publicJwk = {

        kty: 'OKP',
        crv: 'Ed25519',
        x: 'example-public-key',
        kid: 'gridx-test-key',
        alg: 'EdDSA',
        use: 'sig',
        key_ops: ['verify'],

    };

    app.decorate('keyService', {
        getJwks: () => ({ keys: [publicJwk] }),
    } as unknown as KeyService);

    afterEach(async () => {
        await app.close();
    });

    it('returns the public keys and cache headers', async () => {

        await app.register(jwksRoute);

        const response = await app.inject({
            method: 'GET',
            url: '/.well-known/jwks.json',
        });

        expect(response.statusCode).toBe(200);
        expect(response.json()).toEqual({ keys: [publicJwk] });
        expect(response.headers['cache-control']).toBe('public, max-age=300');

    });

});