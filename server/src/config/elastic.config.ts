import { Client } from '@elastic/elasticsearch';
import { env } from './env.config';
import { logger } from '../utils/logger';

export const elasticClient = new Client({
  node: env.ELASTICSEARCH_NODE,
  maxRetries: 3,
  requestTimeout: 10000,
});

export const checkElasticsearchHealth = async (): Promise<boolean> => {
  try {
    const health = await elasticClient.cluster.health({});
    logger.info(`✅ Elasticsearch cluster status: ${health.status}`);
    return true;
  } catch (error) {
    logger.warn('⚠️ Unable to connect to Elasticsearch. Ensure Elasticsearch container is running.');
    return false;
  }
};

