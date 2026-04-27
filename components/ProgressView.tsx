// components/ProgressView.tsx
import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, query, orderBy, limit, onSnapshot, doc } from 'firebase/firestore';
import { UserProfile, QuestData, QuestItem } from '../types';
import {
  getLevelInfo,
  getXPRewardInfo,
  getOrResetDailyQuests,
  claimQuestReward,
  LEVELS,
} from '../services/gamificationService';
import LevelBadge from './ui/LevelBadge';
import Avatar from './ui/Avatar';

interface ProgressViewProps {
  user: UserProfile;
}

const ProgressView: React.FC<ProgressViewProps> = ({ user }) => {
  const [xp, setXP] = useState(user.xp || 0);
  const [questData, setQuestData] = useState<QuestData | null>(null);
  const [leaderboard, setLeaderboard] = useState<UserProfile[]>([]);
  const [guideOpen, setGuideOpen] = useState(false);
  const [claiming, setClaiming] = useState<string | null>(null);

  const level = getLevelInfo(xp);
  const xpRewardInfo = getXPRewardInfo();

  // Listen to the user's document for real-time XP & quest updates
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

  // Initialize/reset daily quests on mount
  useEffect(() => {
    getOrResetDailyQuests(user.id).then(setQuestData);
  }, [user.id]);

  // Load leaderboard (top 10 by XP)
  useEffect(() => {
    const q = query(collection(db, 'users'), orderBy('xp', 'desc'), limit(10));
    const unsub = onSnapshot(q, (snapshot) => {
      const users = snapshot.docs
        .map((d) => d.data() as UserProfile)
        .filter((u) => (u.xp || 0) > 0);
      setLeaderboard(users);
    });
    return () => unsub();
  }, []);

  const handleClaim = async (questId: string) => {
    setClaiming(questId);
    await claimQuestReward(user.id, questId);
    // UI updates via the onSnapshot listener
    setTimeout(() => setClaiming(null), 600);
  };

  const completedCount = questData?.quests.filter((q) => q.progress >= q.target).length || 0;
  const totalQuests = questData?.quests.length || 0;

  return (
    <div className="flex-1 flex flex-col h-full bg-surface-main">
      <header className="bg-surface-card border-b border-theme-border p-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-theme-text">Your Progress</h1>
            <p className="text-xs text-theme-muted">Track your XP, level, and daily quests</p>
          </div>
          <LevelBadge level={level} size="md" showXP xp={xp} />
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6">
        {/* ─── Level Card ─────────────────────────────────────────── */}
        <div className="bg-gradient-to-br from-[#162b58] to-[#1a3a6e] rounded-3xl p-6 md:p-8 text-white shadow-xl relative overflow-hidden">
          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-4">
              <span className="text-4xl">{level.icon}</span>
              <div>
                <p className="text-blue-200 text-xs font-bold uppercase tracking-widest opacity-80">Current Level</p>
                <h2 className="text-3xl font-black tracking-tight">{level.name}</h2>
              </div>
            </div>

            <div className="flex items-baseline gap-2 mb-3">
              <span className="text-5xl font-black">{xp}</span>
              <span className="text-xl font-bold text-blue-200">XP</span>
            </div>

            {level.nextThreshold !== null ? (
              <div>
                <div className="flex justify-between text-xs text-blue-200 mb-1.5 font-semibold">
                  <span>{level.threshold} XP</span>
                  <span>{level.nextThreshold} XP</span>
                </div>
                <div className="w-full bg-white/10 rounded-full h-3 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-blue-400 to-emerald-400 rounded-full transition-all duration-700 ease-out"
                    style={{ width: `${level.progress}%` }}
                  />
                </div>
                <p className="text-xs text-blue-100 mt-2 opacity-80">
                  {level.nextThreshold - xp} XP until <strong>{LEVELS[level.index + 1]?.name}</strong>
                </p>
              </div>
            ) : (
              <p className="text-sm text-blue-100 mt-1 font-semibold">🎉 Max level reached!</p>
            )}
          </div>

          {/* Background decorative icon */}
          <div className="absolute top-0 right-0 p-6 text-white opacity-[0.06] rotate-12">
            <svg className="w-40 h-40" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" />
            </svg>
          </div>
        </div>

        {/* ─── Daily Quests Panel ─────────────────────────────────── */}
        <div className="bg-surface-card rounded-2xl border border-theme-border shadow-sm overflow-hidden">
          <div className="p-4 md:p-5 border-b border-theme-border flex items-center justify-between">
            <div>
              <h3 className="font-bold text-theme-text flex items-center gap-2">
                <svg className="w-5 h-5 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                </svg>
                Daily Quests
              </h3>
              <p className="text-xs text-theme-muted mt-0.5">{completedCount}/{totalQuests} completed • Resets at midnight</p>
            </div>
            <span className="bg-amber-500/10 text-amber-600 dark:text-amber-400 text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider border border-amber-500/20">
              Today
            </span>
          </div>

          <div className="divide-y divide-theme-border">
            {questData?.quests.map((quest) => {
              const isComplete = quest.progress >= quest.target;
              const canClaim = isComplete && !quest.claimed;
              const isClaiming = claiming === quest.id;

              return (
                <div key={quest.id} className="p-4 md:px-5 flex items-center gap-4 transition-colors hover:bg-surface-hover/50">
                  {/* Status icon */}
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 transition-all ${
                    quest.claimed
                      ? 'bg-emerald-500/15 text-emerald-500'
                      : isComplete
                        ? 'bg-amber-500/15 text-amber-500 animate-pulse'
                        : 'bg-surface-hover text-theme-muted'
                  }`}>
                    {quest.claimed ? (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (
                      <span className="text-lg font-bold">{quest.progress}/{quest.target}</span>
                    )}
                  </div>

                  {/* Quest info */}
                  <div className="flex-1 min-w-0">
                    <p className={`font-semibold text-sm ${quest.claimed ? 'text-theme-muted line-through' : 'text-theme-text'}`}>
                      {quest.title}
                    </p>
                    <p className="text-xs text-theme-muted">{quest.description}</p>
                    {!quest.claimed && (
                      <div className="mt-1.5 w-full bg-surface-hover rounded-full h-1.5 overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${
                            isComplete ? 'bg-amber-500' : 'bg-[#00a884]'
                          }`}
                          style={{ width: `${Math.min(100, (quest.progress / quest.target) * 100)}%` }}
                        />
                      </div>
                    )}
                  </div>

                  {/* Reward / Claim button */}
                  <div className="flex-shrink-0">
                    {quest.claimed ? (
                      <span className="text-xs font-bold text-emerald-500 bg-emerald-500/10 px-2.5 py-1 rounded-lg">
                        +{quest.reward} XP ✓
                      </span>
                    ) : canClaim ? (
                      <button
                        onClick={() => handleClaim(quest.id)}
                        disabled={!!isClaiming}
                        className={`text-xs font-bold px-3 py-1.5 rounded-lg transition-all active:scale-95 ${
                          isClaiming
                            ? 'bg-emerald-500 text-white scale-95'
                            : 'bg-[#00a884] hover:bg-[#008f70] text-white shadow-sm'
                        }`}
                      >
                        {isClaiming ? '✓ Claimed!' : `Claim +${quest.reward} XP`}
                      </button>
                    ) : (
                      <span className="text-xs font-semibold text-theme-muted bg-surface-hover px-2.5 py-1 rounded-lg">
                        +{quest.reward} XP
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ─── XP Guide ──────────────────────────────────────────── */}
        <div className="bg-surface-card rounded-2xl border border-theme-border shadow-sm overflow-hidden">
          <button
            onClick={() => setGuideOpen(!guideOpen)}
            className="w-full p-4 md:p-5 flex items-center justify-between text-left hover:bg-surface-hover/50 transition-colors"
          >
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <h3 className="font-bold text-theme-text">How to Earn XP</h3>
            </div>
            <svg className={`w-5 h-5 text-theme-muted transition-transform duration-200 ${guideOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {guideOpen && (
            <div className="px-4 md:px-5 pb-5 space-y-4">
              {/* XP actions table */}
              <div className="space-y-2">
                {xpRewardInfo.map((item, i) => (
                  <div key={i} className="flex items-center justify-between py-2 px-3 bg-surface-hover/50 rounded-xl">
                    <div>
                      <p className="text-sm font-semibold text-theme-text">{item.action}</p>
                      <p className="text-xs text-theme-muted">{item.description}</p>
                    </div>
                    <span className="text-sm font-bold text-[#00a884] bg-[#00a884]/10 px-2 py-0.5 rounded-md">
                      +{item.xp} XP
                    </span>
                  </div>
                ))}
              </div>

              {/* Level roadmap */}
              <div className="mt-4 pt-4 border-t border-theme-border">
                <h4 className="text-xs font-bold text-theme-muted uppercase tracking-widest mb-3">Level Roadmap</h4>
                <div className="space-y-2">
                  {LEVELS.map((lvl, i) => {
                    const isCurrentLevel = level.index === i;
                    const isPast = level.index > i;
                    return (
                      <div
                        key={lvl.name}
                        className={`flex items-center justify-between py-2 px-3 rounded-xl transition-colors ${
                          isCurrentLevel ? 'bg-[#00a884]/10 border border-[#00a884]/30' : 'bg-surface-hover/30'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-lg">{lvl.icon}</span>
                          <span className={`text-sm font-semibold ${isCurrentLevel ? 'text-[#00a884]' : isPast ? 'text-theme-muted' : 'text-theme-text'}`}>
                            {lvl.name}
                          </span>
                          {isCurrentLevel && (
                            <span className="text-[9px] font-bold text-[#00a884] uppercase tracking-wider bg-[#00a884]/10 px-1.5 py-0.5 rounded">You</span>
                          )}
                          {isPast && (
                            <svg className="w-4 h-4 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                        </div>
                        <span className="text-xs text-theme-muted font-semibold">{lvl.threshold} XP</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Anti-spam note */}
              <div className="bg-blue-500/5 border border-blue-500/20 rounded-xl p-3 mt-3">
                <p className="text-xs text-blue-600 dark:text-blue-400 font-medium leading-relaxed">
                  <strong>Note:</strong> Message XP is capped at 100 XP per day to encourage genuine conversation. 
                  Daily quests reset at midnight. All features remain unlocked regardless of level.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* ─── Leaderboard ───────────────────────────────────────── */}
        <div className="bg-surface-card rounded-2xl border border-theme-border shadow-sm overflow-hidden">
          <div className="p-4 md:p-5 border-b border-theme-border flex items-center justify-between">
            <h3 className="font-bold text-theme-text flex items-center gap-2">
              <svg className="w-5 h-5 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
              </svg>
              Top Learners
            </h3>
            <span className="text-[10px] font-bold text-theme-muted bg-surface-hover px-2 py-1 rounded-full uppercase tracking-wider">
              All Time
            </span>
          </div>

          <div className="divide-y divide-theme-border">
            {leaderboard.length === 0 ? (
              <div className="p-8 text-center">
                <p className="text-theme-muted text-sm">No learners on the board yet. Start earning XP!</p>
              </div>
            ) : (
              leaderboard.map((u, i) => {
                const rank = i + 1;
                const uLevel = getLevelInfo(u.xp || 0);
                const isCurrentUser = u.id === user.id;
                const medals = ['🥇', '🥈', '🥉'];

                return (
                  <div
                    key={u.id}
                    className={`p-3 md:px-5 flex items-center gap-3 transition-colors ${
                      isCurrentUser ? 'bg-[#00a884]/5' : 'hover:bg-surface-hover/50'
                    }`}
                  >
                    {/* Rank */}
                    <div className="w-8 text-center flex-shrink-0">
                      {rank <= 3 ? (
                        <span className="text-xl">{medals[rank - 1]}</span>
                      ) : (
                        <span className="text-sm font-bold text-theme-muted">#{rank}</span>
                      )}
                    </div>

                    {/* Avatar */}
                    <Avatar src={u.avatar} size="sm" />

                    {/* Name + Level */}
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-semibold truncate ${isCurrentUser ? 'text-[#00a884]' : 'text-theme-text'}`}>
                        {u.name}
                        {isCurrentUser && <span className="text-xs ml-1 opacity-70">(you)</span>}
                      </p>
                      <LevelBadge level={uLevel} size="sm" />
                    </div>

                    {/* XP */}
                    <div className="flex-shrink-0 text-right">
                      <p className="text-sm font-bold text-theme-text">{(u.xp || 0).toLocaleString()}</p>
                      <p className="text-[10px] text-theme-muted font-semibold uppercase">XP</p>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Bottom spacer */}
        <div className="h-4" />
      </div>
    </div>
  );
};

export default ProgressView;
