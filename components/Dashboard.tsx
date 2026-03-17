import React, { useState, useEffect } from 'react';
import { UserProfile } from '../types';
import Avatar from './ui/Avatar';
import { checkAndUpdateStreak } from '../services/weeklyStreak';
import { getDailyActiveSessions } from '../services/sessionService'; // New import

interface DashboardProps {
  user: UserProfile;
@@ -9,25 +11,45 @@ interface DashboardProps {
}

const Dashboard: React.FC<DashboardProps> = ({ user, onLogout, onEditProfile }) => {
  
  const [sessionSeconds, setSessionSeconds] = useState(0);
  const [activeSessions, setActiveSessions] = useState(0); // New state

useEffect(() => {
  const interval = setInterval(() => {
    setSessionSeconds(s => s + 1);
  }, 1000);
  // 1. Live Timer for Display
  useEffect(() => {
    const interval = setInterval(() => {
      setSessionSeconds(s => s + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  return () => clearInterval(interval);
}, []);
  // 2. Fetch Active Chat Sessions for the Day
  useEffect(() => {
    const fetchSessions = async () => {
      if (user?.uid) {
        const count = await getDailyActiveSessions(user.uid);
        setActiveSessions(count);
      }
    };
    fetchSessions();
  }, [user?.uid]);

// Convert seconds to hours for your display card
const totalHours = (sessionSeconds / 3600).toFixed(1);
  
  // 3. Streak Trigger on Unmount
  useEffect(() => {
    const startTime = Date.now();
    return () => {
      if (user?.uid) {
        checkAndUpdateStreak(user.uid, startTime);
      }
    };
  }, [user?.uid]);

  const totalHours = (sessionSeconds / 3600).toFixed(1);

  // Stats now use the local 'activeSessions' state
  const stats = {
    hoursThisWeek: 4.5,
    sessionsCount: 12,
    streak: 5,
    wordsLearned: 142
    hoursThisWeek: totalHours,
    sessionsCount: activeSessions,
    streak: user.streakCount || 0,
  };

  return (
@@ -96,17 +118,17 @@ const totalHours = (sessionSeconds / 3600).toFixed(1);
          </div>
        </div>

        {/* Language Details */}
        {/* Daily Activity (Bar Chart) */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <h3 className="font-bold text-gray-800 mb-4">Daily Activity</h3>
          <div className="flex items-end justify-between h-32 px-2">
            {[45, 60, 30, 90, 40, 20, 10].map((h, i) => (
              <div key={i} className="flex flex-col items-center w-8">
                <div 
                  className={`w-full rounded-t-lg transition-all duration-500 ${i === 3 ? 'bg-[#00a884]' : 'bg-[#e7f7f3]'}`} 
                <div
                  className={`w-full rounded-t-lg transition-all duration-500 ${i === 3 ? 'bg-[#00a884]' : 'bg-[#e7f7f3]'}`}
                  style={{ height: `${h}%` }}
                ></div>
                <span className="text-[10px] text-gray-400 mt-2">Day {i+1}</span>
                <span className="text-[10px] text-gray-400 mt-2">Day {i + 1}</span>
              </div>
            ))}
          </div>
@@ -116,4 +138,4 @@ const totalHours = (sessionSeconds / 3600).toFixed(1);
  );
};

export default Dashboard;
export default Dashboard;