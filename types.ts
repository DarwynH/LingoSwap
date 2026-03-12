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
  receiverId: string; // NEW: Added for read receipts
  text: string;
  timestamp: number;
  read: boolean; // NEW: Added for read receipts
  readAt?: number | null; // NEW: Added for read receipts
}

export interface ChatSession {
  id: string;
  partner: UserProfile;
  messages: ChatMessage[];
  lastMessage?: string;
}

//New line added Below Log  3/7 3/8

export type CallStatus = 'ringing' | 'connecting' | 'active' | 'rejected' | 'ended';

export interface CallData {
  id: string; 
  callerId: string;
  receiverId: string;
  callerName: string;
  callerAvatar: string;
  status: CallStatus;
  type: 'voice' | 'video'; // NEW: Track the type of call
  offer?: RTCSessionDescriptionInit;
  answer?: RTCSessionDescriptionInit;
  createdAt: number;
}

// NEW: Added for chat list metadata and unread indicators
export interface ConversationPreview {
  partnerId: string;
  partnerName: string;
  partnerAvatar: string;
  lastMessage: string;
  timestamp: number;
  unreadCount: number; 
}