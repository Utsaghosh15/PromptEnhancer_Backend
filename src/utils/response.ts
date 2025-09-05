import { Response } from 'express';

/**
 * Standard API Response Interface
 */
export interface ApiResponse<T = any> {
  success: boolean;
  message: string;
  data?: T;
  redirectTo?: string;
}

/**
 * Success Response Helper
 */
export function sendSuccess<T>(
  res: Response, 
  data?: T, 
  message: string = 'Success', 
  statusCode: number = 200,
  redirectTo?: string
): void {
  const response: ApiResponse<T> = {
    success: true,
    message,
    data
  };

  if (redirectTo) {
    response.redirectTo = redirectTo;
  }

  res.status(statusCode).json(response);
}

/**
 * Error Response Helper
 */
export function sendError(
  res: Response, 
  error: string, 
  statusCode: number = 400
): void {
  const response: ApiResponse = {
    success: false,
    message: error
  };

  res.status(statusCode).json(response);
}

/**
 * Validation Error Response Helper
 */
export function sendValidationError(
  res: Response, 
  errors: any[]
): void {
  const response: ApiResponse = {
    success: false,
    message: 'Validation failed',
    data: { errors }
  };

  res.status(400).json(response);
}

/**
 * Not Found Response Helper
 */
export function sendNotFound(
  res: Response, 
  message: string = 'Resource not found'
): void {
  sendError(res, message, 404);
}

/**
 * Unauthorized Response Helper
 */
export function sendUnauthorized(
  res: Response, 
  message: string = 'Unauthorized'
): void {
  sendError(res, message, 401);
}

/**
 * Forbidden Response Helper
 */
export function sendForbidden(
  res: Response, 
  message: string = 'Forbidden'
): void {
  sendError(res, message, 403);
}

/**
 * Conflict Response Helper
 */
export function sendConflict(
  res: Response, 
  message: string = 'Conflict'
): void {
  sendError(res, message, 409);
}

/**
 * Rate Limit Response Helper
 */
export function sendRateLimit(
  res: Response, 
  message: string = 'Rate limit exceeded',
  retryAfter?: string
): void {
  const response: ApiResponse = {
    success: false,
    message
  };

  if (retryAfter) {
    response.data = { retryAfter };
  }

  res.status(429).json(response);
}
