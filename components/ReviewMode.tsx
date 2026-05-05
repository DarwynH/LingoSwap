// components/ReviewMode.tsx
import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { doc, updateDoc, increment } from 'firebase/firestore';
import { SavedItem } from '../types';
import { recordUserActivity } from '../services/progressService';

interface ReviewModeProps {
  items: SavedItem[];
  userId: string;
  onClose: () => void;
}

const ReviewMode: React.FC<ReviewModeProps> = ({ items, userId, onClose }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showNote, setShowNote] = useState(false);
  const [markedIds, setMarkedIds] = useState<Set<string>>(new Set());

  const total = items.length;
  const item = items[currentIndex];

  // Reset note visibility when switching cards
  useEffect(() => {
    setShowNote(false);
  }, [currentIndex]);

  const goNext = () => {
    if (currentIndex < total - 1) setCurrentIndex(currentIndex + 1);
  };

  const goPrev = () => {
    if (currentIndex > 0) setCurrentIndex(currentIndex - 1);
  };

  const markReviewed = async (difficulty: 'easy' | 'medium' | 'hard') => {
    if (!item || markedIds.has(item.id)) return;

    try {
      const ref = doc(db, 'users', userId, 'savedItems', item.id);
      await updateDoc(ref, {
        reviewed: true,
        reviewCount: increment(1),
        lastReviewedAt: Date.now(),
        difficulty,
      });
      await recordUserActivity(userId, 'reviewCompleted');
      setMarkedIds(prev => new Set(prev).add(item.id));
    } catch (e) {
      console.warn('Could not update review metadata', e);
    }
  };

  // Keyboard navigation
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') goNext();
      else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') goPrev();
      else if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [currentIndex, total, onClose]);

  if (!item) {
    return (
      <div className="flex flex-col h-full bg-gray-900 text-gray-100 items-center justify-center p-6">
        <div className="w-16 h-16 bg-gray-800 rounded-full flex items-center justify-center mb-4">
          <svg className="w-8 h-8 text-emerald-500/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <h3 className="text-lg font-semibold text-gray-300 mb-2">Nothing to review</h3>
        <p className="text-gray-500 text-sm mb-6">Save some phrases from your chats first.</p>
        <button onClick={onClose} className="px-5 py-2 text-sm font-semibold bg-gray-800 text-gray-200 rounded-xl hover:bg-gray-700 transition-colors">
          Back to saved items
        </button>
      </div>
    );
  }

  const formatDate = (ts?: number) => {
    if (!ts) return null;
    return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const hasNote = !!(item.note && item.note.trim());
  const hasTranslation = !!(item.translation && item.translation.trim());
  const isFirst = currentIndex === 0;
  const isLast = currentIndex === total - 1;
  const isMarked = markedIds.has(item.id);

  return (
    <div className="flex flex-col h-full bg-gray-900 text-gray-100">
      {/* Header */}
      <div className="flex-none bg-gray-900/80 backdrop-blur-xl border-b border-gray-800 px-4 py-3 pt-[max(0.75rem,env(safe-area-inset-top))] flex items-center justify-between">
        <button onClick={onClose} className="p-2 -ml-2 text-gray-400 hover:text-gray-200 hover:bg-gray-800 rounded-full transition-all active:scale-95">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div className="text-center">
          <h3 className="text-sm font-bold text-gray-200">Review</h3>
          <span className="text-[11px] text-gray-500 font-medium">{currentIndex + 1} of {total}</span>
        </div>
        {/* Spacer to balance header */}
        <div className="w-9" />
      </div>

      {/* Card Area */}
      <div className="flex-1 flex flex-col items-center justify-center p-6 overflow-y-auto">
        <div className="w-full max-w-lg">

          {/* Main Card */}
          <div className="bg-gray-800 border border-gray-700/50 rounded-2xl shadow-lg overflow-hidden">
            {/* Source Context Bar */}
            <div className="px-4 py-2.5 bg-gray-800/80 border-b border-gray-700/50 flex items-center justify-between">
              <div className="flex items-center space-x-2 min-w-0">
                <span className="text-xs font-bold text-gray-400 uppercase tracking-wider truncate">{item.senderName}</span>
                {item.partnerName && (
                  <span className="text-[11px] text-gray-600 flex items-center flex-shrink-0">
                    <svg className="w-3 h-3 mr-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" /></svg>
                    {item.partnerName}
                  </span>
                )}
              </div>
              {item.originalTimestamp && (
                <span className="text-[11px] text-gray-500 flex-shrink-0 ml-2">{formatDate(item.originalTimestamp)}</span>
              )}
            </div>

            {/* Phrase Text */}
            <div className="p-6">
              <p className="text-xl sm:text-2xl font-medium leading-relaxed text-gray-100 text-center break-words">
                {item.text}
              </p>
            </div>

            {/* Cached Translation */}
            {hasTranslation && (
              <div className="px-6 pb-4">
                <div className="bg-gray-900/40 p-3 rounded-xl border border-gray-700/30 text-center">
                  <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Translation</span>
                  <p className="text-[15px] text-gray-300 italic mt-1 break-words">{item.translation}</p>
                </div>
              </div>
            )}

            {/* Note Toggle Area */}
            {hasNote && (
              <div className="border-t border-gray-700/50">
                <button
                  onClick={() => setShowNote(!showNote)}
                  className="w-full px-4 py-2.5 text-[12px] font-semibold text-gray-400 hover:text-gray-200 hover:bg-gray-700/30 transition-colors flex items-center justify-center space-x-1.5"
                >
                  <svg className={`w-3.5 h-3.5 transition-transform ${showNote ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                  <span>{showNote ? 'Hide Note' : 'Show Note'}</span>
                </button>
                {showNote && (
                  <div className="px-4 pb-4">
                    <p className="text-sm text-gray-300 italic bg-gray-900/30 p-3 rounded-xl border border-gray-700/50 break-words leading-relaxed">
                      {item.note}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Review Status + Mark Button */}
          <div className="flex flex-col items-center justify-center mt-4">
            {isMarked ? (
              <div className="flex items-center space-x-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-emerald-900/30 text-emerald-400 border border-emerald-700/30 cursor-default">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                </svg>
                <span>Reviewed</span>
              </div>
            ) : (
              <div className="flex items-center space-x-2 w-full px-2">
                <button
                  onClick={() => markReviewed('hard')}
                  className="flex-1 py-2 rounded-xl text-xs font-bold transition-all active:scale-95 bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/30"
                >
                  Hard
                </button>
                <button
                  onClick={() => markReviewed('medium')}
                  className="flex-1 py-2 rounded-xl text-xs font-bold transition-all active:scale-95 bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 border border-blue-500/30"
                >
                  Good
                </button>
                <button
                  onClick={() => markReviewed('easy')}
                  className="flex-1 py-2 rounded-xl text-xs font-bold transition-all active:scale-95 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/30"
                >
                  Easy
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Navigation Controls */}
      <div className="flex-none bg-gray-900/80 backdrop-blur-xl border-t border-gray-800 px-4 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <div className="max-w-lg mx-auto flex items-center justify-between">
          <button
            onClick={goPrev}
            disabled={isFirst}
            className={`flex items-center space-x-1 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all active:scale-95 ${
              isFirst
                ? 'text-gray-600 cursor-not-allowed'
                : 'text-gray-200 bg-gray-800 hover:bg-gray-700 shadow-sm'
            }`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
            </svg>
            <span>Prev</span>
          </button>

          {/* Progress dots (max ~10 visible, then just counter) */}
          {total <= 10 ? (
            <div className="flex items-center space-x-1.5">
              {items.map((_, i) => (
                <div
                  key={i}
                  className={`w-2 h-2 rounded-full transition-all ${
                    i === currentIndex ? 'bg-emerald-400 scale-125' : 'bg-gray-700'
                  }`}
                />
              ))}
            </div>
          ) : (
            <span className="text-sm font-medium text-gray-400">
              {currentIndex + 1} / {total}
            </span>
          )}

          <button
            onClick={isLast ? onClose : goNext}
            className={`flex items-center space-x-1 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all active:scale-95 shadow-sm ${
              isLast
                ? 'bg-emerald-600 text-white hover:bg-emerald-500'
                : 'text-gray-200 bg-gray-800 hover:bg-gray-700'
            }`}
          >
            <span>{isLast ? 'Done' : 'Next'}</span>
            {!isLast && (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
              </svg>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ReviewMode;
