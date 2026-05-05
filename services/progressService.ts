import { db } from '../firebase';
import {
  doc,
  getDoc,
  increment,
  runTransaction,
  serverTimestamp,
  setDoc,
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
  return Number(data.currentStreak ?? data.streak ?? data.streakCount ?? 0) || 0;
}

export function getSessionSecondsFromUserData(data: Record<string, any> | undefined): number {
  if (!data) return 0;

  const seconds = data.totalSessionSeconds ?? data.activeSeconds;
  if (typeof seconds === 'number') return Math.max(0, seconds);

  const minutes = data.sessionMinutes ?? data.totalSessionMinutes ?? data.studyMinutes;
  if (typeof minutes === 'number') return Math.max(0, Math.round(minutes * 60));

  const hours = data.totalStudyHours ?? data.totalStudyTime;
  if (typeof hours === 'number') return Math.max(0, Math.round(hours * 3600));

  return 0;
}

export async function updateDailyStreak(userId: string): Promise<void> {
  const userRef = doc(db, 'users', userId);
  const today = getLocalDateString();

  await runTransaction(db, async (transaction) => {
    const userSnap = await transaction.get(userRef);
    const data = userSnap.exists() ? userSnap.data() : {};
    const previousStreak = getStreakFromUserData(data);
    const lastActiveDate = data.lastActiveDate || data.lastStudyDate;

    if (lastActiveDate === today) {
      transaction.set(userRef, { updatedAt: serverTimestamp() }, { merge: true });
      return;
    }

    const dayGap = daysBetweenLocalDates(lastActiveDate, today);
    const nextStreak = dayGap === 1 ? previousStreak + 1 : 1;
    const longestStreak = Math.max(Number(data.longestStreak ?? 0) || 0, nextStreak);

    transaction.set(userRef, {
      currentStreak: nextStreak,
      streakCount: nextStreak,
      longestStreak,
      lastActiveDate: today,
      updatedAt: serverTimestamp(),
    }, { merge: true });
  });
}

export async function recordUserActivity(userId: string, _activityType: ActivityType): Promise<void> {
  await updateDailyStreak(userId);
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
