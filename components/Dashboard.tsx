import React, { useState, useEffect } from 'react';
import { UserProfile } from '../types';
import Avatar from './ui/Avatar';
import { checkAndUpdateStreak } from '../services/weeklyStreak';
import { getDailyActiveSessions } from '../services/sessionService'; // New import

interface DashboardProps {
  user: UserProfile;
  onLogout: () => void;
  onEditProfile: () => void;
}

const Dashboard: React.FC<DashboardProps> = ({ user, onLogout, onEditProfile }) => {
  const [sessionSeconds, setSessionSeconds] = useState(0);
  const [activeSessions, setActiveSessions] = useState(0); // New state

  // 1. Live Timer for Display
  useEffect(() => {
    const interval = setInterval(() => {
      setSessionSeconds(s => s + 1);
    }, 1000);
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
    hoursThisWeek: totalHours,
    sessionsCount: activeSessions,
    streak: user.streakCount || 0,
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-[#f8fafb]">
      <header className="bg-white border-b border-gray-200 p-4 flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold text-gray-800">Your Progress</h1>
          <p className="text-xs text-gray-500">Welcome back, {user.name}!</p>
        </div>
        <div className="flex items-center space-x-3">
          <button onClick={onEditProfile} className="p-2 text-gray-400 hover:text-[#00a884] transition-colors">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </button>
          <button onClick={onLogout} className="p-2 text-gray-400 hover:text-red-500 transition-colors">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
          </button>
          <Avatar src={user.avatar} size="md" online />
        </div>
      </header>

      <div className="p-6 space-y-6 overflow-y-auto">
        {/* Main Stat Card */}
        <div className="bg-[#00a884] rounded-3xl p-8 text-white shadow-xl relative overflow-hidden">
          <div className="relative z-10">
            <p className="text-[#e7f7f3] text-sm font-medium uppercase tracking-widest mb-2">Practice Time</p>
            <div className="flex items-baseline space-x-2">
              <h2 className="text-6xl font-black">{totalHours}</h2>
              <span className="text-2xl font-bold opacity-80">Hours</span>
            </div>
            <p className="mt-4 text-sm opacity-90">You've spent {totalHours} hours practicing {user.targetLanguage} this week. Keep it up!</p>
          </div>
          <div className="absolute top-0 right-0 p-8 opacity-20">
            <svg className="w-32 h-32" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
        </div>

        {/* Small Stat Grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
            <p className="text-gray-400 text-xs font-bold uppercase tracking-wider mb-1">Current Streak</p>
            <div className="flex items-center space-x-2">
              <span className="text-2xl font-bold text-orange-500">{stats.streak} Days</span>
              <span className="text-xl">🔥</span>
            </div>
          </div>
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
            <p className="text-gray-400 text-xs font-bold uppercase tracking-wider mb-1">Sessions</p>
            <div className="flex items-center space-x-2">
              <span className="text-2xl font-bold text-blue-500">{stats.sessionsCount}</span>
              <span className="text-xl">💬</span>
            </div>
          </div>
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 col-span-2 md:col-span-1">
            <p className="text-gray-400 text-xs font-bold uppercase tracking-wider mb-1">Target</p>
            <div className="flex items-center space-x-2">
              <span className="text-2xl font-bold text-gray-800">{user.targetLanguage}</span>
              <span className="text-xl">🎯</span>
            </div>
          </div>
        </div>

        {/* Daily Activity (Bar Chart) */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <h3 className="font-bold text-gray-800 mb-4">Daily Activity</h3>
          <div className="flex items-end justify-between h-32 px-2">
            {[45, 60, 30, 90, 40, 20, 10].map((h, i) => (
              <div key={i} className="flex flex-col items-center w-8">
                <div
                  className={`w-full rounded-t-lg transition-all duration-500 ${i === 3 ? 'bg-[#00a884]' : 'bg-[#e7f7f3]'}`}
                  style={{ height: `${h}%` }}
                ></div>
                <span className="text-[10px] text-gray-400 mt-2">Day {i + 1}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;