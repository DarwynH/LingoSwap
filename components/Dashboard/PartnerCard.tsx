
import React from 'react';
import { UserProfile } from '../../types';
import Avatar from '../ui/Avatar';
import LanguageBadge from '../ui/LanguageBadge';
import LevelBadge from '../ui/LevelBadge';
import { getLevelInfo } from '../../services/gamificationService';

interface PartnerCardProps {
  partner: UserProfile;
  onClick: () => void;
}

const PartnerCard: React.FC<PartnerCardProps> = ({ partner, onClick }) => {
  const level = getLevelInfo(partner.xp || 0);

  return (
    <button 
      onClick={onClick}
      className="w-full bg-surface-card p-4 rounded-xl shadow-sm hover:bg-surface-hover backdrop-blur-sm transition-all duration-200 flex items-center space-x-4 text-left border border-theme-border active:scale-[0.98]"
    >
      <Avatar src={partner.avatar} size="lg" online={partner.isOnline} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <h4 className="font-bold text-theme-text truncate">{partner.name}</h4>
          <LevelBadge level={level} size="sm" />
        </div>
        <p className="text-xs text-theme-muted line-clamp-1 mt-0.5">{partner.bio}</p>
        <div className="mt-2 flex flex-wrap gap-2">
          <LanguageBadge language={partner.nativeLanguage} type="native" />
          <LanguageBadge language={partner.targetLanguage} type="learning" />
        </div>
      </div>
    </button>
  );
};

export default PartnerCard;
