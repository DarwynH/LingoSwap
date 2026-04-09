import { db } from '../firebase';
import { collection, query, getDocs, where } from "firebase/firestore";

export const getDailyActiveSessions = async (userId: string) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // 1. Get chats where you are a participant
    const chatsRef = collection(db, "chats");
    const q = query(chatsRef, where("participants", "array-contains", userId));
    const chatSnap = await getDocs(q);

    let activeCount = 0;

    for (const chatDoc of chatSnap.docs) {
        const messagesRef = collection(db, "chats", chatDoc.id, "messages");
        const msgSnap = await getDocs(messagesRef);

        const messages = msgSnap.docs.map(d => d.data());

        // 2. Filter for today's messages & check back-and-forth
        const todayMsgs = messages.filter(m => {
            const msgDate = m.timestamp?.toDate ? m.timestamp.toDate() : new Date(m.timestamp);
            return msgDate >= today;
        });

        const sent = todayMsgs.some(m => m.senderId === userId);
        const received = todayMsgs.some(m => m.senderId !== userId);

        if (sent && received) activeCount++;
    }
    return activeCount;
};