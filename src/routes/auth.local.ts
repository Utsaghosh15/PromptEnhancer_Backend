import { Router, Request, Response } from 'express';
import { User } from '../models/User';
import { generateToken, setTokenCookie } from '../middleware/auth';
import { zodValidate, schemas } from '../middleware/zod';
import { linkAnonQuota } from '../services/redis';
import { getAnonId } from '../middleware/anonId';
import { logger } from '../utils/logger';
import { sendSuccess, sendError, sendConflict, sendUnauthorized } from '../utils/response';
import { clearAnonId } from '../middleware/anonId';

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
        return sendConflict(res, 'User already exists');
      }

      // Create new user
      const user = await User.createWithPassword(email, password);
      
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

      sendSuccess(
        res,
        {
          user: {
            id: user._id,
            email: user.email,
            emailVerified: user.emailVerified,
          }
        },
        'Account created successfully! Please login to continue.',
        201,
        '/login'
      );
    } catch (error) {
      logger.error('Signup error:', error);
      sendError(res, 'Failed to create user', 500);
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
        return sendUnauthorized(res, 'Invalid credentials');
      }

      // Check if user has password (not OAuth-only)
      if (!user.passwordHash) {
        return sendUnauthorized(res, 'Account created with OAuth. Please use OAuth login.');
      }

      // Verify password
      const isValidPassword = await user.comparePassword(password);
      if (!isValidPassword) {
        return sendUnauthorized(res, 'Invalid credentials');
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
        
        // Clear anonymous ID after linking (optional)
        // clearAnonId(res);
      }

      sendSuccess(
        res,
        {
          user: {
            id: user._id,
            email: user.email,
            emailVerified: user.emailVerified,
          },
          token
        },
        'Login successful'
      );
    } catch (error) {
      logger.error('Login error:', error);
      sendError(res, 'Login failed', 500);
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
        return sendUnauthorized(res, 'Authentication required');
      }

      if (!anonId) {
        return sendError(res, 'No anonymous session found', 400);
      }

      const linkResult = await linkAnonQuota(userId, anonId);
      
      if (linkResult.linked) {
        logger.info(`Linked ${linkResult.count} anonymous enhancements to user ${userId}`);
        sendSuccess(
          res,
          { linkedCount: linkResult.count },
          'Anonymous usage linked successfully'
        );
      } else {
        sendSuccess(
          res,
          { linkedCount: 0 },
          'No anonymous usage to link or already linked'
        );
      }
    } catch (error) {
      logger.error('Link anon error:', error);
      sendError(res, 'Failed to link anonymous usage', 500);
    }
  }
);

export default router;
