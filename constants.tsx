
import { Language, UserProfile } from './types';

export const MOCK_PARTNERS: UserProfile[] = [
  {
    id: 'p1',
    name: 'Sofia Garcia',
    email: 'sofia@example.com',
    nativeLanguage: Language.SPANISH,
    targetLanguage: Language.ENGLISH,
    bio: 'Hola! I love sharing my Spanish culture and practicing my English fluency.',
    avatar: 'https://picsum.photos/seed/sofia/200'
  },
  {
    id: 'p2',
    name: 'Yuki Tanaka',
    email: 'yuki@example.com',
    nativeLanguage: Language.JAPANESE,
    targetLanguage: Language.ENGLISH,
    bio: 'Japanese native seeking English practice. Happy to help you with Kanji!',
    avatar: 'https://picsum.photos/seed/yuki/200'
  },
  {
    id: 'p3',
    name: 'Pierre Dubois',
    email: 'pierre@example.com',
    nativeLanguage: Language.FRENCH,
    targetLanguage: Language.SPANISH,
    bio: 'Looking for a Spanish buddy! I can help you with your French accent.',
    avatar: 'https://picsum.photos/seed/pierre/200'
  },
  {
    id: 'p4',
    name: 'Hans Müller',
    email: 'hans@example.com',
    nativeLanguage: Language.GERMAN,
    targetLanguage: Language.ENGLISH,
    bio: 'Technical professional wanting to improve conversational English.',
    avatar: 'https://picsum.photos/seed/hans/200'
  }
];

export const APP_THEME = {
  primary: '#25D366', // WhatsApp Green
  primaryDark: '#128C7E',
  secondary: '#34B7F1',
  background: '#ece5dd',
  white: '#ffffff',
  lightGray: '#f0f2f5'
};
