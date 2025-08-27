import { Queue } from 'bullmq';
import { env } from '../utils/env';
import { logger } from '../utils/logger';

// Queue instance
let synopsisQueue: Queue | null = null;

/**
 * Initialize BullMQ queue
 */
export function initQueue(): Queue {
  if (synopsisQueue) {
    return synopsisQueue;
  }

  synopsisQueue = new Queue('synopsis:update', {
    connection: {
      host: new URL(env.REDIS_URL).hostname,
      port: parseInt(new URL(env.REDIS_URL).port) || 6379,
    },
    defaultJobOptions: {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 2000,
      },
      removeOnComplete: 100,
      removeOnFail: 50,
    },
  });

  logger.info('BullMQ queue initialized');
  return synopsisQueue;
}

/**
 * Get queue instance
 */
export function getQueue(): Queue {
  if (!synopsisQueue) {
    return initQueue();
  }
  return synopsisQueue;
}

/**
 * Enqueue synopsis update job
 */
export async function enqueueSynopsisUpdate(
  sessionId: string,
  deltaTurns: Array<{ role: 'user' | 'assistant'; content: string }>
): Promise<void> {
  try {
    const queue = getQueue();
    
    await queue.add('update', {
      sessionId,
      deltaTurns,
      timestamp: Date.now(),
    }, {
      priority: 5, // Medium priority
      delay: 5000, // 5 second delay to batch updates
    });

    logger.debug('Synopsis update job enqueued', { sessionId, turns: deltaTurns.length });
  } catch (error) {
    logger.error('Failed to enqueue synopsis update:', error);
  }
}

/**
 * Close queue connection
 */
export async function closeQueue(): Promise<void> {
  if (synopsisQueue) {
    await synopsisQueue.close();
    synopsisQueue = null;
  }
}
