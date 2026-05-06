// types.ts
export enum Language {
  SELECT = "Choose Language",
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
  uid?: string;
  name: string;
  streakCount?: number; 
  dailyStats?: number[]; 
  email: string;
  nativeLanguage: Language[];
  targetLanguage: Language[];
  bio: string;
  lastMessageAt?: number; 
  avatar: string;
  isOnline?: boolean;
  lastSeen?: any;
  favoriteMessages?: string[];
  xp?: number;
  questData?: QuestData;
  chatSessionCount?: number;
  messagedChatIds?: string[];
}

// Gamification Types
export type XPActionType =
  | 'messageSent'
  | 'replySent'
  | 'itemSaved'
  | 'profileCompleted'
  | 'dailyLogin'
  | 'questClaimed';

export interface QuestItem {
  id: string;
  title: string;
  description: string;
  target: number;
  progress: number;
  reward: number; // bonus XP
  claimed: boolean;
}

export interface QuestData {
  date: string; // e.g. "Mon Apr 28 2026"
  quests: QuestItem[];
  lastClaimedAt?: number;
}

export interface LevelInfo {
  name: string;
  index: number;
  threshold: number;
  nextThreshold: number | null;
  progress: number; // 0-100
  icon: string;
}

// Added 'system' from the update
export type MessageType = 'text' | 'image' | 'video' | 'file' | 'voice' | 'system';

export interface PendingAttachment {
  file: File;
  type: MessageType;
  previewUrl: string;
}

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

// Added 'offline', 'busy', and 'missed' from the update
export type CallStatus = 'ringing' | 'connecting' | 'active' | 'rejected' | 'ended' | 'offline' | 'busy' | 'missed';

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

// ... the rest of the file (ConversationPreview, SavedItem, etc.) stays the same as they were identical

export interface ConversationPreview {
  partnerId: string;
  partnerName: string;
  partnerAvatar: string;
  lastMessage: string;
  timestamp: number;
  unreadCount: number; 
  note?: string;
}

// Types for saved items (Phrasebook & Study Later)
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
  timestamp: number;            // when the item was saved

  // Source-reference fields (for trace-back to original message)
  partnerName: string;          // chat partner — provides conversation context
  originalTimestamp: number;    // when the original message was sent

  // User-added metadata
  note?: string;                // personal note (already used in SavedItemsView)
  translation?: string;         // cached translation of the message text

  // Future: review / flashcard metadata (not used yet)
  reviewed?: boolean;
  reviewCount?: number;
  lastReviewedAt?: number;
  difficulty?: 'easy' | 'medium' | 'hard';
  mastered?: boolean;
}

// Dictionary and Word Learning Types
export interface DictionaryMeaning {
  partOfSpeech?: string;
  definition: string;
  example?: string;
}

export interface DictionaryResult {
  word: string;
  translation?: string;
  phonetic?: string;
  meanings: DictionaryMeaning[];
}

export interface SavedVocabularyItem {
  id: string; // The lowercased word itself
  userId: string;
  word: string;
  translation?: string;
  phonetic?: string;
  meanings: DictionaryMeaning[];
  note?: string;

  // Source Context
  sourceMessageId: string;
  sourceChatId: string;
  sourceText: string;

  // Timestamps
  createdAt: number;
  updatedAt: number;

  // Future review
  reviewed?: boolean;
  reviewCount?: number;
  lastReviewedAt?: number;
  difficulty?: 'easy' | 'medium' | 'hard';
  mastered?: boolean;
}