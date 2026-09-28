import { createClient } from 'redis';

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
