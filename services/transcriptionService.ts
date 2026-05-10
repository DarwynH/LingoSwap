import { app } from '../firebase';
import { getFunctions, httpsCallable } from 'firebase/functions';

const functions = getFunctions(app);
const transcribeVoiceMessageCloudFn = httpsCallable(functions, 'transcribeVoiceMessage');

export const requestVoiceTranscript = async (audioUrl: string, language?: string): Promise<string> => {
  try {
    const result = await transcribeVoiceMessageCloudFn({ audioUrl, language });
    const data = result.data as { transcript?: string };
    return data.transcript || '';
  } catch (error) {
    console.warn('Voice transcription request failed:', error);
    return '';
  }
};
