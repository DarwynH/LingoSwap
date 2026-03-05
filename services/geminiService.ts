import { GoogleGenAI, Modality } from "@google/genai";
import { UserProfile } from '../types';
import { db } from '../firebase.ts';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';

export class GeminiService {
  private ai: GoogleGenAI;

  constructor() {
    this.ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
  }

  async getChatResponse(partner: UserProfile, history: { role: string; text: string }[], userMessage: string): Promise<string> {
    const chat = this.ai.chats.create({
      model: 'gemini-3-flash-preview',
      config: {
        systemInstruction: `You are ${partner.name}, a native ${partner.nativeLanguage} speaker who is learning ${partner.targetLanguage}. Respond naturally.`,
      },
    });

    const response = await chat.sendMessage({ message: userMessage });
    const botResponse = response.text || "Sorry, I couldn't process that.";

    await addDoc(collection(db, "chats"), {
      userId: partner.id,
      userMessage,
      botResponse,
      timestamp: serverTimestamp()
    });

    return botResponse;
  }

  async connectVoice(partner: UserProfile, callbacks: any) {
    return this.ai.live.connect({
      model: 'gemini-2.5-flash-native-audio-preview-09-2025',
      callbacks,
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } },
        },
        systemInstruction: `You are ${partner.name}, a helpful language partner.`,
      },
    });
  }
}

export const geminiService = new GeminiService();