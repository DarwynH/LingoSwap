import { app } from '../firebase';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { Language } from '../types';

const functions = getFunctions(app);
const translateMessageCloudFn = httpsCallable(functions, 'translateMessage');

/**
 * Mapping from app Language enum values to DeepL target_lang codes.
 */
export const DEEPL_LANGUAGE_MAP: Record<string, string> = {
  'English': 'EN-US',
  'Traditional Chinese': 'ZH-HANT',
  'Simplified Chinese': 'ZH-HANS',
  'Chinese': 'ZH-HANT', // Default Chinese to Traditional Chinese
  'Japanese': 'JA',
  'Korean': 'KO',
  'Indonesian': 'ID',
  'Spanish': 'ES',
  'French': 'FR',
  'German': 'DE',
  'Italian': 'IT',
  'Portuguese': 'PT-PT',
};

/**
 * Returns the display name for a DeepL target_lang code.
 */
export const getLanguageDisplayName = (targetLang: string): string => {
  const reverseMap: Record<string, string> = {
    'EN-US': 'English',
    'ZH-HANT': 'Traditional Chinese',
    'ZH-HANS': 'Simplified Chinese',
    'JA': 'Japanese',
    'KO': 'Korean',
    'ID': 'Indonesian',
    'ES': 'Spanish',
    'FR': 'French',
    'DE': 'German',
    'IT': 'Italian',
    'PT-PT': 'Portuguese',
  };
  return reverseMap[targetLang] || targetLang;
};

/**
 * Flat list of selectable DeepL target languages for in-chat pickers.
 */
export const DEEPL_SELECTABLE_LANGUAGES: { code: string; name: string }[] = [
  { code: 'EN-US', name: 'English' },
  { code: 'ZH-HANT', name: 'Traditional Chinese' },
  { code: 'ZH-HANS', name: 'Simplified Chinese' },
  { code: 'JA', name: 'Japanese' },
  { code: 'KO', name: 'Korean' },
  { code: 'ID', name: 'Indonesian' },
  { code: 'ES', name: 'Spanish' },
  { code: 'FR', name: 'French' },
  { code: 'DE', name: 'German' },
  { code: 'IT', name: 'Italian' },
  { code: 'PT-PT', name: 'Portuguese' },
];

/**
 * Resolves a Language enum value to the corresponding DeepL target_lang code.
 * Falls back to EN-US if no mapping exists.
 */
export const resolveDeepLTarget = (language?: Language | string): string => {
  if (!language) return 'EN-US';
  return DEEPL_LANGUAGE_MAP[language] || 'EN-US';
};

/**
 * Generic translation function — translates text to the specified DeepL target language.
 * @param text       The source text to translate.
 * @param targetLang DeepL target_lang code (e.g. "EN-US", "JA", "ZH-HANT").
 *                   Defaults to "EN-US" if omitted.
 */
export const translateText = async (
  text: string,
  targetLang: string = 'EN-US'
): Promise<string> => {
  try {
    const result = await translateMessageCloudFn({ text, targetLang });
    const data = result.data as { translatedText: string };
    return data.translatedText;
  } catch (error) {
    console.error("Translation failed:", error);
    throw error;
  }
};

/**
 * Backward-compatible wrapper — translates text to English (EN-US).
 */
export const translateTextToEnglish = async (text: string): Promise<string> => {
  return translateText(text, 'EN-US');
};