// types.ts
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
  lastMessageAt?: number; 
  avatar: string;
  isOnline?: boolean;
  lastSeen?: number;
  favoriteMessages?: string[]; 
}

export type MessageType = 'text' | 'image' | 'video' | 'file' | 'voice';

export interface ChatMessage {
  id: string;
  senderId: string;
  receiverId: string; 
  text: string;
  timestamp: number;
  read: boolean; 
  readAt?: number | null; 
  type?: MessageType;
  fileURL?: string;
  fileName?: string;
  fileSize?: number;
  mimeType?: string;
  audioDuration?: number;
  replyTo?: {
    messageId: string;
    text: string;
    senderId: string;
    senderName: string;
  };
}

export interface ChatSession {
  id: string;
  partner: UserProfile;
  messages: ChatMessage[];
  lastMessage?: string;
}

export type CallStatus = 'ringing' | 'connecting' | 'active' | 'rejected' | 'ended';

export interface CallData {
  id: string; 
  callerId: string;
  receiverId: string;
  callerName: string;
  callerAvatar: string;
  status: CallStatus;
  type: 'voice' | 'video'; 
  offer?: RTCSessionDescriptionInit;
  answer?: RTCSessionDescriptionInit;
  createdAt: number;
}

export interface ConversationPreview {
  partnerId: string;
  partnerName: string;
  partnerAvatar: string;
  lastMessage: string;
  timestamp: number;
  unreadCount: number; 
}

// NEW: Types for saved items (Phrasebook & Study Later)
export type SavedItemType = 'phrasebook' | 'study_later';

export interface SavedItem {
  id: string; 
  userId: string;
  chatId: string;
  messageId: string;
  type: SavedItemType;
  text: string;
  senderId: string;
  senderName: string;
  timestamp: number;
}