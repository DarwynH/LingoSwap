// components/ui/LevelBadge.tsx
import React from 'react';
import { LevelInfo } from '../../types';

interface LevelBadgeProps {
  level: LevelInfo;
  size?: 'sm' | 'md' | 'lg';
  showXP?: boolean;
  xp?: number;
}

const LEVEL_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  Rookie:            { bg: 'bg-slate-500/15', text: 'text-slate-400', border: 'border-slate-500/30' },
  Beginner:          { bg: 'bg-teal-500/15',  text: 'text-teal-400',  border: 'border-teal-500/30' },
  Explorer:          { bg: 'bg-blue-500/15',  text: 'text-blue-400',  border: 'border-blue-500/30' },
  Conversationalist: { bg: 'bg-violet-500/15', text: 'text-violet-400', border: 'border-violet-500/30' },
  Communicator:      { bg: 'bg-amber-500/15', text: 'text-amber-400', border: 'border-amber-500/30' },
  Fluent:            { bg: 'bg-yellow-500/15', text: 'text-yellow-400', border: 'border-yellow-500/30' },
};

const LevelBadge: React.FC<LevelBadgeProps> = ({ level, size = 'sm', showXP = false, xp }) => {
  const colors = LEVEL_COLORS[level.name] || LEVEL_COLORS.Rookie;

  const sizeClasses = {
    sm: 'text-[10px] px-2 py-0.5 gap-1',
    md: 'text-xs px-2.5 py-1 gap-1.5',
    lg: 'text-sm px-3 py-1.5 gap-2',
  };

  return (
    <span
      className={`inline-flex items-center font-bold rounded-full border ${colors.bg} ${colors.text} ${colors.border} ${sizeClasses[size]} whitespace-nowrap`}
    >
      <span>{level.icon}</span>
      <span>{level.name}</span>
      {showXP && xp !== undefined && (
        <span className="opacity-70 font-semibold">• {xp} XP</span>
      )}
    </span>
  );
};

export default LevelBadge;
