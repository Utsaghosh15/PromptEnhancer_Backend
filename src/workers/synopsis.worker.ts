import { Worker } from 'bullmq';
import mongoose from 'mongoose';
import { env } from '../utils/env';
import { logger } from '../utils/logger';
import { initRedis } from '../services/redis';
import { updateSynopsis } from '../services/openai';
import { Session } from '../models/Session';

// Worker instance
let worker: Worker | null = null;

/**
 * Process synopsis update job
 */
async function processSynopsisUpdate(job: any) {
  const { sessionId, deltaTurns } = job.data;
  
  try {
    logger.info('Processing synopsis update', { sessionId, jobId: job.id });

    // Fetch session
    const session = await Session.findById(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    // Update synopsis using OpenAI
    const { synopsis: newSynopsis, tokens } = await updateSynopsis(
      session.synopsis,
      deltaTurns
    );

    // Update session with new synopsis
    await session.updateSynopsis(newSynopsis);

    logger.info('Synopsis updated successfully', {
      sessionId,
      jobId: job.id,
      tokens,
      synopsisVersion: session.synopsisVersion
    });

    return { success: true, synopsisVersion: session.synopsisVersion };
  } catch (error) {
    logger.error('Synopsis update failed', {
      sessionId,
      jobId: job.id,
      error: error instanceof Error ? error.message : error
    });
    throw error;
  }
}

/**
 * Initialize worker
 */
async function initWorker() {
  try {
    // Connect to MongoDB
    await mongoose.connect(env.MONGO_URI);
    logger.info('Worker connected to MongoDB');

    // Initialize Redis
    await initRedis();
    logger.info('Worker Redis initialized');

    // Create worker
    worker = new Worker('synopsis:update', processSynopsisUpdate, {
      connection: {
        host: new URL(env.REDIS_URL).hostname,
        port: parseInt(new URL(env.REDIS_URL).port) || 6379,
      },
      concurrency: 2,
      removeOnComplete: 100,
      removeOnFail: 50,
    });

    // Worker event handlers
    worker.on('completed', (job) => {
      logger.info('Job completed', { jobId: job.id, sessionId: job.data.sessionId });
    });

    worker.on('failed', (job, err) => {
      logger.error('Job failed', { 
        jobId: job?.id, 
        sessionId: job?.data.sessionId,
        error: err.message 
      });
    });

    worker.on('error', (err) => {
      logger.error('Worker error:', err);
    });

    logger.info('Synopsis worker started');

    // Graceful shutdown
    process.on('SIGTERM', async () => {
      logger.info('SIGTERM received, shutting down worker');
      
      if (worker) {
        await worker.close();
      }
      
      await mongoose.connection.close();
      await import('../services/redis').then(({ closeRedis }) => closeRedis());
      
      logger.info('Worker closed');
      process.exit(0);
    });

  } catch (error) {
    logger.error('Failed to start worker:', error);
    process.exit(1);
  }
}

// Start worker if this file is run directly
if (require.main === module) {
  initWorker();
}

export { initWorker };
