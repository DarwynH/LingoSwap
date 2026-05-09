import { UserProfile } from '../types';
import { isRecentlyOnline } from './presenceUtils';

/**
 * Normalizes a language string for comparison.
 */
export function normalizeLanguage(value: string | undefined | null): string {
  if (!value) return '';
  const normalized = value.trim().toLowerCase().replace(/-/g, '').replace(/_/g, '');
  
  // Map common abbreviations to standard names
  if (normalized.startsWith('en')) return 'english';
  if (normalized.startsWith('zh')) return 'chinese'; // Includes zh-hant, zh-hans
  if (normalized.startsWith('ja') || normalized === 'jpn') return 'japanese';
  if (normalized.startsWith('ko') || normalized === 'kor') return 'korean';
  if (normalized.startsWith('id') || normalized === 'ind') return 'indonesian';
  if (normalized.startsWith('es') || normalized === 'spa') return 'spanish';
  if (normalized.startsWith('fr') || normalized === 'fra') return 'french';
  if (normalized.startsWith('de') || normalized === 'ger') return 'german';
  if (normalized.startsWith('it') || normalized === 'ita') return 'italian';
  if (normalized.startsWith('pt') || normalized === 'por') return 'portuguese';

  return normalized;
}

/**
 * Normalizes an array or single string of languages into an array of normalized strings.
 */
export function getNormalizedLanguages(langs: any): string[] {
  if (!langs) return [];
  if (Array.isArray(langs)) {
    return langs.map(l => normalizeLanguage(l)).filter(Boolean);
  }
  if (typeof langs === 'string') {
    return [normalizeLanguage(langs)].filter(Boolean);
  }
  return [];
}

/**
 * Calculates a match score between a current user and a potential partner.
 */
export function getPartnerMatchScore(currentUser: UserProfile, partner: UserProfile): number {
  let score = 0;
  
  const myNatives = getNormalizedLanguages(currentUser.nativeLanguage);
  const myTargets = getNormalizedLanguages(currentUser.targetLanguage);
  
  const partnerNatives = getNormalizedLanguages(partner.nativeLanguage);
  const partnerTargets = getNormalizedLanguages(partner.targetLanguage);
  
  const partnerCanHelpMe = myTargets.some(lang => partnerNatives.includes(lang));
  const iCanHelpPartner = myNatives.some(lang => partnerTargets.includes(lang));
  
  if (partnerCanHelpMe && iCanHelpPartner) {
    score += 100;
  } else if (partnerCanHelpMe) {
    score += 50;
  } else if (iCanHelpPartner) {
    score += 30;
  }
  
  if (isRecentlyOnline(partner.isOnline, partner.lastSeen)) {
    score += 10;
  }

  return score;
}

/**
 * Returns true if the match is reciprocal.
 */
export function isReciprocalMatch(currentUser: UserProfile, partner: UserProfile): boolean {
  const myNatives = getNormalizedLanguages(currentUser.nativeLanguage);
  const myTargets = getNormalizedLanguages(currentUser.targetLanguage);
  
  const partnerNatives = getNormalizedLanguages(partner.nativeLanguage);
  const partnerTargets = getNormalizedLanguages(partner.targetLanguage);
  
  const partnerCanHelpMe = myTargets.some(lang => partnerNatives.includes(lang));
  const iCanHelpPartner = myNatives.some(lang => partnerTargets.includes(lang));
  
  return partnerCanHelpMe && iCanHelpPartner;
}

/**
 * Sorts partners primarily by match score, falling back to online status and display name.
 */
export function sortPartnersByMatch(currentUser: UserProfile, partners: UserProfile[]): UserProfile[] {
  return [...partners].sort((a, b) => {
    const scoreA = getPartnerMatchScore(currentUser, a);
    const scoreB = getPartnerMatchScore(currentUser, b);
    
    if (scoreA !== scoreB) {
      return scoreB - scoreA;
    }
    
    const aOnline = isRecentlyOnline(a.isOnline, a.lastSeen);
    const bOnline = isRecentlyOnline(b.isOnline, b.lastSeen);
    
    if (aOnline && !bOnline) return -1;
    if (!aOnline && bOnline) return 1;
    
    const nameA = a.name || '';
    const nameB = b.name || '';
    return nameA.localeCompare(nameB);
  });
}

/**
 * Generates a helpful match badge string based on how they match the user.
 */
export function getMatchDescription(currentUser: UserProfile, partner: UserProfile): string | null {
  const myNatives = getNormalizedLanguages(currentUser.nativeLanguage);
  const myTargets = getNormalizedLanguages(currentUser.targetLanguage);
  
  const partnerNatives = getNormalizedLanguages(partner.nativeLanguage);
  const partnerTargets = getNormalizedLanguages(partner.targetLanguage);
  
  const partnerCanHelpMeLangs = partnerNatives.filter(lang => myTargets.includes(lang));
  const iCanHelpPartnerLangs = partnerTargets.filter(lang => myNatives.includes(lang));

  const partnerCanHelpMe = partnerCanHelpMeLangs.length > 0;
  const iCanHelpPartner = iCanHelpPartnerLangs.length > 0;
  
  if (partnerCanHelpMe && iCanHelpPartner) {
    return "Best Match";
  } else if (partnerCanHelpMe) {
    const langNames = partner.nativeLanguage 
      ? (Array.isArray(partner.nativeLanguage) ? partner.nativeLanguage : [partner.nativeLanguage])
      : [];
    const matchedNames = langNames.filter(l => myTargets.includes(normalizeLanguage(l)));
    return `Can help with ${matchedNames[0] || 'your target'}`;
  } else if (iCanHelpPartner) {
    const langNames = partner.targetLanguage 
      ? (Array.isArray(partner.targetLanguage) ? partner.targetLanguage : [partner.targetLanguage])
      : [];
    const matchedNames = langNames.filter(l => myNatives.includes(normalizeLanguage(l)));
    return `Wants to learn ${matchedNames[0] || 'your native'}`;
  }
  
  return null;
}
