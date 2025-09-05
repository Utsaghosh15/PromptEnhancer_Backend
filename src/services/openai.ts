import OpenAI from 'openai';
import { env } from '../utils/env';
import { logger } from '../utils/logger';

// OpenAI client instance
let openai: OpenAI | null = null;

/**
 * Initialize OpenAI client
 */
export function initOpenAI(): OpenAI {
  if (openai) {
    return openai;
  }

  openai = new OpenAI({
    apiKey: env.OPENAI_API_KEY,
  });

  return openai;
}

/**
 * Get OpenAI client instance
 */
export function getOpenAI(): OpenAI {
  if (!openai) {
    return initOpenAI();
  }
  return openai;
}

/**
 * Enhance a prompt using OpenAI
 */
export async function enhancePrompt(
  originalPrompt: string,
  context?: string,
  lastMessages?: Array<{ role: 'user' | 'assistant'; content: string }>
): Promise<{
  enhancedPrompt: string;
  tokens: { in: number; out: number };
  model: string;
}> {
  const client = getOpenAI();
  const startTime = Date.now();

  // Build messages array
  const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    {
      role: 'system',
      content: 'You rewrite prompts; preserve meaning; add only implied constraints; return ONLY the rewritten prompt.'
    }
  ];

  // Add context if provided
  if (context) {
    messages.push({
      role: 'user',
      content: `Context: ${context}\n\nCurrent input: ${originalPrompt}`
    });
  } else {
    messages.push({
      role: 'user',
      content: originalPrompt
    });
  }

  try {
    const completion = await client.chat.completions.create({
      model: env.MODEL_FAST,
      messages,
      temperature: 0.1,
      max_tokens: 1000,
    });

    const enhancedPrompt = completion.choices[0]?.message?.content?.trim() || originalPrompt;
    const latencyMs = Date.now() - startTime;

    logger.info(`Prompt enhanced in ${latencyMs}ms`, {
      model: env.MODEL_FAST,
      tokens: completion.usage,
      hasContext: !!context
    });

    return {
      enhancedPrompt,
      tokens: {
        in: completion.usage?.prompt_tokens || 0,
        out: completion.usage?.completion_tokens || 0
      },
      model: env.MODEL_FAST
    };
  } catch (error) {
    logger.error('OpenAI API error:', error);
    throw new Error('Failed to enhance prompt');
  }
}

/**
 * Update session synopsis using OpenAI
 */
export async function updateSynopsis(
  currentSynopsis: any,
  recentMessages: Array<{ role: 'user' | 'assistant'; content: string }>
): Promise<{
  synopsis: any;
  tokens: { in: number; out: number };
}> {
  const client = getOpenAI();
  
  const synopsisText = Object.entries(currentSynopsis)
    .filter(([_, value]) => value)
    .map(([key, value]) => `${key}: ${value}`)
    .join('\n');

  const recentText = recentMessages
    .map(msg => `${msg.role}: ${msg.content}`)
    .join('\n');

  const prompt = `Previous synopsis:\n${synopsisText || 'None'}\n\nRecent conversation:\n${recentText}\n\nReturn 3-6 bullets: Goal, Tone/Style, Constraints, Audience, (optional) Style/TODOs; <=120 chars each; update existing fields conservatively.`;

  try {
    const completion = await client.chat.completions.create({
      model: env.MODEL_FAST,
      messages: [
        {
          role: 'system',
          content: 'You are a helpful assistant that updates conversation synopses based on recent messages.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.1,
      max_tokens: 500,
    });

    const response = completion.choices[0]?.message?.content?.trim() || '';
    
    // Parse the response into structured synopsis
    const synopsis = parseSynopsisResponse(response);

    return {
      synopsis,
      tokens: {
        in: completion.usage?.prompt_tokens || 0,
        out: completion.usage?.completion_tokens || 0
      }
    };
  } catch (error) {
    logger.error('Failed to update synopsis:', error);
    throw new Error('Failed to update synopsis');
  }
}

/**
 * Parse synopsis response from OpenAI
 */
function parseSynopsisResponse(response: string): any {
  const synopsis: any = {};
  const lines = response.split('\n').filter(line => line.trim());
  
  for (const line of lines) {
    const match = line.match(/^[-*]\s*(\w+):\s*(.+)$/i);
    if (match) {
      const [, key, value] = match;
      const normalizedKey = key.toLowerCase();
      
      if (['goal', 'tone', 'constraints', 'audience', 'style'].includes(normalizedKey)) {
        synopsis[normalizedKey] = value.trim();
      } else if (normalizedKey === 'todos') {
        if (!synopsis.todos) synopsis.todos = [];
        synopsis.todos.push(value.trim());
      }
    }
  }
  
  return synopsis;
}
