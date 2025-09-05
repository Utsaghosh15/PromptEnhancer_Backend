import { Request, Response, NextFunction } from 'express';
import { checkAnonQuota, checkUserQuota, checkIpQuota } from '../services/redis';
import { getAnonId } from './anonId';
import { logger } from '../utils/logger';
import { sendError, sendRateLimit } from '../utils/response';

/**
 * Rate limiting middleware for enhance endpoint
 * Enforces daily quotas for anonymous and authenticated users
 */
export async function limitEnhance(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.userId;
    const anonId = getAnonId(req);
    const clientIp = req.ip || req.connection.remoteAddress || 'unknown';
    
    if (!anonId) {
      sendError(res, 'Anonymous ID not set', 500);
      return;
    }

    // Check IP-based quota first (soft cap)
    const ipQuota = await checkIpQuota(clientIp, !!userId);
    if (!ipQuota.allowed) {
      logger.warn(`IP quota exceeded for ${clientIp}`);
      sendRateLimit(res, 'Too many requests from this IP address', 'tomorrow');
      return;
    }

    // Check user-specific quota
    if (userId) {
      // Authenticated user
      const userQuota = await checkUserQuota(userId);
      if (!userQuota.allowed) {
        logger.warn(`User quota exceeded for ${userId}`);
        sendRateLimit(res, 'You have reached your daily limit of 20 enhancements', 'tomorrow');
        return;
      }
      
      // Add quota info to response headers
      res.set('X-RateLimit-Remaining', userQuota.remaining.toString());
      res.set('X-RateLimit-Limit', '20');
    } else {
      // Anonymous user
      const anonQuota = await checkAnonQuota(anonId);
      if (!anonQuota.allowed) {
        logger.warn(`Anonymous quota exceeded for ${anonId}`);
        sendRateLimit(res, 'You have reached your daily limit of 10 enhancements. Sign up for more!', 'tomorrow');
        return;
      }
      
      // Add quota info to response headers
      res.set('X-RateLimit-Remaining', anonQuota.remaining.toString());
      res.set('X-RateLimit-Limit', '10');
    }

    next();
  } catch (error) {
    logger.error('Rate limiting error:', error);
    sendError(res, 'Rate limiting failed', 500);
  }
}

/**
 * Get current quota usage for the request
 */
export async function getQuotaInfo(req: Request): Promise<{
  used: number;
  limit: number;
  remaining: number;
  isAuthenticated: boolean;
}> {
  const userId = req.userId;
  const anonId = getAnonId(req);
  
  if (userId) {
    // Authenticated user
    const { getUserQuotaUsage } = await import('../services/redis');
    const quota = await getUserQuotaUsage(userId);
    return {
      ...quota,
      isAuthenticated: true
    };
  } else if (anonId) {
    // Anonymous user
    const { getAnonQuotaUsage } = await import('../services/redis');
    const quota = await getAnonQuotaUsage(anonId);
    return {
      ...quota,
      isAuthenticated: false
    };
  }
  
  return {
    used: 0,
    limit: 10,
    remaining: 10,
    isAuthenticated: false
  };
}
