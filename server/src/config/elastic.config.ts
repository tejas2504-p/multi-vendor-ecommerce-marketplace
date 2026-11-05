import { Client } from '@elastic/elasticsearch';
import { env } from './env.config';
import { logger } from '../utils/logger';

/**
 * Singleton Elasticsearch client instance.
 * Credentials and endpoints are read strictly from environment variables.
 */
let elasticClientInstance: Client | null = null;

export const getElasticsearchClient = (): Client => {
  if (!elasticClientInstance) {
    elasticClientInstance = new Client({
      node: env.ELASTICSEARCH_NODE,
      maxRetries: 3,
      requestTimeout: 10000,
    });
    logger.info(`✅ Elasticsearch client initialised [node: ${env.ELASTICSEARCH_NODE}]`);
  }
  return elasticClientInstance;
};

/**
 * Setter to inject mock or customized client (useful for unit & integration testing).
 */
export const setElasticsearchClient = (client: Client | null): void => {
  elasticClientInstance = client;
};

export const elasticClient = new Proxy({} as Client, {
  get: (_target, prop: string | symbol) => {
    const client = getElasticsearchClient();
    const value = (client as any)[prop];
    if (typeof value === 'function') {
      return value.bind(client);
    }
    return value;
  },
});

export const ELASTICSEARCH_INDEX = env.ELASTICSEARCH_INDEX || 'marketplace_products';

export interface ElasticsearchHealthResult {
  connected: boolean;
  status: 'green' | 'yellow' | 'red' | 'disconnected';
  clusterName?: string;
  nodeCount?: number;
  indexExists: boolean;
  documentCount: number;
  latencyMs: number;
}

/**
 * Comprehensive Elasticsearch cluster & index health check.
 */
export const checkElasticsearchHealth = async (): Promise<ElasticsearchHealthResult> => {
  const startTime = Date.now();
  try {
    const client = getElasticsearchClient();
    const health = await client.cluster.health({});
    const latencyMs = Date.now() - startTime;

    let indexExists = false;
    let documentCount = 0;

    try {
      indexExists = await client.indices.exists({ index: ELASTICSEARCH_INDEX });
      if (indexExists) {
        const countRes = await client.count({ index: ELASTICSEARCH_INDEX });
        documentCount = countRes.count;
      }
    } catch {
      // Index check failure should not mask cluster connectivity
    }

    return {
      connected: true,
      status: (health.status as 'green' | 'yellow' | 'red') || 'green',
      clusterName: health.cluster_name,
      nodeCount: health.number_of_nodes,
      indexExists,
      documentCount,
      latencyMs,
    };
  } catch (error: any) {
    logger.warn(`⚠️ Unable to connect to Elasticsearch [${env.ELASTICSEARCH_NODE}]: ${error.message}`);
    return {
      connected: false,
      status: 'disconnected',
      indexExists: false,
      documentCount: 0,
      latencyMs: Date.now() - startTime,
    };
  }
};
