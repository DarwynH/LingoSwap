import React, { useState, useEffect } from 'react';
import { UserProfile, QuestData } from '../types';
import LevelBadge from './ui/LevelBadge';
import { getDailyActiveSessions } from '../services/sessionService';
import { getLevelInfo, getOrResetDailyQuests } from '../services/gamificationService';
import { db } from '../firebase';
import { doc, onSnapshot } from 'firebase/firestore';
import { getSessionSecondsFromUserData, getStreakFromUserData } from '../services/progressService';

interface DashboardProps {
  user: UserProfile;
  onLogout: () => void;
  onEditProfile: () => void;
  onNavigateToProgress?: () => void;
}

const Dashboard: React.FC<DashboardProps> = ({ user, onLogout, onEditProfile, onNavigateToProgress }) => {
  const [activeSessions, setActiveSessions] = useState(0);
  const [xp, setXP] = useState(user.xp || 0);
  const [questData, setQuestData] = useState<QuestData | null>(null);
  const [currentStreak, setCurrentStreak] = useState(user.streakCount || 0);
  const [totalSessionSeconds, setTotalSessionSeconds] = useState(0);
  const [statsLoading, setStatsLoading] = useState(true);

  // 2. We removed the fetchSessions logic because we now read chatSessionCount directly from the user document snapshot.

  // 4. Listen to real-time XP and quest changes
  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'users', user.id), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setXP(data.xp || 0);
        setCurrentStreak(getStreakFromUserData(data));
        setTotalSessionSeconds(getSessionSecondsFromUserData(data));
        if (data.questData) {
          setQuestData(data.questData as QuestData);
        }
        setActiveSessions(Number(data.chatSessionCount ?? data.sessionCount ?? data.sessions ?? 0) || 0);
      } else {
        setCurrentStreak(0);
        setTotalSessionSeconds(0);
        setActiveSessions(0);
      }
      setStatsLoading(false);
    });
    return () => unsub();
  }, [user.id]);

  // Initialize quests
  useEffect(() => {
    getOrResetDailyQuests(user.id).then(setQuestData);
  }, [user.id]);

  const totalHours = (totalSessionSeconds / 3600).toFixed(1);
  const totalMinutes = Math.round(totalSessionSeconds / 60);
  const sessionValue = totalSessionSeconds < 3600 ? `${totalMinutes}` : totalHours;
  const sessionUnit = totalSessionSeconds < 3600 ? 'Minutes' : 'Hours';
  const level = getLevelInfo(xp);

  // Stats now use the local 'activeSessions' state
  const stats = {
    hoursThisWeek: sessionValue,
    sessionsCount: activeSessions,
    streak: currentStreak,
  };

  const completedQuests = questData?.quests.filter(q => q.progress >= q.target).length || 0;
  const totalQuests = questData?.quests.length || 0;
  const unclaimedQuests = questData?.quests.filter(q => q.progress >= q.target && !q.claimed).length || 0;

  return (
    <div className="flex-1 flex flex-col h-full bg-surface-main">
      <header className="bg-surface-card border-b border-theme-border p-4 flex justify-between items-center">
        <div>
          <h1 className="text-xl font-extrabold text-theme-text">My Learning</h1>
          <p className="text-xs text-theme-muted">Welcome back, {user.name}!</p>
        </div>
        <div className="flex items-center space-x-3">
          <LevelBadge level={level} size="md" showXP xp={xp} />
        </div>
      </header>

      <div className="p-6 space-y-6 overflow-y-auto">
        {/* Main Stat Card — Language-learning teal */}
        <div
          className="rounded-3xl p-8 text-white shadow-xl relative overflow-hidden transition-transform hover:scale-[1.01]"
          style={{ background: 'linear-gradient(135deg, var(--accent-primary) 0%, #0a7a60 100%)' }}
        >
          <div className="relative z-10">
            <p className="text-white/80 text-sm font-semibold uppercase tracking-widest mb-2">
              Practice Time
            </p>
            <div className="flex items-baseline space-x-2">
              <h2 className="text-6xl font-black tracking-tight">{statsLoading ? '--' : stats.hoursThisWeek}</h2>
              <span className="text-2xl font-bold text-white/80">{sessionUnit}</span>
            </div>
            <p className="mt-4 text-sm text-white/70 font-medium max-w-xs leading-relaxed">
              You've spent {statsLoading ? '…' : `${stats.hoursThisWeek} ${sessionUnit.toLowerCase()}`} practicing {user.targetLanguage}.
              <span className="block mt-1 opacity-80">Keep pushing toward your goal!</span>
            </p>
          </div>
          {/* Background icon */}
          <div className="absolute top-0 right-0 p-8 text-white opacity-10 rotate-12">
            <svg className="w-36 h-36" fill="currentColor" viewBox="0 0 24 24">
              <path d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" />
            </svg>
          </div>
        </div>

        {/* Small Stat Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-surface-card p-5 rounded-2xl shadow-sm border border-theme-border">
            <p className="text-theme-muted text-xs font-bold uppercase tracking-wider mb-1.5">Current Streak</p>
            <div className="flex items-center space-x-2">
              <span className="text-2xl font-black text-orange-500">{statsLoading ? '--' : stats.streak}</span>
              <span className="text-lg">🔥</span>
              <span className="text-sm font-semibold text-theme-muted">days</span>
            </div>
          </div>
          <div className="bg-surface-card p-5 rounded-2xl shadow-sm border border-theme-border">
            <p className="text-theme-muted text-xs font-bold uppercase tracking-wider mb-1.5">Chat Sessions</p>
            <div className="flex items-center space-x-2">
              <span className="text-2xl font-black" style={{ color: 'var(--accent-primary)' }}>{stats.sessionsCount}</span>
              <span className="text-lg">💬</span>
            </div>
          </div>

          <div className="bg-surface-card p-5 rounded-2xl shadow-sm border border-theme-border">
            <p className="text-theme-muted text-xs font-bold uppercase tracking-wider mb-1.5">Total XP</p>
            <div className="flex items-center space-x-2">
              <span className="text-2xl font-black text-emerald-500">{xp}</span>
              <span className="text-lg">⚡</span>
            </div>
            {level.nextThreshold !== null && (
              <div className="mt-2">
                <div className="w-full bg-surface-hover rounded-full h-1.5 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${level.progress}%`, background: 'linear-gradient(90deg, var(--accent-primary), #0bc4a0)' }}
                  />
                </div>
                <p className="text-[10px] text-theme-muted mt-1">{level.nextThreshold - xp} XP to next level</p>
              </div>
            )}
          </div>

          <button
            onClick={onNavigateToProgress}
            className="bg-surface-card p-5 rounded-2xl shadow-sm border border-theme-border text-left hover:border-[var(--accent-amber)]/50 transition-colors group"
          >
            <p className="text-theme-muted text-xs font-bold uppercase tracking-wider mb-1.5">Daily Quests</p>
            <div className="flex items-center space-x-2">
              <span className="text-2xl font-black text-amber-500">{completedQuests}/{totalQuests}</span>
              <span className="text-lg">📋</span>
            </div>
            {unclaimedQuests > 0 && (
              <p className="text-[10px] text-amber-500 font-semibold mt-1 animate-pulse">
                {unclaimedQuests} reward{unclaimedQuests > 1 ? 's' : ''} to claim!
              </p>
            )}
            <p className="text-[10px] text-theme-muted mt-1 group-hover:text-[var(--accent-primary)] transition-colors">
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
                    className={`w-full rounded-t-lg transition-all duration-700 ease-out shadow-sm ${
                      isToday
                       ? 'scale-105'
                       : 'hover:opacity-80'
                    }`}
                    style={{
                      height: `${heightPercentage}%`,
                      background: isToday
                        ? 'linear-gradient(to top, var(--accent-primary), #0bc4a0)'
                        : 'var(--border-color)'
                    }}
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
