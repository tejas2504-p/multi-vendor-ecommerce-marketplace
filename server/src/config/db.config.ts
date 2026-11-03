import mongoose from 'mongoose';
import { env } from './env.config';
import { logger } from '../utils/logger';

export const connectDatabase = async (): Promise<void> => {
  try {
    mongoose.set('strictQuery', true);

    await mongoose.connect(env.MONGO_URI, {
      serverSelectionTimeoutMS: 2000,
      autoIndex: env.NODE_ENV === 'development',
    });

    logger.info('✅ Connected to MongoDB successfully.');

    mongoose.connection.on('error', (err) => {
      logger.error('MongoDB connection error:', err);
    });

    mongoose.connection.on('disconnected', () => {
      logger.warn('MongoDB connection lost. Reconnecting...');
    });
  } catch (error) {
    logger.error('❌ Failed to connect to MongoDB:', error);
    // In dev, let the server continue so the user can spin up docker containers
    if (env.NODE_ENV === 'production') {
      process.exit(1);
    }
  }
};

export const disconnectDatabase = async (): Promise<void> => {
  try {
    await mongoose.connection.close();
    logger.info('MongoDB connection closed.');
  } catch (error) {
    logger.error('Error closing MongoDB connection:', error);
  }
};

