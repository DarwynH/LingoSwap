
export enum Language {
  ENGLISH = 'English',
  SPANISH = 'Spanish',
  FRENCH = 'French',
  GERMAN = 'German',
  JAPANESE = 'Japanese',
  CHINESE = 'Chinese',
  KOREAN = 'Korean',
  ITALIAN = 'Italian',
  PORTUGUESE = 'Portuguese'
}

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  nativeLanguage: Language;
  targetLanguage: Language;
  bio: string;
  lastMessageAt?: number; // Fixes sorting error
  avatar: string;
  isOnline?: boolean;
  lastSeen?: number;
}

export interface ChatMessage {
  id: string;
  senderId: string;
  text: string;
  timestamp: number;
}

export interface ChatSession {
  id: string;
  partner: UserProfile;
  messages: ChatMessage[];
  lastMessage?: string;
}

//New line added Below Log  3/7 1:38 AM

export type CallStatus = 'ringing' | 'connecting' | 'connected' | 'rejected' | 'ended';

export interface CallData {
  id: string; // The Firestore document ID
  callerId: string;
  receiverId: string;
  callerName: string;
  callerAvatar: string;
  status: CallStatus;
  offer?: RTCSessionDescriptionInit;
  answer?: RTCSessionDescriptionInit;
  createdAt: number;
}