import { db } from '../firebase'; // Ensure this points to your firebase config file
import { doc, getDoc, updateDoc, increment } from "firebase/firestore";

export const checkAndUpdateStreak = async (userId: string, startTime: number) => {
    const now = Date.now();
    const durationInMinutes = (now - startTime) / 1000 / 60;

    // Only proceed if the session was at least 10 minutes
    if (durationInMinutes >= 10) {
        const userRef = doc(db, "users", userId);
        const userSnap = await getDoc(userRef);

        if (userSnap.exists()) {
            const userData = userSnap.data();
            const today = new Date().toDateString(); // e.g., "Sat Mar 14 2026"

            // Check if they haven't already earned their streak point for today
            if (userData.lastStreakUpdate !== today) {
                await updateDoc(userRef, {
                    streakCount: increment(1),
                    lastStreakUpdate: today
                });
                console.log("10 minutes reached! Streak updated.");
            }
        }
    } else {
        console.log(`Session was only ${durationInMinutes.toFixed(1)} minutes. No streak update.`);
    }
};