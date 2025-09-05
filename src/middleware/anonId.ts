import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';

// Extend Express Request interface
declare global {
  namespace Express {
    interface Request {
      anonId?: string;
    }
  }
}

/**
 * Anonymous ID cookie name
 */
const ANON_ID_COOKIE = 'pe_anon_id';

/**
 * Anonymous ID middleware
 * Sets a long-lived cookie to track anonymous users
 * Only sets cookie when user actually uses anonymous features
 */
export function anonId(req: Request, res: Response, next: NextFunction): void {
  // Check if anon ID cookie exists
  let anonId = req.cookies?.[ANON_ID_COOKIE];
  
  if (!anonId) {
    // Generate new anonymous ID but don't set cookie yet
    anonId = uuidv4();
    
    // Store in request for potential use
    req.anonId = anonId;
  } else {
    // Cookie exists, use it
    req.anonId = anonId;
  }
  
  next();
}

/**
 * Set anonymous ID cookie when user actually uses anonymous features
 */
export function setAnonIdCookie(res: Response, anonId: string): void {
  res.cookie(ANON_ID_COOKIE, anonId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 365 * 24 * 60 * 60 * 1000, // 1 year
  });
}

/**
 * Get anonymous ID from request
 */
export function getAnonId(req: Request): string | undefined {
  return req.anonId;
}

/**
 * Clear anonymous ID cookie
 */
export function clearAnonId(res: Response): void {
  res.clearCookie(ANON_ID_COOKIE);
}
