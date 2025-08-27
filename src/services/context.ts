import { ISynopsis } from '../models/Session';

/**
 * Classify input as standalone or follow-up
 */
export function classifyInput(prompt: string): { isFollowUp: boolean; confidence: number } {
  const followUpMarkers = [
    /^(continue|keep going|more|next|and then|also|additionally|furthermore|moreover)/i,
    /^(what about|how about|can you|could you|would you|please)/i,
    /^(but|however|though|although|except|unless)/i,
    /^(yes|no|ok|okay|sure|absolutely|definitely)/i,
    /^(thanks|thank you|thx)/i,
    /\?$/, // Ends with question mark
  ];

  let followUpScore = 0;
  for (const marker of followUpMarkers) {
    if (marker.test(prompt)) {
      followUpScore += 1;
    }
  }

  const isFollowUp = followUpScore >= 1;
  const confidence = Math.min(followUpScore / followUpMarkers.length, 1);

  return { isFollowUp, confidence };
}

/**
 * Build context from synopsis and recent messages
 */
export function buildContext(
  synopsis: ISynopsis,
  lastMessages: Array<{ role: 'user' | 'assistant'; content: string }>
): {
  context: string;
  contextUsed: { lastTurns: number; synopsisChars: number };
} {
  const contextParts: string[] = [];
  let synopsisChars = 0;

  // Add synopsis context
  if (synopsis) {
    const synopsisParts: string[] = [];
    
    if (synopsis.goal) {
      synopsisParts.push(`Goal: ${synopsis.goal}`);
      synopsisChars += synopsis.goal.length;
    }
    if (synopsis.tone) {
      synopsisParts.push(`Tone: ${synopsis.tone}`);
      synopsisChars += synopsis.tone.length;
    }
    if (synopsis.constraints) {
      synopsisParts.push(`Constraints: ${synopsis.constraints}`);
      synopsisChars += synopsis.constraints.length;
    }
    if (synopsis.audience) {
      synopsisParts.push(`Audience: ${synopsis.audience}`);
      synopsisChars += synopsis.audience.length;
    }
    if (synopsis.style) {
      synopsisParts.push(`Style: ${synopsis.style}`);
      synopsisChars += synopsis.style.length;
    }
    if (synopsis.todos && synopsis.todos.length > 0) {
      synopsisParts.push(`TODOs: ${synopsis.todos.join(', ')}`);
      synopsisChars += synopsis.todos.join(', ').length;
    }

    if (synopsisParts.length > 0) {
      contextParts.push(`Session Context:\n${synopsisParts.join('\n')}`);
    }
  }

  // Add recent messages (last 3-5 turns)
  const recentMessages = lastMessages.slice(-6); // Last 3 exchanges
  if (recentMessages.length > 0) {
    const messageText = recentMessages
      .map(msg => `${msg.role}: ${msg.content}`)
      .join('\n');
    contextParts.push(`Recent conversation:\n${messageText}`);
  }

  const context = contextParts.join('\n\n');
  
  // Token budget clamp (~2k tokens)
  const maxContextLength = 2000;
  const clampedContext = context.length > maxContextLength 
    ? context.substring(0, maxContextLength) + '...'
    : context;

  return {
    context: clampedContext,
    contextUsed: {
      lastTurns: recentMessages.length,
      synopsisChars
    }
  };
}
