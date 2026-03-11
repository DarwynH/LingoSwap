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

  const { text } = request.data;
  
  if (!text) {
    throw new HttpsError("invalid-argument", "Text to translate is required.");
  }

  try {
    // NEW: Properly formatted DeepL API request
    const response = await axios.post(
      DEEPL_API_URL,
      {
        text: [text], // DeepL expects the text inside an array
        target_lang: "EN-US",
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