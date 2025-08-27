import Redis from 'ioredis';
import { env } from '../utils/env';
import { logger } from '../utils/logger';
import {
  getAnonQuotaKey,
  getUserQuotaKey,
  getIpQuotaKey,
  getOAuthStateKey,
  getLinkAnonKey,
  getSecondsUntilMidnight,
} from '../utils/dayKey';

// Redis client instance
let redis: Redis | null = null;

/**
 * Initialize Redis connection
 */
export async function initRedis(): Promise<Redis> {
  if (redis) {
    return redis;
  }

  try {
    redis = new Redis(env.REDIS_URL, {
      retryDelayOnFailover: 100,
      enableReadyCheck: false,
      maxRetriesPerRequest: 3,
      lazyConnect: true,
    });

    redis.on('connect', () => {
      logger.info('Redis connected');
    });

    redis.on('error', (error) => {
      logger.error('Redis error:', error);
    });

    redis.on('close', () => {
      logger.warn('Redis connection closed');
    });

    await redis.connect();
    return redis;
  } catch (error) {
    logger.error('Failed to connect to Redis:', error);
    throw error;
  }
}

/**
 * Get Redis client instance
 */
export function getRedis(): Redis {
  if (!redis) {
    throw new Error('Redis not initialized. Call initRedis() first.');
  }
  return redis;
}

/**
 * Close Redis connection
 */
export async function closeRedis(): Promise<void> {
  if (redis) {
    await redis.quit();
    redis = null;
  }
}

/**
 * Check and increment daily quota for anonymous user
 */
export async function checkAnonQuota(anonId: string): Promise<{ allowed: boolean; remaining: number }> {
  const redis = getRedis();
  const key = getAnonQuotaKey(anonId);
  const ttl = getSecondsUntilMidnight();
  
  const current = await redis.get(key);
  const count = current ? parseInt(current, 10) : 0;
  
  if (count >= 10) { // Anonymous limit: 10/day
    return { allowed: false, remaining: 0 };
  }
  
  // Increment counter
  await redis.multi()
    .incr(key)
    .expire(key, ttl)
    .exec();
  
  return { allowed: true, remaining: 10 - count - 1 };
}

/**
 * Check and increment daily quota for authenticated user
 */
export async function checkUserQuota(userId: string): Promise<{ allowed: boolean; remaining: number }> {
  const redis = getRedis();
  const key = getUserQuotaKey(userId);
  const ttl = getSecondsUntilMidnight();
  
  const current = await redis.get(key);
  const count = current ? parseInt(current, 10) : 0;
  
  if (count >= 20) { // User limit: 20/day
    return { allowed: false, remaining: 0 };
  }
  
  // Increment counter
  await redis.multi()
    .incr(key)
    .expire(key, ttl)
    .exec();
  
  return { allowed: true, remaining: 20 - count - 1 };
}

/**
 * Check and increment IP-based quota
 */
export async function checkIpQuota(ip: string, isAuthenticated: boolean): Promise<{ allowed: boolean; remaining: number }> {
  const redis = getRedis();
  const key = getIpQuotaKey(ip);
  const ttl = getSecondsUntilMidnight();
  const limit = isAuthenticated ? 60 : 30; // User: 60/day, Anon: 30/day
  
  const current = await redis.get(key);
  const count = current ? parseInt(current, 10) : 0;
  
  if (count >= limit) {
    return { allowed: false, remaining: 0 };
  }
  
  // Increment counter
  await redis.multi()
    .incr(key)
    .expire(key, ttl)
    .exec();
  
  return { allowed: true, remaining: limit - count - 1 };
}

/**
 * Store OAuth state with TTL
 */
export async function storeOAuthState(state: string, data: any, ttlSeconds: number = 600): Promise<void> {
  const redis = getRedis();
  const key = getOAuthStateKey(state);
  
  await redis.setex(key, ttlSeconds, JSON.stringify(data));
}

/**
 * Get and delete OAuth state
 */
export async function getOAuthState(state: string): Promise<any | null> {
  const redis = getRedis();
  const key = getOAuthStateKey(state);
  
  const data = await redis.get(key);
  if (!data) {
    return null;
  }
  
  // Delete the state after retrieval (one-time use)
  await redis.del(key);
  
  return JSON.parse(data);
}

/**
 * Link anonymous quota to user quota (idempotent)
 */
export async function linkAnonQuota(userId: string, anonId: string): Promise<{ linked: boolean; count: number }> {
  const redis = getRedis();
  const linkKey = getLinkAnonKey(userId, anonId);
  const anonKey = getAnonQuotaKey(anonId);
  const userKey = getUserQuotaKey(userId);
  const ttl = getSecondsUntilMidnight();
  
  // Check if already linked today
  const alreadyLinked = await redis.exists(linkKey);
  if (alreadyLinked) {
    return { linked: false, count: 0 };
  }
  
  // Get anonymous usage count
  const anonCount = await redis.get(anonKey);
  const count = anonCount ? parseInt(anonCount, 10) : 0;
  
  if (count === 0) {
    return { linked: false, count: 0 };
  }
  
  // Add to user quota and mark as linked
  await redis.multi()
    .incrby(userKey, count)
    .expire(userKey, ttl)
    .setex(linkKey, ttl, '1') // Mark as linked
    .exec();
  
  return { linked: true, count };
}

/**
 * Get current quota usage for user
 */
export async function getUserQuotaUsage(userId: string): Promise<{ used: number; limit: number; remaining: number }> {
  const redis = getRedis();
  const key = getUserQuotaKey(userId);
  
  const current = await redis.get(key);
  const used = current ? parseInt(current, 10) : 0;
  const limit = 20;
  
  return {
    used,
    limit,
    remaining: Math.max(0, limit - used)
  };
}

/**
 * Get current quota usage for anonymous user
 */
export async function getAnonQuotaUsage(anonId: string): Promise<{ used: number; limit: number; remaining: number }> {
  const redis = getRedis();
  const key = getAnonQuotaKey(anonId);
  
  const current = await redis.get(key);
  const used = current ? parseInt(current, 10) : 0;
  const limit = 10;
  
  return {
    used,
    limit,
    remaining: Math.max(0, limit - used)
  };
}
