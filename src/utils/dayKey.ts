/**
 * Utility functions for generating Redis day keys
 * Keys expire at UTC midnight and are used for daily quotas
 */

/**
 * Generate a day key in YYYYMMDD format for the current date
 */
export function getDayKey(date: Date = new Date()): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}${month}${day}`;
}

/**
 * Generate a day key for a specific date
 */
export function getDayKeyForDate(date: Date): string {
  return getDayKey(date);
}

/**
 * Get the number of seconds until UTC midnight
 * Used for setting TTL on Redis keys
 */
export function getSecondsUntilMidnight(date: Date = new Date()): number {
  const now = date.getTime();
  const midnight = new Date(date);
  midnight.setUTCHours(24, 0, 0, 0);
  return Math.floor((midnight.getTime() - now) / 1000);
}

/**
 * Generate Redis key for anonymous user daily quota
 */
export function getAnonQuotaKey(anonId: string, date?: Date): string {
  const dayKey = getDayKey(date);
  return `enh:anon:${anonId}:${dayKey}`;
}

/**
 * Generate Redis key for authenticated user daily quota
 */
export function getUserQuotaKey(userId: string, date?: Date): string {
  const dayKey = getDayKey(date);
  return `enh:user:${userId}:${dayKey}`;
}

/**
 * Generate Redis key for IP-based quota
 */
export function getIpQuotaKey(ip: string, date?: Date): string {
  const dayKey = getDayKey(date);
  return `enh:ip:${ip}:${dayKey}`;
}

/**
 * Generate Redis key for OAuth state storage
 */
export function getOAuthStateKey(state: string): string {
  return `oauth:state:${state}`;
}

/**
 * Generate Redis key for anon-to-user quota linking
 */
export function getLinkAnonKey(userId: string, anonId: string, date?: Date): string {
  const dayKey = getDayKey(date);
  return `link:anon:${userId}:${anonId}:${dayKey}`;
}
