import { Router, Request, Response } from 'express';
import { User } from '../models/User';
import { generateToken, setTokenCookie } from '../middleware/auth';
import { zodValidate, schemas } from '../middleware/zod';
import { linkAnonQuota } from '../services/redis';
import { getAnonId } from '../middleware/anonId';
import { logger } from '../utils/logger';

const router = Router();

/**
 * POST /auth/signup
 * Create a new user account
 */
router.post('/signup', 
  zodValidate(schemas.signup),
  async (req: Request, res: Response) => {
    try {
      const { email, password } = req.body;

      // Check if user already exists
      const existingUser = await User.findOne({ email });
      if (existingUser) {
        return res.status(409).json({ error: 'User already exists' });
      }

      // Create new user
      const user = await User.createWithPassword(email, password);
      
      // Generate JWT token
      const token = generateToken(user._id.toString(), user.email);
      
      // Set token cookie
      setTokenCookie(res, token);

      // Link anonymous quota if anon cookie exists
      const anonId = getAnonId(req);
      if (anonId) {
        try {
          const linkResult = await linkAnonQuota(user._id.toString(), anonId);
          if (linkResult.linked) {
            logger.info(`Linked ${linkResult.count} anonymous enhancements to user ${user._id}`);
          }
        } catch (error) {
          logger.error('Failed to link anonymous quota:', error);
        }
      }

      res.status(201).json({
        message: 'User created successfully',
        user: {
          id: user._id,
          email: user.email,
          emailVerified: user.emailVerified,
        },
        token
      });
    } catch (error) {
      logger.error('Signup error:', error);
      res.status(500).json({ error: 'Failed to create user' });
    }
  }
);

/**
 * POST /auth/login
 * Authenticate user and return JWT token
 */
router.post('/login',
  zodValidate(schemas.login),
  async (req: Request, res: Response) => {
    try {
      const { email, password } = req.body;

      // Find user by email
      const user = await User.findOne({ email });
      if (!user) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      // Check if user has password (not OAuth-only)
      if (!user.passwordHash) {
        return res.status(401).json({ error: 'Account created with OAuth. Please use OAuth login.' });
      }

      // Verify password
      const isValidPassword = await user.comparePassword(password);
      if (!isValidPassword) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      // Generate JWT token
      const token = generateToken(user._id.toString(), user.email);
      
      // Set token cookie
      setTokenCookie(res, token);

      // Link anonymous quota if anon cookie exists
      const anonId = getAnonId(req);
      if (anonId) {
        try {
          const linkResult = await linkAnonQuota(user._id.toString(), anonId);
          if (linkResult.linked) {
            logger.info(`Linked ${linkResult.count} anonymous enhancements to user ${user._id}`);
          }
        } catch (error) {
          logger.error('Failed to link anonymous quota:', error);
        }
      }

      res.json({
        message: 'Login successful',
        user: {
          id: user._id,
          email: user.email,
          emailVerified: user.emailVerified,
        },
        token
      });
    } catch (error) {
      logger.error('Login error:', error);
      res.status(500).json({ error: 'Login failed' });
    }
  }
);

/**
 * POST /auth/link-anon
 * Link anonymous quota to authenticated user (idempotent)
 */
router.post('/link-anon',
  async (req: Request, res: Response) => {
    try {
      const userId = req.userId;
      const anonId = getAnonId(req);

      if (!userId) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      if (!anonId) {
        return res.status(400).json({ error: 'No anonymous session found' });
      }

      const linkResult = await linkAnonQuota(userId, anonId);
      
      if (linkResult.linked) {
        logger.info(`Linked ${linkResult.count} anonymous enhancements to user ${userId}`);
        res.json({
          message: 'Anonymous usage linked successfully',
          linkedCount: linkResult.count
        });
      } else {
        res.json({
          message: 'No anonymous usage to link or already linked',
          linkedCount: 0
        });
      }
    } catch (error) {
      logger.error('Link anon error:', error);
      res.status(500).json({ error: 'Failed to link anonymous usage' });
    }
  }
);

export default router;
