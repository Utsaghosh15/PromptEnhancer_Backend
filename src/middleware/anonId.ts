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
 */
export function anonId(req: Request, res: Response, next: NextFunction): void {
  // Check if anon ID cookie exists
  let anonId = req.cookies?.[ANON_ID_COOKIE];
  
  if (!anonId) {
    // Generate new anonymous ID
    anonId = uuidv4();
    
    // Set cookie with 1 year expiration
    res.cookie(ANON_ID_COOKIE, anonId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 365 * 24 * 60 * 60 * 1000, // 1 year
    });
  }
  
  // Attach to request for use in other middleware/routes
  req.anonId = anonId;
  
  next();
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
