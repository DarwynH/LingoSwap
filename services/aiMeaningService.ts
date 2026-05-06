export interface AIExplanationResult {
  phrase: string;
  meaning: string;
  explanation: string;
  example: string;
  source: 'ai';
}

export const explainPhraseWithAI = async (
  phrase: string,
  context?: string
): Promise<AIExplanationResult | null> => {
  if (phrase.length > 120) {
    throw new Error('phrase_too_long');
  }

  const apiKey = import.meta.env.VITE_OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error('no_api_key');
  }

  const model = import.meta.env.VITE_OPENROUTER_MODEL || 'openrouter/free';

  const prompt = `Explain the following slang, idiom, informal phrase, or short expression for a language learner.
Return JSON only with this exact shape:
{
  "meaning": "short meaning, max 12 words",
  "explanation": "simple explanation, max 2 sentences",
  "example": "one natural example sentence"
}
If the phrase is not slang/idiom/informal expression, still explain its likely meaning briefly.
Phrase: ${phrase}
Context: ${context || 'None'}`;

  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'HTTP-Referer': window.location.origin,
        'X-Title': 'LingoSwap Explainer'
      },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: prompt }],
        response_format: { type: "json_object" }
      })
    });

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    let content = data.choices?.[0]?.message?.content;
    if (!content) return null;

    // Clean up potential markdown formatting around JSON
    content = content.replace(/```json/gi, '').replace(/```/g, '').trim();

    const parsed = JSON.parse(content);

    if (parsed.meaning && parsed.explanation && parsed.example) {
      return {
        phrase,
        meaning: parsed.meaning,
        explanation: parsed.explanation,
        example: parsed.example,
        source: 'ai',
      };
    }
  } catch (err) {
    console.warn('AI fallback failed', err);
  }

  return null;
};
