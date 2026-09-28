import postgres from 'postgres';

interface DbClientOptions {
  databaseUrl: string;
  max: number;
  idleTimeout: number;
  connectTimeout: number;
  onNotice: (notice: postgres.Notice) => void;
}

export function createDbClient(options: DbClientOptions) {
  return postgres(options.databaseUrl, {
    max: options.max,
    idle_timeout: options.idleTimeout,
    connect_timeout: options.connectTimeout,
    onnotice: options.onNotice,
  });
}
