import { getOpenAI } from './openai';

/**
 * Verify that a prompt includes necessary constraints
 */
export async function verifyPrompt(prompt: string): Promise<{
  isValid: boolean;
  missing: string[];
  score: number;
}> {
  const requiredElements = [
    'task',
    'object', 
    'output'
  ];

  const elementPatterns = {
    task: [
      /(write|create|generate|produce|develop|build|make|compose|draft|formulate)/i,
      /(analyze|examine|review|evaluate|assess|study|investigate)/i,
      /(explain|describe|summarize|outline|detail|elaborate)/i,
    ],
    object: [
      /(about|regarding|concerning|on|for|of)/i,
      /(document|text|content|material|information|data)/i,
      /(topic|subject|theme|issue|matter)/i,
    ],
    output: [
      /(format|style|tone|voice|approach|method)/i,
      /(length|size|extent|scope|detail|level)/i,
      /(audience|reader|viewer|user|target)/i,
      /(purpose|goal|objective|aim|intention)/i,
    ]
  };

  const missing: string[] = [];
  let score = 0;

  for (const element of requiredElements) {
    const patterns = elementPatterns[element as keyof typeof elementPatterns];
    let found = false;

    for (const pattern of patterns) {
      if (pattern.test(prompt)) {
        found = true;
        score += 1;
        break;
      }
    }

    if (!found) {
      missing.push(element);
    }
  }

  const isValid = missing.length === 0;
  const normalizedScore = score / requiredElements.length;

  return {
    isValid,
    missing,
    score: normalizedScore
  };
}

/**
 * Verify prompt using AI for more sophisticated validation
 */
export async function verifyPromptAI(prompt: string): Promise<{
  isValid: boolean;
  feedback: string;
  score: number;
}> {
  const client = getOpenAI();

  try {
    const completion = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are a prompt quality validator. Rate prompts on a scale of 0-10 based on clarity, specificity, and completeness. Return JSON with: {score: number, isValid: boolean, feedback: string}'
        },
        {
          role: 'user',
          content: `Evaluate this prompt: "${prompt}"`
        }
      ],
      temperature: 0.1,
      max_tokens: 200,
    });

    const response = completion.choices[0]?.message?.content?.trim();
    if (!response) {
      return { isValid: false, feedback: 'Failed to verify prompt', score: 0 };
    }

    try {
      const result = JSON.parse(response);
      return {
        isValid: result.score >= 7,
        feedback: result.feedback || 'No feedback provided',
        score: result.score / 10 // Normalize to 0-1
      };
    } catch (parseError) {
      return { isValid: false, feedback: 'Invalid verification response', score: 0 };
    }
  } catch (error) {
    return { isValid: false, feedback: 'Verification failed', score: 0 };
  }
}
