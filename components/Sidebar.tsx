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
  onLogout?: () => void;
  onSettings?: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ activeTab, onTabChange, unreadCount = 0, user, onLogout, onSettings }) => {
  const [isMenuOpen, setIsMenuOpen] = React.useState(false);
  const desktopMenuRef = React.useRef<HTMLDivElement>(null);
  const mobileMenuRef = React.useRef<HTMLDivElement>(null);

  // Close menu when clicking outside
  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      const isOutsideDesktop = !desktopMenuRef.current || !desktopMenuRef.current.contains(target);
      const isOutsideMobile = !mobileMenuRef.current || !mobileMenuRef.current.contains(target);
      
      if (isOutsideDesktop && isOutsideMobile) {
        setIsMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const tabs = [
    { id: 'dashboard' as TabType, label: 'Dashboard', icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012-2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
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
    { id: 'saved' as TabType, label: 'Saved', icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
      </svg>
    )},
  ];

  // Helper component for the Popover Menu (Settings / Logout)
  const ActionMenuPopover = ({ isMobile = false }) => (
    <div className={`absolute ${isMobile ? 'bottom-full right-4 mb-4' : 'bottom-full left-3 mb-2 w-56'} bg-surface-card border border-theme-border rounded-2xl shadow-2xl overflow-hidden z-[60] animate-in fade-in slide-in-from-bottom-2 duration-200`}>
      <div className="p-2 space-y-1">
        <button
          type="button"
          onMouseDown={(e) => { e.preventDefault(); onSettings?.(); setIsMenuOpen(false); }}
          className="w-full flex items-center space-x-3 p-3 rounded-xl text-theme-text hover:bg-surface-hover transition-colors"
        >
          <svg className="w-5 h-5 text-theme-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          <span className="font-medium text-sm">Profile / Settings</span>
        </button>
        <button
          type="button"
          onMouseDown={(e) => { e.preventDefault(); onLogout?.(); setIsMenuOpen(false); }}
          className="w-full flex items-center space-x-3 p-3 rounded-xl text-red-500 hover:bg-red-500/10 transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
          <span className="font-medium text-sm">Sign Out</span>
        </button>
      </div>
    </div>
  );

  return (
    <>
      <nav className="hidden md:flex bg-surface-card border-r border-theme-border flex-col h-full w-64 flex-shrink-0 z-30">
        <div className="p-4 h-[72px] flex items-center flex-shrink-0">
          <div className="w-10 h-10 rounded-lg overflow-hidden flex items-center justify-center flex-shrink-0">
            <img src="/ndhu_logo.png" alt="LingoSwap Logo" className="w-full h-full object-contain" />
          </div>
          <span className="font-bold text-xl text-theme-text ml-4 whitespace-nowrap">LingoSwap</span>
        </div>

        <div className="flex-1 px-3 space-y-2 py-4 overflow-y-auto overflow-x-hidden">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`w-full flex items-center p-3 rounded-xl transition-all ${
                activeTab === tab.id
                ? 'bg-[#00a884]/10 text-[#00a884]'
                : 'text-theme-muted hover:bg-surface-hover hover:text-theme-text'
              }`}
            >
              <div className="flex-shrink-0 flex items-center justify-center w-6 h-6">
                {tab.icon}
              </div>
              <span className="font-medium ml-4 whitespace-nowrap">{tab.label}</span>
            </button>
          ))}
        </div>

        {/* User Profile Footer (Desktop) */}
        {user && (() => {
          const level = getLevelInfo(user.xp || 0);
          return (
            <div className="p-3 border-t border-theme-border relative flex-shrink-0" ref={desktopMenuRef}>
              {isMenuOpen && <ActionMenuPopover />}
              <button
                onClick={() => setIsMenuOpen(!isMenuOpen)}
                className={`w-full flex items-center p-2 rounded-xl transition-all hover:bg-surface-hover ${isMenuOpen ? 'bg-surface-hover' : ''}`}
              >
                <div className="flex-shrink-0">
                  <Avatar src={user.avatar} size="sm" online />
                </div>
                <div className="flex-1 min-w-0 text-left ml-3 flex flex-col justify-center overflow-hidden">
                  <p className="text-sm font-semibold text-theme-text truncate">{user.name}</p>
                  <div className="scale-90 origin-left">
                    <LevelBadge level={level} size="sm" />
                  </div>
                </div>
              </button>
            </div>
          );
        })()}
      </nav>

      {/* ======================= */}
      {/* MOBILE BOTTOM NAV (<md) */}
      {/* ======================= */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-surface-card border-t border-theme-border flex justify-between items-center h-[68px] px-1 pb-[max(env(safe-area-inset-bottom),0.5rem)] pt-1 z-[50]">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={`flex-1 min-w-0 flex flex-col items-center justify-center p-1 transition-colors [&>div>svg]:w-5 [&>div>svg]:h-5 ${
              activeTab === tab.id ? 'text-[#00a884]' : 'text-theme-muted hover:text-theme-text'
            }`}
          >
            <div className={`p-1 rounded-full transition-all ${activeTab === tab.id ? 'bg-[#00a884]/10 scale-110' : ''}`}>
              {tab.icon}
            </div>
            <span className="text-[9px] font-medium mt-0.5 truncate w-full text-center px-0.5">
              {tab.label}
            </span>
          </button>
        ))}

        {/* Mobile Profile Trigger */}
        {user && (
          <div className="relative flex-1 min-w-0 flex flex-col items-center justify-center" ref={mobileMenuRef}>
            {isMenuOpen && <ActionMenuPopover isMobile={true} />}
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="flex flex-col items-center justify-center p-1 transition-all w-full"
            >
              <div className={`p-[2px] rounded-full transition-shadow ${isMenuOpen ? 'ring-2 ring-[#00a884]' : ''}`}>
                <Avatar src={user.avatar} size="sm" online />
              </div>
              <span className="text-[9px] font-medium text-theme-muted mt-0.5 truncate w-full text-center px-0.5">
                Profile
              </span>
            </button>
          </div>
        )}
      </nav>
    </>
  );
};

export default Sidebar;