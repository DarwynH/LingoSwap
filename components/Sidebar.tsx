import React from 'react';

export type TabType = 'dashboard' | 'partners' | 'chats' | 'saved';

interface SidebarProps {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
  unreadCount?: number;
}

const Sidebar: React.FC<SidebarProps> = ({ activeTab, onTabChange, unreadCount = 0 }) => {
  const tabs = [
    { id: 'dashboard' as TabType, label: 'Dashboard', icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
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
    <nav className="bg-white border-r border-gray-200 w-20 md:w-64 flex flex-col h-full z-20">
      <div className="p-6 flex items-center space-x-3">
        <div className="w-8 h-8 bg-[#00a884] rounded-lg flex items-center justify-center">
          <span className="text-white font-bold text-xl">L</span>
        </div>
        <span className="hidden md:block font-bold text-xl text-gray-800">LingoSwap</span>
      </div>

      <div className="flex-1 px-3 space-y-2 py-4">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={`w-full flex items-center space-x-3 p-3 rounded-xl transition-all ${
              activeTab === tab.id
                ? 'bg-[#e7f7f3] text-[#00a884]'
                : 'text-gray-500 hover:bg-gray-50'
            }`}
          >
            {tab.icon}
            <span className="hidden md:block font-medium">{tab.label}</span>
          </button>
        ))}
      </div>

      <div className="p-4 border-t border-gray-100">
        <p className="hidden md:block text-[10px] text-gray-400 uppercase font-bold tracking-widest text-center">
          Pro Account
        </p>
      </div>
    </nav>
  );
};

export default Sidebar;