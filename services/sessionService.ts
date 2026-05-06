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
    if (!userId || !chatId) return;

    const userRef = doc(db, 'users', userId);
    
    try {
        await runTransaction(db, async (transaction) => {
            const userSnap = await transaction.get(userRef);
            if (!userSnap.exists()) return;

            const data = userSnap.data();
            const messagedChatIds = Array.isArray(data.messagedChatIds) ? data.messagedChatIds : [];
            
            const updates: Record<string, any> = {
                lastChatActivityAt: serverTimestamp(),
                updatedAt: serverTimestamp()
            };

            // Start a new session only if the user hasn't messaged in this chat before
            if (!messagedChatIds.includes(chatId)) {
                updates.chatSessionCount = (Number(data.chatSessionCount ?? data.sessionCount ?? data.sessions ?? 0) || 0) + 1;
                updates.messagedChatIds = [...messagedChatIds, chatId];
            }

            transaction.set(userRef, updates, { merge: true });
        });
    } catch (error) {
        console.warn("Failed to record chat activity:", error);
    }
};