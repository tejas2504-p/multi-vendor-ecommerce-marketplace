import mongoose from 'mongoose';
import dns from 'dns';
import { env } from './env.config';
import { logger } from '../utils/logger';

export const connectDatabase = async (): Promise<void> => {
  try {
    mongoose.set('strictQuery', true);

    // Fix for Windows / ISP DNS failing to resolve MongoDB Atlas SRV records
    if (env.MONGO_URI.includes('mongodb+srv://')) {
      try {
        dns.setServers(['8.8.8.8', '1.1.1.1']);
      } catch (dnsErr) {
        logger.debug('Custom DNS fallback not available:', dnsErr);
      }
    }

    await mongoose.connect(env.MONGO_URI, {
      serverSelectionTimeoutMS: 10000,
      autoIndex: env.NODE_ENV === 'development',
      dbName: 'marketplace',
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
