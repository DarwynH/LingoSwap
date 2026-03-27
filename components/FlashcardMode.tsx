// components/FlashcardMode.tsx
import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { doc, updateDoc, increment } from 'firebase/firestore';
import { SavedItem } from '../types';

interface FlashcardModeProps {
  items: SavedItem[];
  userId: string;
  onClose: () => void;
}

const FlashcardMode: React.FC<FlashcardModeProps> = ({ items, userId, onClose }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [markedIds, setMarkedIds] = useState<Set<string>>(new Set());

  const total = items.length;
  const item = items[currentIndex];

  // Reset flip state on card change
  useEffect(() => {
    setFlipped(false);
  }, [currentIndex]);

  const goNext = () => {
    if (currentIndex < total - 1) setCurrentIndex(currentIndex + 1);
  };

  const goPrev = () => {
    if (currentIndex > 0) setCurrentIndex(currentIndex - 1);
  };

  const flipCard = () => setFlipped(!flipped);

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
      setMarkedIds(prev => new Set(prev).add(item.id));
    } catch (e) {
      console.warn('Could not mark reviewed', e);
    }
  };

  // Keyboard controls
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') goNext();
      else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') goPrev();
      else if (e.key === ' ') { e.preventDefault(); flipCard(); }
      else if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [currentIndex, total, flipped, onClose]);

  const formatDate = (ts?: number) => {
    if (!ts) return null;
    return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  };

  // Empty state
  if (!item) {
    return (
      <div className="flex flex-col h-full bg-gray-900 text-gray-100 items-center justify-center p-6">
        <div className="w-16 h-16 bg-gray-800 rounded-full flex items-center justify-center mb-4">
          <svg className="w-8 h-8 text-amber-500/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
          </svg>
        </div>
        <h3 className="text-lg font-semibold text-gray-300 mb-2">No flashcards yet</h3>
        <p className="text-gray-500 text-sm mb-6">Save phrases from your chats to create flashcards.</p>
        <button onClick={onClose} className="px-5 py-2 text-sm font-semibold bg-gray-800 text-gray-200 rounded-xl hover:bg-gray-700 transition-colors">
          Back to saved items
        </button>
      </div>
    );
  }

  const isMarked = markedIds.has(item.id);
  const hasBackContent = !!(item.translation || item.note || item.partnerName);
  const isFirst = currentIndex === 0;
  const isLast = currentIndex === total - 1;

  return (
    <div className="flex flex-col h-full bg-gray-900 text-gray-100">
      <style>{`
        @keyframes flashcardFlip {
          0% { transform: rotateY(0deg); opacity: 1; }
          50% { transform: rotateY(90deg); opacity: 0.6; }
          100% { transform: rotateY(0deg); opacity: 1; }
        }
        .flashcard-flip {
          animation: flashcardFlip 0.35s ease-in-out;
        }
      `}</style>

      {/* Header */}
      <div className="flex-none bg-gray-900/80 backdrop-blur-xl border-b border-gray-800 px-4 py-3 pt-[max(0.75rem,env(safe-area-inset-top))] flex items-center justify-between">
        <button onClick={onClose} className="p-2 -ml-2 text-gray-400 hover:text-gray-200 hover:bg-gray-800 rounded-full transition-all active:scale-95">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div className="text-center">
          <h3 className="text-sm font-bold text-gray-200">Flashcards</h3>
          <span className="text-[11px] text-gray-500 font-medium">{currentIndex + 1} of {total}</span>
        </div>
        <div className="w-9" />
      </div>

      {/* Card Area */}
      <div className="flex-1 flex flex-col items-center justify-center p-6 overflow-y-auto">
        <div className="w-full max-w-lg">

          {/* Flashcard */}
          <div
            key={`${item.id}-${flipped}`}
            onClick={flipCard}
            className="flashcard-flip bg-gray-800 border border-gray-700/50 rounded-2xl shadow-lg cursor-pointer select-none min-h-[260px] flex flex-col transition-all hover:border-gray-600 hover:shadow-xl active:scale-[0.98]"
          >
            {/* Side indicator */}
            <div className="px-4 py-2 border-b border-gray-700/30 flex items-center justify-between">
              <span className={`text-[10px] font-bold uppercase tracking-wider ${
                flipped ? 'text-amber-500' : 'text-blue-400'
              }`}>
                {flipped ? 'Back' : 'Front'}
              </span>
              <span className="text-[10px] text-gray-600">Tap to flip</span>
            </div>

            {/* Card content */}
            <div className="flex-1 flex flex-col items-center justify-center p-6">
              {!flipped ? (
                /* ——— FRONT: original text ——— */
                <p className="text-xl sm:text-2xl font-medium leading-relaxed text-gray-100 text-center break-words">
                  {item.text}
                </p>
              ) : (
                /* ——— BACK: translation / note / context ——— */
                <div className="w-full space-y-4">
                  {/* Translation */}
                  {item.translation ? (
                    <div className="text-center">
                      <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Translation</span>
                      <p className="text-lg sm:text-xl font-medium text-amber-300 mt-1 break-words leading-relaxed">
                        {item.translation}
                      </p>
                    </div>
                  ) : (
                    <div className="text-center">
                      <p className="text-sm text-gray-500 italic">No translation saved</p>
                    </div>
                  )}

                  {/* Personal Note */}
                  {item.note && (
                    <div className="bg-gray-900/40 p-3 rounded-xl border border-gray-700/30">
                      <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider flex items-center justify-center mb-1">
                        <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                        Note
                      </span>
                      <p className="text-sm text-gray-300 italic text-center break-words leading-relaxed">{item.note}</p>
                    </div>
                  )}

                  {/* Source Context */}
                  {(item.partnerName || item.originalTimestamp) && (
                    <div className="text-center pt-1">
                      <div className="flex items-center justify-center space-x-2 text-[11px] text-gray-600">
                        {item.partnerName && (
                          <span className="flex items-center">
                            <svg className="w-3 h-3 mr-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" /></svg>
                            {item.partnerName}
                          </span>
                        )}
                        {item.originalTimestamp && (
                          <span>{formatDate(item.originalTimestamp)}</span>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Fallback if nothing on back */}
                  {!hasBackContent && (
                    <p className="text-sm text-gray-500 italic text-center">Add a note or translation to enrich this card.</p>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Mark Reviewed */}
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
                  onClick={(e) => { e.stopPropagation(); markReviewed('hard'); }}
                  className="flex-1 py-2 rounded-xl text-xs font-bold transition-all active:scale-95 bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/30"
                >
                  Hard
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); markReviewed('medium'); }}
                  className="flex-1 py-2 rounded-xl text-xs font-bold transition-all active:scale-95 bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 border border-blue-500/30"
                >
                  Good
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); markReviewed('easy'); }}
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

          {/* Progress */}
          {total <= 10 ? (
            <div className="flex items-center space-x-1.5">
              {items.map((_, i) => (
                <div
                  key={i}
                  className={`w-2 h-2 rounded-full transition-all ${
                    i === currentIndex ? 'bg-amber-400 scale-125' : markedIds.has(items[i].id) ? 'bg-emerald-600' : 'bg-gray-700'
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
                ? 'bg-amber-600 text-white hover:bg-amber-500'
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

export default FlashcardMode;
