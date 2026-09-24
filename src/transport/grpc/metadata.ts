import type { Metadata } from '@grpc/grpc-js';

export function getMetadataValue(metadata: Metadata, key: string): string | undefined {
  const values = metadata.get(key);

  if (values.length === 0) {
    return undefined;
  }

  const value = values[0];

  if (typeof value === 'string') {
    return value;
  }

  if (Buffer.isBuffer(value)) {
    return value.toString('utf8');
  }

  return undefined;
}
