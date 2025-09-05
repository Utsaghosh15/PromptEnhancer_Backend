import { Request, Response, NextFunction } from 'express';
import { z, ZodSchema } from 'zod';
import { sendValidationError, sendError } from '../utils/response';

/**
 * Zod validation middleware
 * Validates request body, query, or params against a schema
 */
export function zodValidate(schema: ZodSchema, target: 'body' | 'query' | 'params' = 'body') {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = req[target];
      const validated = schema.parse(data);
      
      // Replace the original data with validated data
      req[target] = validated;
      
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        sendValidationError(res, error.errors.map(err => ({
          field: err.path.join('.'),
          message: err.message
        })));
      } else {
        sendError(res, 'Validation error', 500);
      }
    }
  };
}

/**
 * Common validation schemas
 */
export const schemas = {
  // Auth schemas
  signup: z.object({
    email: z.string().email('Invalid email address'),
    password: z.string().min(8, 'Password must be at least 8 characters'),
  }),
  
  login: z.object({
    email: z.string().email('Invalid email address'),
    password: z.string().min(1, 'Password is required'),
  }),
  
  // Enhance schema
  enhance: z.object({
    prompt: z.string().min(1, 'Prompt is required').max(5000, 'Prompt too long'),
    sessionId: z.string().optional(),
    useHistory: z.boolean().optional().default(false),
    autoCreateSession: z.boolean().optional().default(false),
    lastMessages: z.array(z.object({
      role: z.enum(['user', 'assistant']),
      content: z.string()
    })).optional(),
  }),
  
  // Session schemas
  createSession: z.object({
    title: z.string().max(200, 'Title too long').optional(),
  }),
  
  updateSession: z.object({
    title: z.string().max(200, 'Title too long'),
  }),
  
  // Feedback schema
  feedback: z.object({
    promptId: z.string().min(1, 'Prompt ID is required'),
    accepted: z.boolean(),
  }),
  
  // Session ID param
  sessionId: z.object({
    id: z.string().min(1, 'Session ID is required'),
  }),
  
  // Prompt ID param
  promptId: z.object({
    id: z.string().min(1, 'Prompt ID is required'),
  }),
};
