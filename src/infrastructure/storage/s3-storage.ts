import { HeadObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import type { CreateUploadUrlInput, FileStorage, StoredObjectInfo } from './provider.js';

export interface S3FileStorageOptions {
  /** Endpoint this service uses, e.g. http://minio:9000 inside Docker. Omit for AWS S3. */
  endpoint?: string;
  /** Endpoint the browser uses for presigned URLs, e.g. http://localhost:9000. Defaults to endpoint. */
  publicEndpoint?: string;
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  forcePathStyle: boolean;
}


export class S3FileStorage implements FileStorage {
  private readonly client: S3Client;
  private readonly signingClient: S3Client;
  private readonly bucket: string;

  constructor(options: S3FileStorageOptions) {
    const createClient = (endpoint: string | undefined) =>
      new S3Client({
        region: options.region,
        forcePathStyle: options.forcePathStyle,
        credentials: {
          accessKeyId: options.accessKeyId,
          secretAccessKey: options.secretAccessKey,
        },
        ...(endpoint !== undefined ? { endpoint } : {}),
      });

    this.client = createClient(options.endpoint);
    this.signingClient = createClient(options.publicEndpoint ?? options.endpoint);
    this.bucket = options.bucket;
  }

  async createUploadUrl(input: CreateUploadUrlInput): Promise<string> {
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: input.key,
      ContentType: input.contentType,
      ContentLength: input.sizeBytes,
    });

    return getSignedUrl(this.signingClient, command, {
      expiresIn: input.expiresInSeconds,
      signableHeaders: new Set(['content-type', 'content-length']),
    });
  }

  async getObjectInfo(key: string): Promise<StoredObjectInfo | null> {
    try {
      const result = await this.client.send(
        new HeadObjectCommand({ Bucket: this.bucket, Key: key }),
      );

      return {
        sizeBytes: result.ContentLength ?? 0,
        contentType: result.ContentType ?? 'application/octet-stream',
      };
    } catch (error) {
      if (isNotFound(error)) {
        return null;
      }

      throw error;
    }
  }
}

function isNotFound(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false;

  const { name, $metadata } = error as {
    name?: string;
    $metadata?: { httpStatusCode?: number };
  };

  return name === 'NotFound' || name === 'NoSuchKey' || $metadata?.httpStatusCode === 404;
}
