import { createClient, type RedisClientType } from 'redis';

export type RedisClient = RedisClientType;

interface RedisClientOptions {
  url: string;
  onError?: (err: Error) => void;
}

export function createRedisClient(options: RedisClientOptions) {
  const client = createClient({
    url: options.url,
  });

  if (options.onError) {
    client.on('error', options.onError);
  }

  return client;
}
