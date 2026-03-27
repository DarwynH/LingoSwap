import { SavedItem, SavedVocabularyItem } from '../types';

/**
 * Calculates a priority score for a learning item using deterministic, rule-based logic.
 * Higher score means the item is more strongly recommended for review today.
 */
export function calculateReviewScore(
  item: SavedItem | SavedVocabularyItem,
  now = Date.now()
): number {
  let score = 0;
  
  // 1. Fresh Items (Never reviewed before)
  if (!item.reviewed && !item.reviewCount) {
    score += 50; 
    
    // Prioritize recently saved unreviewed items to capture immediate memory
    const createdTime = 'timestamp' in item ? item.timestamp : item.createdAt;
    const daysSinceCreated = (now - createdTime) / (1000 * 60 * 60 * 24);
    
    if (daysSinceCreated < 1) score += 30; // Brand new today
    else if (daysSinceCreated < 3) score += 20; 
    else if (daysSinceCreated < 7) score += 10;
  } else {
    // 2. Previously Reviewed Items
    const lastReviewedAt = item.lastReviewedAt || now;
    const daysSinceReview = (now - lastReviewedAt) / (1000 * 60 * 60 * 24);
    
    // Time decay: 10 points per day, cap at 50 points
    score += Math.min(daysSinceReview * 10, 50); 

    // 3. Difficulty Multiplier (Past feedback)
    if (item.difficulty === 'hard') {
      score += 20; // Bumps immediately back into active queue
    } else if (item.difficulty === 'medium') {
      score += 0; // Neutral baseline
    } else if (item.difficulty === 'easy') {
      score -= 20; // Deprioritize significantly, takes longer to reappear
    }

    // 4. Low Review Count Bonus (Still in early learning stages)
    const reviewCount = item.reviewCount || 0;
    if (reviewCount < 3) {
      score += 5; // Slight nudge to review younger cards earlier
    }

    // 5. Forgotten Item Handling
    if (daysSinceReview > 30 && item.difficulty !== 'easy') {
      score += 50; // Massively prioritize forgotten non-easy items
    } else if (daysSinceReview > 60) {
      score += 50; // Even easy items get prioritized after 2 months
    }
  }

  return score;
}

/**
 * Helper to sort an array of items by review score and return the top suggestions.
 */
export function getSuggestedItems<T extends SavedItem | SavedVocabularyItem>(
  items: T[], 
  limit = 20
): T[] {
  const scored = items.map(item => ({
    item,
    score: calculateReviewScore(item)
  }));
  
  // Filter out items with very low scores (e.g., recently reviewed easy items)
  return scored
    .filter(x => x.score > 10)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(x => x.item);
}
