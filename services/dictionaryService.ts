import { translateTextToEnglish } from './translationService';
import { DictionaryResult } from '../types';

/**
 * Looks up a single word using translation and the Free Dictionary API.
 * Returns a normalized, UI-friendly result shape, gracefully degrading on failure.
 */
export const lookupWord = async (word: string): Promise<DictionaryResult> => {
  const cleanWord = word.trim().toLowerCase();
  
  // Safe fallback UI shape
  const result: DictionaryResult = {
    word: cleanWord,
    meanings: [],
  };

  if (!cleanWord) return result;

  try {
    // 1. Fetch translation using existing DeepL wrapper
    // We catch and swallow translation errors so the UI doesn't crash
    const translationPromise = translateTextToEnglish(cleanWord).catch((err) => {
      console.warn('Translation failed for word:', cleanWord, err);
      return undefined;
    });

    // 2. Fetch dictionary definitions (Free Dictionary API focuses on English)
    const dictPromise = fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(cleanWord)}`)
      .then(res => {
        if (!res.ok) {
          // 404 just means word not found (e.g., non-English or typo)
          if (res.status === 404) return null; 
          throw new Error(`Dictionary API error: ${res.status}`);
        }
        return res.json();
      })
      .catch((err) => {
        console.warn('Dictionary lookup failed for word:', cleanWord, err);
        return null;
      });

    // Wait for both promises to resolve independently
    const [translation, dictData] = await Promise.all([translationPromise, dictPromise]);

    // Populate translation if available
    if (translation && translation.toLowerCase() !== cleanWord) {
      result.translation = translation;
    }

    // Populate dictionary data if available
    if (dictData && Array.isArray(dictData) && dictData.length > 0) {
      const entry = dictData[0];
      
      // Extract phonetic spelling safely
      if (entry.phonetic) {
        result.phonetic = entry.phonetic;
      } else if (entry.phonetics && Array.isArray(entry.phonetics)) {
        const phoneticObj = entry.phonetics.find((p: any) => p.text);
        if (phoneticObj) {
          result.phonetic = phoneticObj.text;
        }
      }

      // Extract meanings safely, limiting to keep the UI clean
      if (entry.meanings && Array.isArray(entry.meanings)) {
        entry.meanings.forEach((m: any) => {
          if (m.definitions && Array.isArray(m.definitions)) {
            // Take up to 2 definitions per part of speech to avoid UI bloat
            const topDefs = m.definitions.slice(0, 2);
            topDefs.forEach((def: any) => {
              if (def.definition) {
                result.meanings.push({
                  partOfSpeech: m.partOfSpeech || undefined,
                  definition: def.definition,
                  example: def.example || undefined,
                });
              }
            });
          }
        });
      }
    }

    return result;
  } catch (error) {
    // Extremely safe fallback for any unexpected execution error
    console.error('Fatal lookup word error:', error);
    return result; 
  }
};
