import { getFunctions, httpsCallable } from 'firebase/firestore'; // Note: getFunctions is actually in 'firebase/functions'
import { app } from '../firebase'; // Adjust this import based on where your Firebase app is initialized
import { getFunctions as initFunctions, httpsCallable as initHttpsCallable } from 'firebase/functions';

const functions = initFunctions(app);
const translateMessageCloudFn = initHttpsCallable(functions, 'translateMessage');

export const translateTextToEnglish = async (text: string): Promise<string> => {
  try {
    const result = await translateMessageCloudFn({ text });
    const data = result.data as { translatedText: string };
    return data.translatedText;
  } catch (error) {
    console.error("Translation failed:", error);
    throw error;
  }
};