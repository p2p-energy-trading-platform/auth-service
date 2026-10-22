import { S3Client } from '@aws-sdk/client-s3';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { S3FileStorage } from './s3-storage.js';

function createStorage() {
  return new S3FileStorage({
    endpoint: 'http://minio:9000',
    publicEndpoint: 'http://localhost:9000',
    region: 'us-east-1',
    bucket: 'gridx-kyc',
    accessKeyId: 'auth-service',
    secretAccessKey: 'test-secret-key',
    forcePathStyle: true,
  });
}

describe('S3FileStorage', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('createUploadUrl', () => {
    it('signs a PUT URL for the browser-facing endpoint and object key', async () => {
      const url = new URL(
        await createStorage().createUploadUrl({
          key: 'kyc/user-1/doc.jpg',
          contentType: 'image/jpeg',
          sizeBytes: 2048,
          expiresInSeconds: 300,
        }),
      );

      expect(url.origin).toBe('http://localhost:9000');
      expect(url.pathname).toBe('/gridx-kyc/kyc/user-1/doc.jpg');
      expect(url.searchParams.get('X-Amz-Expires')).toBe('300');
      expect(url.searchParams.get('X-Amz-Credential')).toMatch(/^auth-service\//);
    });

    it('signs the content type and size so a different file cannot be uploaded', async () => {
      const url = new URL(
        await createStorage().createUploadUrl({
          key: 'kyc/user-1/doc.pdf',
          contentType: 'application/pdf',
          sizeBytes: 4096,
          expiresInSeconds: 300,
        }),
      );

      const signedHeaders = url.searchParams.get('X-Amz-SignedHeaders')?.split(';');

      expect(signedHeaders).toEqual(
        expect.arrayContaining(['content-length', 'content-type', 'host']),
      );
    });
  });

  describe('getObjectInfo', () => {
    it('returns the stored size and content type', async () => {
      vi.spyOn(S3Client.prototype, 'send').mockResolvedValue({
        ContentLength: 2048,
        ContentType: 'image/jpeg',
      } as never);

      await expect(createStorage().getObjectInfo('kyc/user-1/doc.jpg')).resolves.toEqual({
        sizeBytes: 2048,
        contentType: 'image/jpeg',
      });
    });

    it('returns null when the object does not exist', async () => {
      vi.spyOn(S3Client.prototype, 'send').mockRejectedValue(
        Object.assign(new Error('NotFound'), {
          name: 'NotFound',
          $metadata: { httpStatusCode: 404 },
        }) as never,
      );

      await expect(createStorage().getObjectInfo('kyc/user-1/missing.jpg')).resolves.toBeNull();
    });

    it('rethrows other storage errors', async () => {
      vi.spyOn(S3Client.prototype, 'send').mockRejectedValue(
        Object.assign(new Error('Access Denied'), {
          name: 'AccessDenied',
          $metadata: { httpStatusCode: 403 },
        }) as never,
      );

      await expect(createStorage().getObjectInfo('kyc/user-1/doc.jpg')).rejects.toThrow(
        'Access Denied',
      );
    });
  });

  describe('getObjectBytes', () => {
    it('returns bytes from the stored object', async () => {
      const { Readable } = await import('node:stream');
      vi.spyOn(S3Client.prototype, 'send').mockResolvedValue({
        ContentLength: 5,
        Body: Readable.from([Buffer.from('hello')]),
      } as never);

      const result = await createStorage().getObjectBytes('kyc/user-1/doc.jpg');

      expect(result).toEqual(new Uint8Array(Buffer.from('hello')));
    });

    it('returns null when the object does not exist', async () => {
      vi.spyOn(S3Client.prototype, 'send').mockRejectedValue(
        Object.assign(new Error('NotFound'), {
          name: 'NotFound',
          $metadata: { httpStatusCode: 404 },
        }) as never,
      );

      await expect(
        createStorage().getObjectBytes('kyc/user-1/missing.jpg'),
      ).resolves.toBeNull();
    });

    it('rejects an object whose reported size exceeds the limit', async () => {
      const { Readable } = await import('node:stream');
      const body = Readable.from([Buffer.from('too large')]);
      vi.spyOn(S3Client.prototype, 'send').mockResolvedValue({
        ContentLength: 11,
        Body: body,
      } as never);

      await expect(
        createStorage().getObjectBytes('kyc/user-1/doc.jpg', 10),
      ).rejects.toThrow(/maximum read size/i);
    });

    it('rejects a streamed object that exceeds the limit when size is unknown', async () => {
      const { Readable } = await import('node:stream');
      vi.spyOn(S3Client.prototype, 'send').mockResolvedValue({
        Body: Readable.from([Buffer.from('123456'), Buffer.from('78901')]),
      } as never);

      await expect(
        createStorage().getObjectBytes('kyc/user-1/doc.jpg', 10),
      ).rejects.toThrow(/maximum read size/i);
    });

    it('rejects invalid read limits', async () => {
      const send = vi.spyOn(S3Client.prototype, 'send');

      await expect(
        createStorage().getObjectBytes('kyc/user-1/doc.jpg', 0),
      ).rejects.toThrow(/maximum object read size/i);

      await expect(
        createStorage().getObjectBytes('kyc/user-1/doc.jpg', 10 * 1024 * 1024 + 1),
      ).rejects.toThrow(/maximum object read size/i);

      expect(send).not.toHaveBeenCalled();
    });

    it('rethrows non-404 storage errors', async () => {
      vi.spyOn(S3Client.prototype, 'send').mockRejectedValue(
        Object.assign(new Error('Access Denied'), {
          name: 'AccessDenied',
          $metadata: { httpStatusCode: 403 },
        }) as never,
      );

      await expect(
        createStorage().getObjectBytes('kyc/user-1/doc.jpg'),
      ).rejects.toThrow('Access Denied');
    });
  });
});
