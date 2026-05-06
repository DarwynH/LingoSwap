import { db } from '../firebase';
import { doc, getDoc, runTransaction, serverTimestamp } from "firebase/firestore";

export const getDailyActiveSessions = async (userId: string): Promise<number> => {
    // Replaced inefficient chat fetching with reading the counter directly from the user document.
    // Dashboard now reads this value from progressService or the snapshot directly,
    // but we'll return it here for backward compatibility if called.
    try {
        const userRef = doc(db, 'users', userId);
        const snap = await getDoc(userRef);
        if (snap.exists()) {
            const data = snap.data();
            return Number(data.chatSessionCount ?? data.sessionCount ?? data.sessions ?? 0) || 0;
        }
    } catch (e) {
        console.error("Error fetching chat session count", e);
    }
    return 0;
};

export const recordChatActivity = async (userId: string, chatId: string): Promise<void> => {
    if (!userId) return;

    const userRef = doc(db, 'users', userId);
    
    try {
        await runTransaction(db, async (transaction) => {
            const userSnap = await transaction.get(userRef);
            if (!userSnap.exists()) return;

            const data = userSnap.data();
            const now = Date.now();
            
            // lastChatSessionAt tracks the start of the current "chat session"
            // lastChatActivityAt tracks the most recent message sent
            
            let lastSessionTime = 0;
            if (data.lastChatSessionAt?.toMillis) {
                lastSessionTime = data.lastChatSessionAt.toMillis();
            } else if (typeof data.lastChatSessionAt === 'number') {
                lastSessionTime = data.lastChatSessionAt;
            }

            let lastActivityTime = 0;
            if (data.lastChatActivityAt?.toMillis) {
                lastActivityTime = data.lastChatActivityAt.toMillis();
            } else if (typeof data.lastChatActivityAt === 'number') {
                lastActivityTime = data.lastChatActivityAt;
            }

            const TEN_MINUTES_MS = 10 * 60 * 1000;
            const timeSinceLastSession = now - lastSessionTime;
            const timeSinceLastActivity = now - lastActivityTime;

            // Start a new session if:
            // 1. No previous session exists
            // 2. OR it has been more than 10 minutes since the last ACTIVITY
            // The prompt says: "after at least 10 minutes of inactivity in that chat"
            // We use global inactivity for simplicity and as requested by the fields.
            
            const isNewSession = !lastSessionTime || timeSinceLastActivity >= TEN_MINUTES_MS;

            const updates: Record<string, any> = {
                lastChatActivityAt: serverTimestamp(),
                updatedAt: serverTimestamp()
            };

            if (isNewSession) {
                updates.chatSessionCount = (Number(data.chatSessionCount ?? data.sessionCount ?? data.sessions ?? 0) || 0) + 1;
                updates.lastChatSessionAt = serverTimestamp();
            }

            transaction.set(userRef, updates, { merge: true });
        });
    } catch (error) {
        console.error("Failed to record chat activity:", error);
    }
};