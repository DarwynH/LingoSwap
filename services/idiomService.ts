import { translateText } from './translationService';
import idiomsData from '../src/data/idioms.json';
import { explainPhraseWithAI } from './aiMeaningService';

export interface IdiomExplanation {
  phrase: string;
  sourceLanguage: string;
  meaning: string;
  explanation?: string;
  example?: string;
  translatedMeaning?: string;
  translatedExplanation?: string;
  translatedExample?: string;
  source: string;
}

// In-memory cache to avoid repeated API calls
const cache = new Map<string, IdiomExplanation>();

/**
 * Looks up an idiom or slang phrase.
 * First checks local JSON dataset of common phrases (public domain / free).
 * Falls back to Free Dictionary API for single-word slang or wider coverage.
 * Translates the explanation to preferredLanguage using existing DeepL helper.
 */
export const lookupIdiomOrSlang = async (
  phrase: string,
  preferredLanguage?: string
): Promise<IdiomExplanation | null> => {
  const normalized = phrase.toLowerCase().trim().replace(/[.,!?;:]/g, '').replace(/\s+/g, ' ');
  if (!normalized) return null;

  const cacheKey = `${normalized}_${preferredLanguage || 'EN-US'}`;
  if (cache.has(cacheKey)) {
    return cache.get(cacheKey)!;
  }

  let result: IdiomExplanation | null = null;

  // 1. Search local dataset first
  const localMatch = idiomsData.find(item => item.phrase === normalized);
  if (localMatch) {
    result = {
      phrase: localMatch.phrase,
      sourceLanguage: 'English',
      meaning: localMatch.meaning,
      explanation: localMatch.explanation,
      example: localMatch.example,
      source: 'LingoSwap Curated Dataset',
    };
  }

  // 2. Fallback to Free Dictionary API
  if (!result) {
    try {
      const url = `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(normalized)}`;
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        if (data && data.length > 0) {
          const entry = data[0];
          const meaningObj = entry.meanings?.[0];
          const defObj = meaningObj?.definitions?.[0];

          if (defObj && defObj.definition) {
            result = {
              phrase: entry.word || phrase,
              sourceLanguage: 'English',
              meaning: defObj.definition,
              example: defObj.example,
              source: 'Free Dictionary API', // Clear attribution
            };
          }
        }
      }
    } catch (err) {
      console.warn("Free Dictionary API lookup failed", err);
      // Fail silently and return null if both fail
    }
  }

  // 3. Fallback to AI
  if (!result) {
    try {
      // Limit phrase length check is inside explainPhraseWithAI
      const aiResult = await explainPhraseWithAI(phrase);
      if (aiResult) {
        result = {
          phrase: aiResult.phrase,
          sourceLanguage: 'English',
          meaning: aiResult.meaning,
          explanation: aiResult.explanation,
          example: aiResult.example,
          source: 'ai',
        };
      }
    } catch (err: any) {
      if (err.message === 'phrase_too_long' || err.message === 'no_api_key') {
        throw err;
      }
      console.warn("AI fallback lookup failed", err);
    }
  }

  if (!result) return null;

  // 3. Translate if needed
  if (preferredLanguage && preferredLanguage !== 'EN-US') {
    try {
      if (result.meaning) {
        result.translatedMeaning = await translateText(result.meaning, preferredLanguage);
      }
      if (result.explanation) {
        result.translatedExplanation = await translateText(result.explanation, preferredLanguage);
      }
      if (result.example) {
        result.translatedExample = await translateText(result.example, preferredLanguage);
      }
    } catch (err) {
      console.warn("Translation failed for explanation", err);
    }
  }

  cache.set(cacheKey, result);
  return result;
};
