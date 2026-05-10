import { onCall, HttpsError } from "firebase-functions/v2/https";
import axios from "axios";

const DEEPL_API_KEY = process.env.DEEPL_API_KEY; 
const DEEPL_API_URL = "https://api-free.deepl.com/v2/translate";

export const translateMessage = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError(
      "unauthenticated", 
      "You must be logged in to translate messages."
    );
  }

  const { text, targetLang } = request.data;
  
  if (!text) {
    throw new HttpsError("invalid-argument", "Text to translate is required.");
  }

  // Use client-provided target language, default to EN-US for backward compatibility
  const resolvedTargetLang: string = targetLang || "EN-US";

  try {
    // NEW: Properly formatted DeepL API request
    const response = await axios.post(
      DEEPL_API_URL,
      {
        text: [text], // DeepL expects the text inside an array
        target_lang: resolvedTargetLang,
      },
      {
        headers: {
          "Authorization": `DeepL-Auth-Key ${DEEPL_API_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );

    return { 
      translatedText: response.data.translations[0].text 
    };
  } catch (error: any) {
    // NEW: This will print the exact error DeepL gives us to the Firebase Logs
    console.error("DeepL API Error:", error.response?.data || error.message);
    throw new HttpsError("internal", "Failed to translate message.");
  }
});
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_TRANSCRIPTION_URL = "https://api.openai.com/v1/audio/transcriptions";

export const transcribeVoiceMessage = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "You must be logged in to transcribe voice messages.");
  }

  if (!OPENAI_API_KEY) {
    throw new HttpsError("failed-precondition", "Voice transcription is not configured on the backend.");
  }

  const { audioUrl, language } = request.data as { audioUrl?: string; language?: string };
  if (!audioUrl) {
    throw new HttpsError("invalid-argument", "Audio URL is required for transcription.");
  }

  try {
    const audioResponse = await axios.get(audioUrl, { responseType: 'arraybuffer' });
    const audioBuffer = audioResponse.data;
    const contentType = audioResponse.headers['content-type'] || 'audio/webm';

    const blob = new (globalThis as any).Blob([audioBuffer], { type: contentType });
    const form = new (globalThis as any).FormData();
    form.append('model', 'gpt-4o-transcribe');
    form.append('file', blob, 'voice-message.webm');
    if (language) {
      form.append('language', language);
    }

    const transcriptionResponse = await fetch(OPENAI_TRANSCRIPTION_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: form as any,
    });

    const transcriptionJson = await transcriptionResponse.json();

    if (!transcriptionResponse.ok) {
      console.error('OpenAI transcription error:', transcriptionJson);
      throw new HttpsError('internal', 'Failed to transcribe voice message.');
    }

    return {
      transcript: transcriptionJson.text || '',
    };
  } catch (error: any) {
    console.error('Voice transcription failed:', error.response?.data || error.message || error);
    throw new HttpsError('internal', 'Voice transcription failed.');
  }
});