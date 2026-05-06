
import React from 'react';
import { UserProfile } from '../../types';
import Avatar from '../ui/Avatar';
import LanguageBadge from '../ui/LanguageBadge';
import LevelBadge from '../ui/LevelBadge';
import { getLevelInfo } from '../../services/gamificationService';
import { isRecentlyOnline } from '../../utils/presenceUtils';

interface PartnerCardProps {
  partner: UserProfile;
  matchBadge?: string | null;
  onClick: () => void;
}

const PartnerCard: React.FC<PartnerCardProps> = ({ partner, matchBadge, onClick }) => {
  const level = getLevelInfo(partner.xp || 0);
  const online = isRecentlyOnline(partner.isOnline, partner.lastSeen);

  return (
    <button
      onClick={onClick}
      className="w-full text-left border border-theme-border rounded-2xl p-4 transition-all duration-200 hover:scale-[1.01] active:scale-[0.98] shadow-sm group"
      style={{
        background: 'var(--bg-surface)',
        borderColor: 'var(--border-color)',
      }}
      onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--accent-primary)')}
      onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border-color)')}
    >
      <div className="flex items-start space-x-3">
        <div className="relative flex-shrink-0">
          <Avatar src={partner.avatar} size="lg" online={online} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h4 className="font-bold text-theme-text truncate">{partner.name}</h4>
            <LevelBadge level={level} size="sm" />
            {online && (
              <span
                className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                style={{ background: 'rgba(16,185,129,0.12)', color: '#10b981' }}
              >
                Online
              </span>
            )}
            {matchBadge && (
              <span
                className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                style={{ 
                  background: matchBadge === 'Best Match' ? 'var(--accent-primary-muted)' : 'rgba(139, 92, 246, 0.1)', 
                  color: matchBadge === 'Best Match' ? 'var(--accent-primary)' : '#8b5cf6' 
                }}
              >
                {matchBadge === 'Best Match' ? '✨ Best Match' : matchBadge}
              </span>
            )}
          </div>
          {partner.bio && (
            <p className="text-xs text-theme-muted line-clamp-2 mt-0.5 leading-relaxed">{partner.bio}</p>
          )}
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            <LanguageBadge language={partner.nativeLanguage} type="native" />
            <LanguageBadge language={partner.targetLanguage} type="learning" />
          </div>
        </div>
      </div>

      {/* Chat CTA on hover */}
      <div
        className="mt-3 w-full py-1.5 rounded-lg text-xs font-semibold text-center opacity-0 group-hover:opacity-100 transition-opacity"
        style={{ background: 'var(--accent-primary-muted)', color: 'var(--accent-primary)' }}
      >
        Start Conversation →
      </div>
    </button>
  );
};

export default PartnerCard;
