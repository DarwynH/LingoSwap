import React from 'react';
import { UserProfile } from '../types';
import { getLevelInfo } from '../services/gamificationService';
import LevelBadge from './ui/LevelBadge';
import Avatar from './ui/Avatar';

export type TabType = 'dashboard' | 'progress' | 'partners' | 'chats' | 'saved';

interface SidebarProps {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
  unreadCount?: number;
  user?: UserProfile;
}

const Sidebar: React.FC<SidebarProps> = ({ activeTab, onTabChange, unreadCount = 0, user }) => {
  const tabs = [
    { id: 'dashboard' as TabType, label: 'Dashboard', icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    )},
    { id: 'progress' as TabType, label: 'Progress', icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
      </svg>
    )},
    { id: 'partners' as TabType, label: 'Discover', icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
      </svg>
    )},
    { id: 'chats' as TabType, label: 'Chats', icon: (
      <div className="relative">
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] w-4 h-4 flex items-center justify-center rounded-full border border-white">
            {unreadCount}
          </span>
        )}
      </div>
    )},
    // NEW: Added the Saved tab here
    { id: 'saved' as TabType, label: 'Saved', icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
      </svg>
    )},
  ];

  return (
    <nav className="bg-surface-card border-r border-theme-border w-20 md:w-64 flex flex-col h-full z-20">
      <div className="p-6 flex items-center space-x-3">
        <div className="w-100 h-100 rounded-lg overflow-hidden flex items-center justify-center">
          <img
            src="/ndhu_logo.png"
            alt="LingoSwap Logo"
            className="w-full h-full object-contain"
          />
        </div>
        <span className="hidden md:block font-bold text-xl text-theme-text">LingoSwap</span>
      </div>

      <div className="flex-1 px-3 space-y-2 py-4">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={`w-full flex items-center space-x-3 p-3 rounded-xl transition-all ${
              activeTab === tab.id
              ? 'bg-[#00a884]/10 text-[#00a884]'
              : 'text-theme-muted hover:bg-surface-hover hover:text-theme-text'
            }`}
          >
            {tab.icon}
            <span className="hidden md:block font-medium">{tab.label}</span>
          </button>
        ))}
      </div>

      {/* User Profile Footer */}
      {user && (() => {
        const level = getLevelInfo(user.xp || 0);
        return (
          <div className="p-3 border-t border-theme-border">
            <div className="flex items-center space-x-3 px-1">
              <Avatar src={user.avatar} size="sm" online />
              <div className="hidden md:block flex-1 min-w-0">
                <p className="text-sm font-semibold text-theme-text truncate">{user.name}</p>
                <LevelBadge level={level} size="sm" />
              </div>
            </div>
            {/* Collapsed sidebar: show badge below avatar */}
            <div className="md:hidden mt-2 flex justify-center">
              <LevelBadge level={level} size="sm" />
            </div>
          </div>
        );
      })()}
    </nav>
  );
};

export default Sidebar;