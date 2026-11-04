import { createApp } from './app';
import { env } from './config/env.config';
import { connectDatabase, disconnectDatabase } from './config/db.config';
import { logger } from './utils/logger';

const startServer = async () => {
  const app = createApp();

  // Connect to MongoDB before accepting traffic
  await connectDatabase();

  const server = app.listen(env.PORT, () => {
    logger.info(`🚀 Marketplace Server running in [${env.NODE_ENV}] mode on port ${env.PORT}`);
    logger.info(`🔗 Health check available at: http://localhost:${env.PORT}/api/health`);
    logger.info(`🔗 Auth API available at: http://localhost:${env.PORT}/api/auth`);
    logger.info(`🔗 API v1 mounted at: http://localhost:${env.PORT}/api/v1`);
  });

  // Graceful shutdown lifecycle management
  const handleShutdown = async (signal: string) => {
    logger.info(`Received ${signal}. Gracefully terminating server...`);

    server.close(async () => {
      logger.info('HTTP server closed.');
      await disconnectDatabase();
      logger.info('Database connections cleanly terminated. Exiting process.');
      process.exit(0);
    });

    setTimeout(() => {
      logger.error('Forced shutdown due to timeout.');
      process.exit(1);
    }, 10000);
  };

  process.on('SIGTERM', () => handleShutdown('SIGTERM'));
  process.on('SIGINT', () => handleShutdown('SIGINT'));
};

startServer().catch((error) => {
  logger.error('Fatal initialization error:', error);
  process.exit(1);
});
