import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { ChatMessage } from '../../types';

export interface ChatSearchState {
  /** IDs of messages matching the current query, in message-list order */
  matchIds: string[];
  /** Index within matchIds of the currently active match (0-based) */
  activeIndex: number;
}

interface ChatSearchBarProps {
  messages: ChatMessage[];
  messageRefs: React.MutableRefObject<{ [key: string]: HTMLDivElement | null }>;
  onClose: () => void;
  /** Called whenever the search state changes so parent can optionally use it */
  onSearchStateChange?: (state: ChatSearchState | null) => void;
}

const ChatSearchBar: React.FC<ChatSearchBarProps> = ({
  messages,
  messageRefs,
  onClose,
  onSearchStateChange,
}) => {
  const [query, setQuery] = useState('');
  const [matchIds, setMatchIds] = useState<string[]>([]);
  const [activeIndex, setActiveIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-focus the search input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Compute matches whenever query or messages change
  const computedMatchIds = useMemo(() => {
    const trimmed = query.trim().toLowerCase();
    if (!trimmed) return [];

    return messages
      .filter((msg) => {
        // Only search text messages
        const type = msg.type || 'text';
        if (type !== 'text') return false;
        return msg.text?.toLowerCase().includes(trimmed);
      })
      .map((msg) => msg.id);
  }, [query, messages]);

  // Sync computed matches into state and reset active index
  useEffect(() => {
    setMatchIds(computedMatchIds);
    if (computedMatchIds.length > 0) {
      // Start at the last (most recent) match
      setActiveIndex(computedMatchIds.length - 1);
    } else {
      setActiveIndex(-1);
    }
  }, [computedMatchIds]);

  // Notify parent of search state changes
  useEffect(() => {
    if (onSearchStateChange) {
      if (matchIds.length > 0 && activeIndex >= 0) {
        onSearchStateChange({ matchIds, activeIndex });
      } else {
        onSearchStateChange(null);
      }
    }
  }, [matchIds, activeIndex, onSearchStateChange]);

  // Scroll to and highlight the active match
  useEffect(() => {
    if (activeIndex < 0 || activeIndex >= matchIds.length) return;

    const msgId = matchIds[activeIndex];
    const el = messageRefs.current[msgId];
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      // Add temporary highlight
      el.classList.add('ring-2', 'ring-blue-500/60', 'bg-blue-900/20', 'rounded-xl', 'transition-all', 'duration-300');
      const timer = setTimeout(() => {
        el.classList.remove('ring-2', 'ring-blue-500/60', 'bg-blue-900/20', 'rounded-xl');
      }, 1800);
      return () => {
        clearTimeout(timer);
        el.classList.remove('ring-2', 'ring-blue-500/60', 'bg-blue-900/20', 'rounded-xl');
      };
    }
  }, [activeIndex, matchIds, messageRefs]);

  const goToNext = useCallback(() => {
    if (matchIds.length === 0) return;
    setActiveIndex((prev) => (prev + 1) % matchIds.length);
  }, [matchIds.length]);

  const goToPrev = useCallback(() => {
    if (matchIds.length === 0) return;
    setActiveIndex((prev) => (prev - 1 + matchIds.length) % matchIds.length);
  }, [matchIds.length]);

  const handleClose = useCallback(() => {
    setQuery('');
    setMatchIds([]);
    setActiveIndex(-1);
    onSearchStateChange?.(null);
    onClose();
  }, [onClose, onSearchStateChange]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (e.shiftKey) {
        goToPrev();
      } else {
        goToNext();
      }
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      handleClose();
    }
  };

  const hasResults = matchIds.length > 0;
  const displayIndex = hasResults ? activeIndex + 1 : 0;
  const displayTotal = matchIds.length;
  const hasQuery = query.trim().length > 0;

  return (
    <div className="flex-none bg-gray-900/95 backdrop-blur-sm border-b border-gray-800 z-20 flex justify-center">
      <div className="w-full max-w-4xl px-4 py-2 flex items-center space-x-2">
        {/* Search icon */}
        <svg className="w-4 h-4 text-gray-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>

        {/* Input */}
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Search in chat..."
          className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-gray-100 placeholder-gray-500 focus:outline-none focus:border-gray-600 focus:ring-1 focus:ring-gray-600 transition-colors min-w-0"
        />

        {/* Match count */}
        {hasQuery && (
          <span className="text-xs text-gray-400 font-medium tabular-nums flex-shrink-0 min-w-[40px] text-center">
            {hasResults ? `${displayIndex} / ${displayTotal}` : '0 / 0'}
          </span>
        )}

        {/* Navigation buttons */}
        <button
          onClick={goToPrev}
          disabled={!hasResults}
          className="p-1.5 rounded-full text-gray-400 hover:text-gray-200 hover:bg-gray-800 transition-colors disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-gray-400 flex-shrink-0"
          title="Previous match (Shift+Enter)"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 15l7-7 7 7" />
          </svg>
        </button>

        <button
          onClick={goToNext}
          disabled={!hasResults}
          className="p-1.5 rounded-full text-gray-400 hover:text-gray-200 hover:bg-gray-800 transition-colors disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-gray-400 flex-shrink-0"
          title="Next match (Enter)"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {/* Close button */}
        <button
          onClick={handleClose}
          className="p-1.5 rounded-full text-gray-400 hover:text-gray-200 hover:bg-gray-800 transition-colors flex-shrink-0"
          title="Close search (Esc)"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
};

export default ChatSearchBar;
