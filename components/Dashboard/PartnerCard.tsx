
import React from 'react';
import { UserProfile } from '../../types';
import Avatar from '../ui/Avatar';
import LanguageBadge from '../ui/LanguageBadge';

interface PartnerCardProps {
  partner: UserProfile;
  onClick: () => void;
}

const PartnerCard: React.FC<PartnerCardProps> = ({ partner, onClick }) => (
  <button 
    onClick={onClick}
    className="w-full bg-white p-4 rounded-xl shadow-sm hover:shadow-md transition-all duration-200 flex items-center space-x-4 text-left border border-gray-100 active:scale-[0.98]"
  >
    <Avatar src={partner.avatar} size="lg" online={partner.isOnline} />
    <div className="flex-1 min-w-0">
      <div className="flex justify-between items-baseline">
        <h4 className="font-bold text-gray-800 truncate">{partner.name}</h4>
      </div>
      <p className="text-xs text-gray-500 line-clamp-1 mt-0.5">{partner.bio}</p>
      <div className="mt-2 flex flex-wrap gap-2">
        <LanguageBadge language={partner.nativeLanguage} type="native" />
        <LanguageBadge language={partner.targetLanguage} type="learning" />
      </div>
    </div>
  </button>
);

export default PartnerCard;
