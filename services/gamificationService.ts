// services/gamificationService.ts
// Pure, deterministic gamification logic — no AI, no randomness

import { db } from '../firebase';
import { doc, getDoc, updateDoc, increment, setDoc } from 'firebase/firestore';
import { XPActionType, QuestItem, QuestData, LevelInfo } from '../types';

// ─── XP Reward Table ───────────────────────────────────────────────
export const XP_REWARDS: Record<XPActionType, number> = {
  messageSent: 2,
  replySent: 3,
  itemSaved: 5,
  profileCompleted: 20,
  dailyLogin: 10,
  questClaimed: 0, // quest rewards are defined per-quest
};

// Daily XP cap for message-based actions (prevents spam)
const MESSAGE_XP_DAILY_CAP = 100;

// ─── Level System ──────────────────────────────────────────────────
export const LEVELS = [
  { name: 'Rookie',            threshold: 0,    icon: '🌱' },
  { name: 'Beginner',          threshold: 50,   icon: '📗' },
  { name: 'Explorer',          threshold: 150,  icon: '🧭' },
  { name: 'Conversationalist', threshold: 350,  icon: '💬' },
  { name: 'Communicator',      threshold: 600,  icon: '🌟' },
  { name: 'Fluent',            threshold: 1000, icon: '🏆' },
];

/** Pure function — calculates level info from XP amount */
export function getLevelInfo(xp: number): LevelInfo {
  let levelIndex = 0;
  for (let i = LEVELS.length - 1; i >= 0; i--) {
    if (xp >= LEVELS[i].threshold) {
      levelIndex = i;
      break;
    }
  }

  const current = LEVELS[levelIndex];
  const next = LEVELS[levelIndex + 1] || null;
  const progress = next
    ? Math.min(100, Math.round(((xp - current.threshold) / (next.threshold - current.threshold)) * 100))
    : 100;

  return {
    name: current.name,
    index: levelIndex,
    threshold: current.threshold,
    nextThreshold: next ? next.threshold : null,
    progress,
    icon: current.icon,
  };
}

/** Returns the XP reward table for the guide UI */
export function getXPRewardInfo() {
  return [
    { action: 'Send a message', xp: XP_REWARDS.messageSent, description: 'Each message in a conversation' },
    { action: 'Send a reply', xp: XP_REWARDS.replySent, description: 'Reply to a specific message' },
    { action: 'Save a study item', xp: XP_REWARDS.itemSaved, description: 'Save to phrasebook or study later' },
    { action: 'Daily login streak', xp: XP_REWARDS.dailyLogin, description: '10+ minutes of active use' },
    { action: 'Complete profile', xp: XP_REWARDS.profileCompleted, description: 'One-time bonus on profile setup' },
    { action: 'Claim daily quest', xp: 10, description: 'Bonus XP per completed quest' },
  ];
}

// ─── XP Award Logic ────────────────────────────────────────────────

/** Award XP for a user action with daily cap for messages */
export async function addXP(userId: string, action: XPActionType): Promise<void> {
  try {
    const amount = XP_REWARDS[action];
    if (amount <= 0) return;

    const userRef = doc(db, 'users', userId);

    // For message actions, enforce daily cap
    if (action === 'messageSent' || action === 'replySent') {
      const userSnap = await getDoc(userRef);
      if (userSnap.exists()) {
        const data = userSnap.data();
        const today = new Date().toDateString();
        const dailyMsgXP = data._dailyMsgXPDate === today ? (data._dailyMsgXP || 0) : 0;

        if (dailyMsgXP >= MESSAGE_XP_DAILY_CAP) return; // cap reached

        await updateDoc(userRef, {
          xp: increment(amount),
          _dailyMsgXP: dailyMsgXP + amount,
          _dailyMsgXPDate: today,
        });
      }
    } else {
      await updateDoc(userRef, { xp: increment(amount) });
    }
  } catch (e) {
    console.warn('addXP failed:', e);
  }
}

// ─── Batched Action Recorder ───────────────────────────────────────
// Combines XP award(s) + quest progress into a single read→write cycle
// to prevent concurrent fire-and-forget calls from overwriting each other.

export interface ActionRecord {
  xpAction: XPActionType;
  questUpdates?: { questId: string; amount: number }[];
}

/**
 * Record one or more gamification actions atomically.
 * Reads the user doc once, computes all XP and quest changes, then writes
 * everything in a single updateDoc call.
 */
