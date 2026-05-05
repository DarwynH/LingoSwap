import { addXP } from './gamificationService';
import { updateDailyStreak } from './progressService';

export const checkAndUpdateStreak = async (userId: string, startTime: number) => {
    const now = Date.now();
    const durationInMinutes = (now - startTime) / 1000 / 60;

    // Only proceed if the session was at least 10 minutes
    if (durationInMinutes >= 10) {
        await updateDailyStreak(userId);
        // Gamification: award XP for daily login streak
        addXP(userId, 'dailyLogin');
        console.log("10 minutes reached! Streak updated.");
    } else {
        console.log(`Session was only ${durationInMinutes.toFixed(1)} minutes. No streak update.`);
    }
};
