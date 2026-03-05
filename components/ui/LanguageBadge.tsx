
import React from 'react';
import { Language } from '../../types';

interface LanguageBadgeProps {
  language: Language;
  type: 'native' | 'learning';
}

const LanguageBadge: React.FC<LanguageBadgeProps> = ({ language, type }) => {
  const styles = type === 'native' 
    ? 'bg-blue-50 text-blue-600 border-blue-100' 
    : 'bg-orange-50 text-orange-600 border-orange-100';

  return (
    <span className={`${styles} text-[10px] px-2 py-0.5 rounded border font-medium uppercase tracking-tight`}>
      {type === 'native' ? 'Native' : 'Learns'}: {language}
    </span>
  );
};

export default LanguageBadge;
