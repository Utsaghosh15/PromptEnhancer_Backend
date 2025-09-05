import { Router, Request, Response } from 'express';
import { requireAuthOptional, anonId, limitEnhance } from '../middleware';
import { setAnonIdCookie } from '../middleware/anonId';
import { zodValidate, schemas } from '../middleware/zod';
import { enhancePrompt } from '../services/openai';
import { Session, Prompt } from '../models';
import { classifyInput, buildContext } from '../services/context';
import { verifyPrompt } from '../services/verify';
import { logger } from '../utils/logger';

const router = Router();

/**
 * POST /enhance
 * Enhance a prompt using AI with optional context
 */
router.post('/enhance',
  requireAuthOptional,
  anonId,
  limitEnhance,
  zodValidate(schemas.enhance),
  async (req: Request, res: Response) => {
    try {
      const { prompt, sessionId, useHistory, lastMessages, autoCreateSession } = req.body;
      const userId = req.userId;
      const anonId = req.anonId;
      
      const startTime = Date.now();

      // Classify input as standalone or follow-up
      const classification = classifyInput(prompt);
      const isFollowUp = classification.isFollowUp;

      // Handle session management
      let context: string | undefined;
      let contextUsed = { lastTurns: 0, synopsisChars: 0 };
      let session: any = null;
      let finalSessionId = sessionId;

      // Auto-create session if requested and no sessionId provided
      if (autoCreateSession && !sessionId) {
        try {
          const autoSession = await Session.createSession(userId, undefined, anonId);
          finalSessionId = autoSession._id.toString();
          logger.info('Auto-created session', { sessionId: finalSessionId });
        } catch (error) {
          logger.error('Failed to auto-create session:', error);
        }
      }

      // Build context if needed
      if (useHistory && isFollowUp && finalSessionId) {
        try {
          // Build query based on authentication
          let query: any = { _id: finalSessionId };
          if (userId) {
            query.userId = userId;
          } else if (anonId) {
            query.anonId = anonId;
          }

          // Fetch session
          session = await Session.findOne(query);
          if (session) {
            // Build context from synopsis and recent messages
            const contextResult = buildContext(session.synopsis, lastMessages || []);
            context = contextResult.context;
            contextUsed = contextResult.contextUsed;
          }
        } catch (error) {
          logger.error('Failed to fetch session context:', error);
        }
      }

      // Enhance the prompt
      const enhancement = await enhancePrompt(prompt, context, lastMessages);

      // Verify the enhanced prompt
      const verification = await verifyPrompt(enhancement.enhancedPrompt);
      let finalPrompt = enhancement.enhancedPrompt;

      if (!verification.isValid) {
        // Try to patch the prompt if verification failed
        try {
          const patchedPrompt = await patchPrompt(enhancement.enhancedPrompt, prompt);
          finalPrompt = patchedPrompt;
        } catch (error) {
          logger.error('Failed to patch prompt:', error);
        }
      }

      // Persist the prompt
      const promptDoc = await Prompt.createPrompt({
        userId,
        sessionId: finalSessionId,
        original: prompt,
        enhanced: finalPrompt,
        useHistory: useHistory && isFollowUp,
        contextUsed,
        model: enhancement.model,
        latencyMs: Date.now() - startTime,
        tokens: enhancement.tokens,
      });

      // Set anonymous ID cookie only if user is anonymous and this is their first usage
      if (!userId && anonId && !req.cookies?.['pe_anon_id']) {
        setAnonIdCookie(res, anonId);
      }

      // Enqueue synopsis update if this is a follow-up
      if (isFollowUp && finalSessionId && session) {
        try {
          const { enqueueSynopsisUpdate } = await import('../services/queue');
          await enqueueSynopsisUpdate(finalSessionId, lastMessages || []);
        } catch (error) {
          logger.error('Failed to enqueue synopsis update:', error);
        }
      }

      res.json({
        enhancedPrompt: finalPrompt,
        latencyMs: Date.now() - startTime,
        tokens: enhancement.tokens,
        promptId: promptDoc._id,
        sessionId: finalSessionId || null,
        useHistory: useHistory && isFollowUp,
        contextUsed,
      });

    } catch (error) {
      logger.error('Enhance error:', error);
      res.status(500).json({ error: 'Failed to enhance prompt' });
    }
  }
);

/**
 * Patch a prompt that failed verification
 */
async function patchPrompt(enhancedPrompt: string, originalPrompt: string): Promise<string> {
  const { getOpenAI } = await import('../services/openai');
  const client = getOpenAI();

  try {
    const completion = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are a prompt enhancement assistant. Fix the given prompt to include task, object, and output constraints.'
        },
        {
          role: 'user',
          content: `Original: ${originalPrompt}\nEnhanced (needs fixing): ${enhancedPrompt}\n\nFix the enhanced prompt to include task, object, and output constraints. Return ONLY the fixed prompt.`
        }
      ],
      temperature: 0.1,
      max_tokens: 500,
    });

    return completion.choices[0]?.message?.content?.trim() || enhancedPrompt;
  } catch (error) {
    logger.error('Prompt patching failed:', error);
    return enhancedPrompt;
  }
}

export default router;
