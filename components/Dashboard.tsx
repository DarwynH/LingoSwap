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
    <div className="flex-1 flex flex-col h-full bg-surface-main">
      <header className="bg-surface-card border-b border-theme-border p-4 flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold text-theme-text">Your Progress</h1>
          <p className="text-xs text-theme-muted">Welcome back, {user.name}!</p>
        </div>
        <div className="flex items-center space-x-3">
          <button onClick={onEditProfile} className="p-2 text-theme-muted hover:text-[#00a884] transition-colors">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </button>
          <button onClick={onLogout} className="p-2 text-theme-muted hover:text-red-500 transition-colors">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
          </button>
          <Avatar src={user.avatar} size="md" online />
        </div>
      </header>

      <div className="p-6 space-y-6 overflow-y-auto">
        {/* Main Stat Card - Midnight Blue Theme */}
        <div className="bg-[#162b58] rounded-3xl p-8 text-white shadow-xl relative overflow-hidden transition-transform hover:scale-[1.01]">
          <div className="relative z-10">
            <p className="text-blue-100 text-sm font-semibold uppercase tracking-widest mb-2 opacity-80">
              Practice Time
            </p>
            <div className="flex items-baseline space-x-2">
              <h2 className="text-6xl font-black tracking-tight">{totalHours}</h2>
              <span className="text-2xl font-bold text-blue-100">Hours</span>
            </div>
            <p className="mt-4 text-sm text-blue-50 font-medium max-w-xs leading-relaxed">
              You've spent {totalHours} hours practicing {user.targetLanguage} this week.
              <span className="block mt-1 opacity-75">Keep pushing toward your goal!</span>
            </p>
          </div>

          {/* Background Icon - Updated for subtle contrast */}
          <div className="absolute top-0 right-0 p-8 text-white opacity-10 rotate-12">
            <svg className="w-36 h-36" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
        </div>

        {/* Small Stat Grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <div className="bg-surface-card p-6 rounded-2xl shadow-sm border border-theme-border">
            <p className="text-theme-muted text-xs font-bold uppercase tracking-wider mb-1">Current Streak</p>
            <div className="flex items-center space-x-2">
              <span className="text-2xl font-bold text-orange-500">{stats.streak} Days</span>
              <span className="text-xl">🔥</span>
            </div>
          </div>
          <div className="bg-surface-card p-6 rounded-2xl shadow-sm border border-theme-border">
            <p className="text-theme-muted text-xs font-bold uppercase tracking-wider mb-1">Sessions</p>
            <div className="flex items-center space-x-2">
              <span className="text-2xl font-bold text-blue-500">{stats.sessionsCount}</span>
              <span className="text-xl">💬</span>
            </div>
          </div>
        </div>

        {/* Daily Activity (Bar Chart) */}
        <div className="bg-surface-card/50 p-6 rounded-3xl shadow-sm border border-theme-border transition-all hover:shadow-md">
          <div className="flex justify-between items-center mb-6">
            <h3 className="font-bold text-theme-text">Weekly Activity</h3>
            <span className="text-[10px] font-bold text-red bg-surface-hover px-2 py-1 rounded-full uppercase tracking-wider">
              Live Tracking
            </span>
          </div>

          <div className="flex items-end justify-between h-44 px-2 gap-3">
            {/* This now uses your real user data */}
            {(user.dailyStats || [0, 0, 0, 0, 0, 0, 0]).map((minutes, i) => {
              const heightPercentage = Math.max((minutes / 60) * 100, 4);
              const isToday = i === new Date().getDay();

              return (
                <div key={i} className="flex flex-col items-center flex-1 h-full justify-end group relative">
                  <div className="absolute -top-8 opacity-0 group-hover:opacity-100 transition-opacity bg-gray-800 text-white text-[10px] px-2 py-1 rounded pointer-events-none">
                    {Math.round(minutes)}m
                  </div>

                  <div
                    className={`w-full rounded-t-lg transition-all duration-700 ease-out shadow-sm ${isToday
                      ? 'bg-gradient-to-t from-[#a0adc8] to-white scale-105'
                      : 'bg-[#d8dce3] hover:bg-[#a0adc8]'
                      }`}
                    style={{ height: `${heightPercentage}%` }}
                  ></div>

                  <span className={`text-[10px] mt-3 font-bold ${isToday ? 'text-theme-text' : 'text-theme-muted'}`}>
                    {['S', 'M', 'T', 'W', 'T', 'F', 'S'][i]}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;