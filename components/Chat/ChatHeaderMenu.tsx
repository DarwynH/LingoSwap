import React, { useEffect, useRef } from 'react';

interface MenuItem {
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
  danger?: boolean;
  active?: boolean;
}

interface ChatHeaderMenuProps {
  isOpen: boolean;
  onClose: () => void;
  items: MenuItem[];
  anchorRef: React.RefObject<HTMLButtonElement | null>;
}

const ChatHeaderMenu: React.FC<ChatHeaderMenuProps> = ({
  isOpen,
  onClose,
  items,
  anchorRef,
}) => {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (
        menuRef.current && !menuRef.current.contains(e.target as Node) &&
        anchorRef.current && !anchorRef.current.contains(e.target as Node)
      ) {
        onClose();
      }
    };

    // Delay listener attach to avoid immediate close from the opening click
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
    }, 0);

    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onClose, anchorRef]);

  if (!isOpen) return null;

  return (
    <div
      ref={menuRef}
      className="absolute right-2 top-full mt-1 w-52 bg-gray-800 border border-gray-700 rounded-xl shadow-2xl py-1 z-50 overflow-hidden"
      style={{ animation: 'chatHeaderMenuIn 0.15s ease-out' }}
    >
      <style>{`
        @keyframes chatHeaderMenuIn {
          0% { opacity: 0; transform: translateY(-4px) scale(0.97); }
          100% { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
      {items.map((item, idx) => (
        <button
          key={idx}
          onClick={item.onClick}
          className={`w-full flex items-center space-x-3 px-4 py-2.5 text-[13px] font-medium transition-colors ${
            item.danger
              ? 'text-red-400 hover:bg-red-900/30 hover:text-red-300'
              : item.active
                ? 'text-blue-400 hover:bg-gray-700 hover:text-blue-300'
                : 'text-gray-200 hover:bg-gray-700 hover:text-white'
          }`}
        >
          <span className={item.danger ? 'text-red-500' : item.active ? 'text-blue-400' : 'text-gray-400'}>
            {item.icon}
          </span>
          <span>{item.label}</span>
        </button>
      ))}
    </div>
  );
};

export default ChatHeaderMenu;
