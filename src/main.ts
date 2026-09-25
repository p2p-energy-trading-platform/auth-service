import { buildApp } from './app.js';
import { config } from './config/env.js';

async function main(): Promise<void> {
  const app = buildApp({ config });

  try {
    await app.ready();

    await app.grpcServer.start();

    await app.listen({
      host: app.config.HTTP_HOST,
      port: app.config.HTTP_PORT,
    });

    app.log.info(
      {
        http: `${app.config.HTTP_HOST}:${app.config.HTTP_PORT}`,
        grpc: `${app.config.GRPC_HOST}:${app.config.GRPC_PORT}`,
      },
      'Auth service started',
    );
  } catch (error) {
    app.log.fatal({ err: error }, 'Failed to start auth service');

    await app.close();

    process.exitCode = 1;
  }

  const shutdown = async (signal: string): Promise<void> => {
    app.log.info({ signal }, 'Shutdown signal received');

    try {
      await app.close();
    } catch (error) {
      app.log.error({ err: error }, 'Error during shutdown');

      process.exitCode = 1;
    }
  };

  process.once('SIGINT', () => void shutdown('SIGINT'));

  process.once('SIGTERM', () => void shutdown('SIGTERM'));
}

void main();
