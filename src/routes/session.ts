import { Router, Request, Response } from 'express';
import { requireAuth, requireAuthOptional } from '../middleware/auth';
import { zodValidate, schemas } from '../middleware/zod';
import { Session } from '../models/Session';
import { Prompt } from '../models/Prompt';
import { logger } from '../utils/logger';

const router = Router();

/**
 * POST /session
 * Create a new session
 */
router.post('/',
  requireAuthOptional,
  zodValidate(schemas.createSession),
  async (req: Request, res: Response) => {
    try {
      const { title } = req.body;
      const userId = req.userId; // Can be undefined for anonymous sessions
      const anonId = req.anonId; // For anonymous sessions

      const session = await Session.createSession(userId, title, anonId);

      logger.info('Session created', {
        sessionId: session._id,
        userId: userId || 'anonymous',
        title
      });

      res.status(201).json({
        sessionId: session._id,
        title: session.title,
        synopsis: session.synopsis,
        createdAt: session.createdAt
      });
    } catch (error) {
      logger.error('Session creation error:', error);
      res.status(500).json({ error: 'Failed to create session' });
    }
  }
);

/**
 * GET /session
 * List user's sessions
 */
router.get('/',
  requireAuthOptional,
  async (req: Request, res: Response) => {
    try {
      const userId = req.userId;
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const skip = (page - 1) * limit;

      let query = {};
      if (userId) {
        // Authenticated user: get their sessions
        query = { userId };
      } else {
        // Anonymous user: get sessions by anonymous ID
        const anonId = req.anonId;
        if (anonId) {
          query = { anonId };
        } else {
          return res.json({ sessions: [], total: 0, page, limit });
        }
      }

      const [sessions, total] = await Promise.all([
        Session.find(query)
          .sort({ lastMessageAt: -1 })
          .skip(skip)
          .limit(limit)
          .select('title synopsis lastMessageAt createdAt'),
        Session.countDocuments(query)
      ]);

      res.json({
        sessions: sessions.map(session => ({
          sessionId: session._id,
          title: session.title,
          synopsis: session.synopsis,
          lastMessageAt: session.lastMessageAt,
          createdAt: session.createdAt
        })),
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      });
    } catch (error) {
      logger.error('Session listing error:', error);
      res.status(500).json({ error: 'Failed to list sessions' });
    }
  }
);

/**
 * GET /session/:id
 * Get session details and recent prompts
 */
router.get('/:id',
  requireAuthOptional,
  zodValidate(schemas.sessionId, 'params'),
  async (req: Request, res: Response) => {
    try {
      const { id: sessionId } = req.params;
      const userId = req.userId;

      // Build query based on authentication
      let query: any = { _id: sessionId };
      if (userId) {
        query.userId = userId;
      } else {
        const anonId = req.anonId;
        if (anonId) {
          query.anonId = anonId;
        } else {
          return res.status(404).json({ error: 'Session not found' });
        }
      }

      const session = await Session.findOne(query);
      if (!session) {
        return res.status(404).json({ error: 'Session not found' });
      }

      // Get recent prompts for this session
      const recentPrompts = await Prompt.find({ sessionId })
        .sort({ createdAt: -1 })
        .limit(20)
        .select('original enhanced createdAt');

      res.json({
        sessionId: session._id,
        title: session.title,
        synopsis: session.synopsis,
        synopsisVersion: session.synopsisVersion,
        lastMessageAt: session.lastMessageAt,
        createdAt: session.createdAt,
        recentPrompts: recentPrompts.map(prompt => ({
          promptId: prompt._id,
          original: prompt.original,
          enhanced: prompt.enhanced,
          createdAt: prompt.createdAt
        }))
      });
    } catch (error) {
      logger.error('Session details error:', error);
      res.status(500).json({ error: 'Failed to get session details' });
    }
  }
);

/**
 * PUT /session/:id
 * Update session title
 */
router.put('/:id',
  requireAuthOptional,
  zodValidate(schemas.sessionId, 'params'),
  zodValidate(schemas.updateSession),
  async (req: Request, res: Response) => {
    try {
      const { id: sessionId } = req.params;
      const { title } = req.body;
      const userId = req.userId;

      // Build query based on authentication
      let query: any = { _id: sessionId };
      if (userId) {
        query.userId = userId;
      } else {
        const anonId = req.anonId;
        if (anonId) {
          query.anonId = anonId;
        } else {
          return res.status(404).json({ error: 'Session not found' });
        }
      }

      const session = await Session.findOneAndUpdate(
        query,
        { title, lastMessageAt: new Date() },
        { new: true }
      );

      if (!session) {
        return res.status(404).json({ error: 'Session not found' });
      }

      logger.info('Session updated', { sessionId, title });

      res.json({
        sessionId: session._id,
        title: session.title,
        synopsis: session.synopsis,
        lastMessageAt: session.lastMessageAt
      });
    } catch (error) {
      logger.error('Session update error:', error);
      res.status(500).json({ error: 'Failed to update session' });
    }
  }
);

/**
 * DELETE /session/:id
 * Delete session and all associated prompts
 */
router.delete('/:id',
  requireAuthOptional,
  zodValidate(schemas.sessionId, 'params'),
  async (req: Request, res: Response) => {
    try {
      const { id: sessionId } = req.params;
      const userId = req.userId;

      // Build query based on authentication
      let query: any = { _id: sessionId };
      if (userId) {
        query.userId = userId;
      } else {
        const anonId = req.anonId;
        if (anonId) {
          query.anonId = anonId;
        } else {
          return res.status(404).json({ error: 'Session not found' });
        }
      }

      // Delete session and all associated prompts
      const [session, deletedPrompts] = await Promise.all([
        Session.findOneAndDelete(query),
        Prompt.deleteMany({ sessionId })
      ]);

      if (!session) {
        return res.status(404).json({ error: 'Session not found' });
      }

      logger.info('Session deleted', {
        sessionId,
        deletedPrompts: deletedPrompts.deletedCount
      });

      res.json({
        message: 'Session deleted successfully',
        deletedPrompts: deletedPrompts.deletedCount
      });
    } catch (error) {
      logger.error('Session deletion error:', error);
      res.status(500).json({ error: 'Failed to delete session' });
    }
  }
);

/**
 * POST /session/:id/merge
 * Merge anonymous session with authenticated user
 */
router.post('/:id/merge',
  requireAuth,
  zodValidate(schemas.sessionId, 'params'),
  async (req: Request, res: Response) => {
    try {
      const { id: sessionId } = req.params;
      const userId = req.userId!;
      const anonId = req.anonId;

      if (!anonId) {
        return res.status(400).json({ error: 'No anonymous session to merge' });
      }

      // Find anonymous session
      const session = await Session.findOne({ _id: sessionId, anonId });
      if (!session) {
        return res.status(404).json({ error: 'Session not found' });
      }

      // Update session to belong to authenticated user
      session.userId = userId;
      session.anonId = undefined;
      await session.save();

      // Update all prompts in this session
      await Prompt.updateMany(
        { sessionId },
        { userId, anonId: undefined }
      );

      logger.info('Session merged with user', { sessionId, userId });

      res.json({
        message: 'Session merged successfully',
        sessionId: session._id
      });
    } catch (error) {
      logger.error('Session merge error:', error);
      res.status(500).json({ error: 'Failed to merge session' });
    }
  }
);

export default router;
