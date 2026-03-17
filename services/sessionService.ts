import { db } from '../firebase';
import { collection, query, where, getDocs, Timestamp } from "firebase/firestore";

export const getDailyActiveSessions = async (userId: string) => {
    const todayStart = Timestamp.fromDate(new Date(new Date().setHours(0, 0, 0, 0)));

    const chatsQuery = query(
        collection(db, "chats"),
        where("participants", "array-contains", userId)
    );

    const chatSnap = await getDocs(chatsQuery);
    let activeCount = 0;

    for (const chatDoc of chatSnap.docs) {
        const messagesRef = collection(db, "chats", chatDoc.id, "messages");
        const todayMsgQuery = query(
            messagesRef,
            // where("timestamp", ">=", todayStart)
        );

        const msgSnap = await getDocs(todayMsgQuery);
        const messages = msgSnap.docs.map(d => d.data());

        // Check for at least one sent and one received message
        const sent = messages.some(m => m.senderId === userId);
        const received = messages.some(m => m.senderId !== userId);

        if (sent && received) {
            activeCount++;
        }
    }

    return activeCount;
};