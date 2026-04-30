import React, { useState, useEffect } from 'react';
import { UserProfile, QuestData } from '../types';
import Avatar from './ui/Avatar';
import LevelBadge from './ui/LevelBadge';
import { checkAndUpdateStreak } from '../services/weeklyStreak';
import { getDailyActiveSessions } from '../services/sessionService';
import { getLevelInfo, getOrResetDailyQuests } from '../services/gamificationService';
import { db } from '../firebase';
import { doc, onSnapshot } from 'firebase/firestore';

interface DashboardProps {
  user: UserProfile;
  onLogout: () => void;
  onEditProfile: () => void;
  onNavigateToProgress?: () => void;
}

const Dashboard: React.FC<DashboardProps> = ({ user, onLogout, onEditProfile, onNavigateToProgress }) => {
  const [sessionSeconds, setSessionSeconds] = useState(0);
  const [activeSessions, setActiveSessions] = useState(0);
  const [xp, setXP] = useState(user.xp || 0);
  const [questData, setQuestData] = useState<QuestData | null>(null);

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

  // 4. Listen to real-time XP and quest changes
  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'users', user.id), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setXP(data.xp || 0);
        if (data.questData) {
          setQuestData(data.questData as QuestData);
        }
      }
    });
    return () => unsub();
  }, [user.id]);

  // Initialize quests
  useEffect(() => {
    getOrResetDailyQuests(user.id).then(setQuestData);
  }, [user.id]);

  const totalHours = (sessionSeconds / 3600).toFixed(1);
  const level = getLevelInfo(xp);

  // Stats now use the local 'activeSessions' state
  const stats = {
    hoursThisWeek: totalHours,
    sessionsCount: activeSessions,
    streak: user.streakCount || 0,
  };

  const completedQuests = questData?.quests.filter(q => q.progress >= q.target).length || 0;
  const totalQuests = questData?.quests.length || 0;
  const unclaimedQuests = questData?.quests.filter(q => q.progress >= q.target && !q.claimed).length || 0;

  return (
    <div className="flex-1 flex flex-col h-full bg-surface-main">
      <header className="bg-surface-card border-b border-theme-border p-4 flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold text-theme-text">Your Progress</h1>
          <p className="text-xs text-theme-muted">Welcome back, {user.name}!</p>
        </div>
        <div className="flex items-center space-x-3">
          <LevelBadge level={level} size="md" showXP xp={xp} />
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
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
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

          {/* XP Card */}
          <div className="bg-surface-card p-6 rounded-2xl shadow-sm border border-theme-border">
            <p className="text-theme-muted text-xs font-bold uppercase tracking-wider mb-1">Total XP</p>
            <div className="flex items-center space-x-2">
              <span className="text-2xl font-bold text-emerald-500">{xp}</span>
              <span className="text-xl">⚡</span>
            </div>
            {level.nextThreshold !== null && (
              <div className="mt-2">
                <div className="w-full bg-surface-hover rounded-full h-1.5 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 rounded-full transition-all duration-500"
                    style={{ width: `${level.progress}%` }}
                  />
                </div>
                <p className="text-[10px] text-theme-muted mt-1">{level.nextThreshold - xp} XP to next level</p>
              </div>
            )}
          </div>

          {/* Daily Quests Summary */}
          <button
            onClick={onNavigateToProgress}
            className="bg-surface-card p-6 rounded-2xl shadow-sm border border-theme-border text-left hover:border-amber-500/30 transition-colors group"
          >
            <p className="text-theme-muted text-xs font-bold uppercase tracking-wider mb-1">Daily Quests</p>
            <div className="flex items-center space-x-2">
              <span className="text-2xl font-bold text-amber-500">{completedQuests}/{totalQuests}</span>
              <span className="text-xl">📋</span>
            </div>
            {unclaimedQuests > 0 && (
              <p className="text-[10px] text-amber-500 font-semibold mt-1 animate-pulse">
                {unclaimedQuests} reward{unclaimedQuests > 1 ? 's' : ''} to claim!
              </p>
            )}
            <p className="text-[10px] text-theme-muted mt-1 group-hover:text-[#00a884] transition-colors">
              View Progress →
            </p>
          </button>
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