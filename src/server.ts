import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import mongoose from 'mongoose';
import cookieParser from 'cookie-parser';

import { env } from './utils/env';
import { logger } from './utils/logger';
import { initRedis } from './services/redis';
import { initOpenAI } from './services/openai';
import { initQueue } from './services/queue';

// Import routes
import authLocalRoutes from './routes/auth.local';
import authGoogleRoutes from './routes/auth.google';
import enhanceRoutes from './routes/enhance';
import sessionRoutes from './routes/session';

// Import middleware
import { requireAuth } from './middleware/auth';
import { anonId } from './middleware/anonId';

const app = express();

// Trust proxy for real client IP
app.set('trust proxy', true);

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
}));

// CORS configuration
app.use(cors({
  origin: [env.CORS_ORIGIN, 'http://localhost:3000'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// Body parsing middleware
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));
app.use(cookieParser());

// Anonymous ID middleware (for all routes)
app.use(anonId);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// API routes
app.use('/api/auth', authLocalRoutes);
app.use('/api/auth/google', authGoogleRoutes);
app.use('/api', enhanceRoutes);
app.use('/api/session', sessionRoutes);

// Feedback routes (protected)
app.use('/api/feedback', requireAuth, (req, res) => {
  // TODO: Implement feedback routes
  res.json({ message: 'Feedback routes coming soon' });
});

// Error handling middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  logger.error('Unhandled error:', err);
  
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Invalid JSON' });
  }
  
  res.status(500).json({ error: 'Internal server error' });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Not found' });
});

/**
 * Initialize all services and start server
 */
async function startServer() {
  try {
    // Connect to MongoDB
    await mongoose.connect(env.MONGO_URI);
    logger.info('Connected to MongoDB');

    // Initialize Redis
    await initRedis();
    logger.info('Redis initialized');

    // Initialize OpenAI
    initOpenAI();
    logger.info('OpenAI initialized');

    // Initialize BullMQ queue
    initQueue();
    logger.info('BullMQ queue initialized');

    // Start server
    const server = app.listen(env.PORT, () => {
      logger.info(`Server running on port ${env.PORT}`);
      logger.info(`Environment: ${env.NODE_ENV}`);
    });

    // Graceful shutdown
    process.on('SIGTERM', async () => {
      logger.info('SIGTERM received, shutting down gracefully');
      
      server.close(async () => {
        await mongoose.connection.close();
        await import('./services/redis').then(({ closeRedis }) => closeRedis());
        await import('./services/queue').then(({ closeQueue }) => closeQueue());
        
        logger.info('Server closed');
        process.exit(0);
      });
    });

  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Start server if this file is run directly
if (require.main === module) {
  startServer();
}

export default app;
