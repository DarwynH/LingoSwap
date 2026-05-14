import { db } from '../firebase';
import {
  doc,
  getDoc,
  increment,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore';

export type ActivityType =
  | 'messageSent'
  | 'itemSaved'
  | 'reviewCompleted'
  | 'questClaimed';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export function getLocalDateString(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function parseLocalDate(dateString?: string): Date | null {
  if (!dateString) return null;

  const parts = dateString.split('-').map(Number);
  if (parts.length !== 3 || parts.some(Number.isNaN)) return null;

  const [year, month, day] = parts;
  return new Date(year, month - 1, day);
}

function daysBetweenLocalDates(fromDateString: string | undefined, toDateString: string): number | null {
  const from = parseLocalDate(fromDateString);
  const to = parseLocalDate(toDateString);

  if (!from || !to) return null;

  from.setHours(0, 0, 0, 0);
  to.setHours(0, 0, 0, 0);

  return Math.round((to.getTime() - from.getTime()) / MS_PER_DAY);
}

export function getStreakFromUserData(data: Record<string, any> | undefined): number {
  if (!data) return 0;
  return Number(data.currentStreak ?? data.streakCount ?? data.streak ?? 0) || 0;
}

export function getSessionSecondsFromUserData(data: Record<string, any> | undefined): number {
  if (!data) return 0;

  let total = 0;

  const seconds = data.totalSessionSeconds ?? data.activeSeconds;
  if (typeof seconds === 'number') total += Math.max(0, seconds);

  const minutes = data.sessionMinutes ?? data.totalSessionMinutes ?? data.studyMinutes;
  if (typeof minutes === 'number') total += Math.max(0, Math.round(minutes * 60));

  const hours = data.totalStudyHours ?? data.totalStudyTime;
  if (typeof hours === 'number') total += Math.max(0, Math.round(hours * 3600));

  return total;
}

export async function updateDailyStreak(userId: string): Promise<void> {
  const userRef = doc(db, 'users', userId);
  const today = getLocalDateString();

  await runTransaction(db, async (transaction) => {
    const userSnap = await transaction.get(userRef);
    const data = userSnap.exists() ? userSnap.data() : {};
    const previousStreak = getStreakFromUserData(data);
    const lastActiveDate = data.lastActiveDate ?? data.lastStudyDate;

    const updates: Record<string, any> = {
      updatedAt: serverTimestamp(),
    };

    if (lastActiveDate !== today) {
      const dayGap = daysBetweenLocalDates(lastActiveDate, today);
      const nextStreak = dayGap === 1 ? previousStreak + 1 : 1;
      const longestStreak = Math.max(Number(data.longestStreak ?? 0) || 0, nextStreak);

      updates.currentStreak = nextStreak;
      updates.streakCount = nextStreak;
      updates.longestStreak = longestStreak;
      updates.lastActiveDate = today;
    }

    transaction.set(userRef, updates, { merge: true });
  });
}

export async function recordUserActivity(userId: string, _activityType: ActivityType): Promise<void> {
  try {
    await updateDailyStreak(userId);
  } catch (error) {
    console.warn("Failed to record general user activity:", error);
  }
}

export async function recordUserActivityAfterMessage(userId: string, chatId: string): Promise<void> {
  if (!userId || !chatId) return;

  const userRef = doc(db, 'users', userId);
  const today = getLocalDateString();

  try {
    await runTransaction(db, async (transaction) => {
      const userSnap = await transaction.get(userRef);
      const data = userSnap.exists() ? userSnap.data() : {};

      const chatSessions = Number(data.chatSessions ?? data.chatSessionCount ?? data.sessionCount ?? data.sessions ?? 0) || 0;
      const messagedChatIds = Array.isArray(data.messagedChatIds) ? data.messagedChatIds : [];

      const previousStreak = getStreakFromUserData(data);
      const lastActiveDate = data.lastActiveDate ?? data.lastStudyDate;

      const updates: Record<string, any> = {
        updatedAt: serverTimestamp(),
        lastChatActivityAt: serverTimestamp(),
      };

      // 1. Chat Sessions
      if (!messagedChatIds.includes(chatId)) {
        updates.chatSessions = chatSessions + 1;
        updates.chatSessionCount = chatSessions + 1; // Keep backward compat
        updates.messagedChatIds = [...messagedChatIds, chatId];
      }

      // 2. Streak Update
      if (lastActiveDate !== today) {
        const dayGap = daysBetweenLocalDates(lastActiveDate, today);
        const nextStreak = (dayGap === 1) ? previousStreak + 1 : 1;
        const longestStreak = Math.max(Number(data.longestStreak ?? 0) || 0, nextStreak);

        updates.currentStreak = nextStreak;
        updates.streakCount = nextStreak;
        updates.longestStreak = longestStreak;
        updates.lastActiveDate = today;
      }

      transaction.set(userRef, updates, { merge: true });
    });
  } catch (error) {
    console.warn("Failed to record user activity after message:", error);
  }
}

export async function flushSessionTime(userId: string, seconds: number): Promise<void> {
  const roundedSeconds = Math.floor(seconds);
  if (!userId || roundedSeconds <= 0) return;

  const userRef = doc(db, 'users', userId);
  await setDoc(userRef, {
    totalSessionSeconds: increment(roundedSeconds),
    lastSessionUpdatedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  }, { merge: true });
}

export async function markSessionStarted(userId: string): Promise<void> {
  if (!userId) return;

  await setDoc(doc(db, 'users', userId), {
    lastSessionStartedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  }, { merge: true });
}

export async function getUserProgress(userId: string): Promise<{
  currentStreak: number;
  totalSessionSeconds: number;
}> {
  const snap = await getDoc(doc(db, 'users', userId));
  const data = snap.exists() ? snap.data() : {};

  return {
    currentStreak: getStreakFromUserData(data),
    totalSessionSeconds: getSessionSecondsFromUserData(data),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Active-Minutes Session Tracking
//
// Heartbeat runs every 60 seconds while the user is logged in AND the tab is
// visible.  Each tick increments activityMinutesByDate[YYYY-MM-DD] by 1 in
// Firestore using a dot-path-safe merge approach.
// ─────────────────────────────────────────────────────────────────────────────

let _heartbeatInterval: ReturnType<typeof setInterval> | null = null;
let _visibilityHandler: (() => void) | null = null;
let _trackingUserId: string | null = null;

/**
 * Write +1 minute to activityMinutesByDate[today] for the given user.
 * Uses a Firestore updateDoc with a dynamic dot-path key so we never
 * accidentally overwrite the whole map.
 */
async function _tickActiveMinute(userId: string): Promise<void> {
  const today = getLocalDateString();
  const userRef = doc(db, 'users', userId);

  try {
    // Use dot-notation path so Firestore merges into the map field atomically.
    // e.g. { "activityMinutesByDate.2026-05-14": increment(1) }
    await updateDoc(userRef, {
      [`activityMinutesByDate.${today}`]: increment(1),
      lastActivityHeartbeatAt: serverTimestamp(),
      lastActivityDate: today,
    });
  } catch (err: any) {
    // If the document doesn't have activityMinutesByDate yet, updateDoc will
    // succeed anyway because Firestore supports creating nested map entries
    // via dot-path even if the parent map field didn't exist before.
    // But just in case, fall back to setDoc with merge.
    console.warn('[ActivityTracking] updateDoc failed, falling back to setDoc merge:', err?.code);
    try {
      await setDoc(userRef, {
        activityMinutesByDate: { [today]: increment(1) },
        lastActivityHeartbeatAt: serverTimestamp(),
        lastActivityDate: today,
      }, { merge: true });
    } catch (e2) {
      console.warn('[ActivityTracking] setDoc merge also failed:', e2);
    }
  }
}

/**
 * Start the 60-second active-minutes heartbeat for a user.
 * Safe to call multiple times — duplicate calls are ignored if the same userId
 * is already being tracked.
 */
export function startActiveSessionTracking(userId: string): void {
  if (!userId) return;

  // Don't create a duplicate interval if already tracking this user.
  if (_trackingUserId === userId && _heartbeatInterval !== null) return;

  // If switching users, stop the previous tracker first.
  stopActiveSessionTracking();

  _trackingUserId = userId;

  const INTERVAL_MS = 60_000; // 1 minute

  // Tick immediately on start (counts the first minute of the session).
  if (document.visibilityState === 'visible') {
    _tickActiveMinute(userId).catch(() => {});
  }

  // Then tick every 60 seconds while the tab is visible.
  _heartbeatInterval = setInterval(() => {
    if (document.visibilityState === 'visible' && _trackingUserId === userId) {
      _tickActiveMinute(userId).catch(() => {});
    }
  }, INTERVAL_MS);

  // Pause / resume based on tab visibility — don't count hidden time.
  _visibilityHandler = () => {
    // Nothing extra needed; the interval already checks visibilityState.
    // This handler is kept for future use (e.g. resuming from idle).
  };
  document.addEventListener('visibilitychange', _visibilityHandler);
}

/**
 * Stop the active-minutes heartbeat.
 * Called on logout or app unmount.
 */
export function stopActiveSessionTracking(): void {
  if (_heartbeatInterval !== null) {
    clearInterval(_heartbeatInterval);
    _heartbeatInterval = null;
  }
  if (_visibilityHandler !== null) {
    document.removeEventListener('visibilitychange', _visibilityHandler);
    _visibilityHandler = null;
  }
  _trackingUserId = null;
}