export async function recordActions(userId: string, actions: ActionRecord[]): Promise<void> {
  if (actions.length === 0) return;

  try {
    const userRef = doc(db, 'users', userId);
    const userSnap = await getDoc(userRef);
    if (!userSnap.exists()) return;

    const data = userSnap.data();
    const today = new Date().toDateString();

    // ── Compute total XP to add ──
    let totalXP = 0;
    let msgXPAdded = 0;
    const currentDailyMsgXP = data._dailyMsgXPDate === today ? (data._dailyMsgXP || 0) : 0;

    for (const action of actions) {
      const amount = XP_REWARDS[action.xpAction];
      if (amount <= 0) continue;

      if (action.xpAction === 'messageSent' || action.xpAction === 'replySent') {
        if (currentDailyMsgXP + msgXPAdded >= MESSAGE_XP_DAILY_CAP) continue;
        const allowed = Math.min(amount, MESSAGE_XP_DAILY_CAP - currentDailyMsgXP - msgXPAdded);
        totalXP += allowed;
        msgXPAdded += allowed;
      } else {
        totalXP += amount;
      }
    }

    // ── Compute quest progress updates ──
    const questData = data.questData as QuestData | undefined;
    let updatedQuestData = questData;

    if (questData && questData.date === today) {
      // Collect all quest increments
      const questIncrements: Record<string, number> = {};
      for (const action of actions) {
        if (action.questUpdates) {
          for (const qu of action.questUpdates) {
            questIncrements[qu.questId] = (questIncrements[qu.questId] || 0) + qu.amount;
          }
        }
      }

      if (Object.keys(questIncrements).length > 0) {
        const updatedQuests = questData.quests.map(q => {
          if (questIncrements[q.id] && !q.claimed) {
            return { ...q, progress: Math.min(q.progress + questIncrements[q.id], q.target) };
          }
          return q;
        });
        updatedQuestData = { ...questData, quests: updatedQuests };
      }
    }

    // ── Single atomic write ──
    const updatePayload: Record<string, any> = {};

    if (totalXP > 0) {
      updatePayload.xp = increment(totalXP);
    }

    if (msgXPAdded > 0) {
      updatePayload._dailyMsgXP = currentDailyMsgXP + msgXPAdded;
      updatePayload._dailyMsgXPDate = today;
    }

    if (updatedQuestData && updatedQuestData !== questData) {
      updatePayload.questData = updatedQuestData;
    }

    if (Object.keys(updatePayload).length > 0) {
      await updateDoc(userRef, updatePayload);
    }
  } catch (e) {
    console.warn('recordActions failed:', e);
  }
}

// ─── Daily Quest System ────────────────────────────────────────────

/** Template for daily quests — reused each day */
function createDailyQuests(): QuestItem[] {
  return [
    {
      id: 'send_messages',
      title: 'Active Chatter',
      description: 'Send 5 messages today',
      target: 5,
      progress: 0,
      reward: 15,
      claimed: false,
    },
    {
      id: 'save_item',
      title: 'Study Saver',
      description: 'Save 1 study item today',
      target: 1,
      progress: 0,
      reward: 10,
      claimed: false,
    },
    {
      id: 'start_conversation',
      title: 'Conversation Starter',
      description: 'Start or continue a conversation',
      target: 1,
      progress: 0,
      reward: 10,
      claimed: false,
    },
    {
      id: 'send_reply',
      title: 'Thoughtful Reply',
      description: 'Reply to a message',
      target: 1,
      progress: 0,
      reward: 10,
      claimed: false,
    },
  ];
}

/** Read quests from Firestore, reset if it's a new day */
export async function getOrResetDailyQuests(userId: string): Promise<QuestData> {
  const userRef = doc(db, 'users', userId);
  const today = new Date().toDateString();

  try {
    const userSnap = await getDoc(userRef);
    if (userSnap.exists()) {
      const data = userSnap.data();
      const questData = data.questData as QuestData | undefined;

      if (questData && questData.date === today) {
        return questData;
      }
    }

    // New day or no quest data — create fresh quests
    const freshData: QuestData = {
      date: today,
      quests: createDailyQuests(),
    };
    await updateDoc(userRef, { questData: freshData });
    return freshData;

  } catch (e) {
    console.warn('getOrResetDailyQuests failed:', e);
    return { date: today, quests: createDailyQuests() };
  }
}

/** Increment quest progress for a specific quest */
export async function updateQuestProgress(userId: string, questId: string, amount: number = 1): Promise<void> {
  try {
    const userRef = doc(db, 'users', userId);
    const userSnap = await getDoc(userRef);
    if (!userSnap.exists()) return;

    const data = userSnap.data();
    const questData = data.questData as QuestData | undefined;
    const today = new Date().toDateString();

    if (!questData || questData.date !== today) return; // stale, will reset on next read

    const updatedQuests = questData.quests.map(q => {
      if (q.id === questId && !q.claimed) {
        return { ...q, progress: Math.min(q.progress + amount, q.target) };
      }
      return q;
    });

    await updateDoc(userRef, {
      questData: { ...questData, quests: updatedQuests },
    });
  } catch (e) {
    console.warn('updateQuestProgress failed:', e);
  }
}

/** Claim a completed quest reward — awards bonus XP */
export async function claimQuestReward(userId: string, questId: string): Promise<boolean> {
  try {
    const userRef = doc(db, 'users', userId);
    const userSnap = await getDoc(userRef);
    if (!userSnap.exists()) return false;

    const data = userSnap.data();
    const questData = data.questData as QuestData | undefined;
    if (!questData) return false;

    const quest = questData.quests.find(q => q.id === questId);
    if (!quest || quest.claimed || quest.progress < quest.target) return false;

    const updatedQuests = questData.quests.map(q =>
      q.id === questId ? { ...q, claimed: true } : q
    );

    await updateDoc(userRef, {
      xp: increment(quest.reward),
      questData: {
        ...questData,
        quests: updatedQuests,
        lastClaimedAt: Date.now(),
      },
    });

    return true;
  } catch (e) {
    console.warn('claimQuestReward failed:', e);
    return false;
  }
}
