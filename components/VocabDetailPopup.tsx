import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { doc, updateDoc, deleteDoc, increment } from 'firebase/firestore';
import { SavedVocabularyItem } from '../types';

interface VocabDetailPopupProps {
  item: SavedVocabularyItem;
  onClose: () => void;
}

const VocabDetailPopup: React.FC<VocabDetailPopupProps> = ({ item, onClose }) => {
  const [isEditingNote, setIsEditingNote] = useState(false);
  const [noteDraft, setNoteDraft] = useState(item.note || '');
  const [isSaving, setIsSaving] = useState(false);

  // Sync draft when item note changes externally
  useEffect(() => {
    if (!isEditingNote) {
      setNoteDraft(item.note || '');
    }
  }, [item.note, isEditingNote]);

  const handleSaveNote = async () => {
    if (!item.userId || !item.id) return;
    setIsSaving(true);
    try {
      await updateDoc(doc(db, 'users', item.userId, 'vocabulary', item.id), { note: noteDraft.trim() });
      setIsEditingNote(false);
    } catch (err) {
      console.error('Failed to save note:', err);
      alert('Could not save note.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleRemove = async () => {
    if (window.confirm('Delete this word from your vocabulary?')) {
      try {
        await deleteDoc(doc(db, 'users', item.userId, 'vocabulary', item.id));
        onClose();
      } catch (err) {
        console.error('Failed to remove vocabulary item:', err);
      }
    }
  };

  const handleMarkReviewed = async (difficulty: 'easy' | 'medium' | 'hard') => {
    if (!item.userId || !item.id) return;
    try {
      await updateDoc(doc(db, 'users', item.userId, 'vocabulary', item.id), {
        reviewed: true,
        reviewCount: increment(1),
        lastReviewedAt: Date.now(),
        difficulty
      });
    } catch (err) {
      console.error('Failed to mark reviewed:', err);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm transition-opacity" onClick={onClose}>
      <div 
        className="w-full sm:w-[480px] max-h-[90vh] bg-gray-900 border-t sm:border border-gray-700/60 rounded-t-2xl sm:rounded-2xl shadow-2xl flex flex-col mb-0 sm:mb-8 animate-slide-up sm:animate-pop-in" 
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex justify-between items-start p-5 border-b border-gray-800 bg-gray-800/40 relative">
          <div className="pr-10">
            <h3 className="text-3xl font-bold text-gray-100 uppercase tracking-widest">{item.word}</h3>
            <div className="flex items-center space-x-3 mt-1.5">
              {item.phonetic && (
                <span className="text-sm text-gray-400 font-mono tracking-wide">{item.phonetic}</span>
              )}
              {item.translation && item.translation.toLowerCase() !== item.word.toLowerCase() && (
                <span className="text-[13px] font-bold text-blue-400 uppercase tracking-wider bg-blue-500/10 px-2 py-0.5 rounded">
                  {item.translation}
                </span>
              )}
            </div>
          </div>
          <button onClick={onClose} className="p-2 absolute top-4 right-4 bg-gray-800 hover:bg-gray-700 rounded-full text-gray-400 hover:text-white transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="p-5 overflow-y-auto flex-1 overscroll-contain">
          <div className="space-y-6">
            
            {/* Context Snippet */}
            {item.sourceText && (
              <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-4">
                <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block mb-2 flex items-center">
                  <svg className="w-3.5 h-3.5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
                  Source Context
                </span>
                <p className="text-[14px] text-gray-300 italic leading-relaxed break-words border-l-2 border-gray-600 pl-3">"{item.sourceText}"</p>
              </div>
            )}

            {/* Meanings */}
            {item.meanings && item.meanings.length > 0 && (
              <div>
                <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block mb-3">Dictionary Definitions</span>
                <div className="space-y-4">
                  {item.meanings.map((meaning, idx) => (
                    <div key={idx} className="relative pl-3 border-l-2 border-emerald-500/50">
                      {meaning.partOfSpeech && (
                        <span className="inline-block text-[10px] font-bold text-emerald-400 uppercase tracking-wider mb-1.5 bg-emerald-400/10 px-2 py-0.5 rounded">
                          {meaning.partOfSpeech}
                        </span>
                      )}
                      <p className="text-[15px] text-gray-200 leading-relaxed font-medium">{meaning.definition}</p>
                      {meaning.example && (
                        <p className="text-[14px] text-gray-500 mt-2 italic">Example: "{meaning.example}"</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Note Section */}
            <div className="pt-2">
              <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block mb-3 flex items-center">
                <svg className="w-3.5 h-3.5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                Personal Note & Memorization Hint
              </span>
              
              {isEditingNote ? (
                <div className="flex flex-col space-y-2 animate-fade-in">
                  <textarea
                    value={noteDraft}
                    onChange={(e) => setNoteDraft(e.target.value)}
                    placeholder="E.g., Sounds like 'apple'. Saw this in a movie..."
                    className="w-full bg-gray-900 border border-blue-500/50 rounded-xl p-3 text-[14px] text-gray-200 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none min-h-[100px]"
                    autoFocus
                  />
                  <div className="flex justify-end space-x-2">
                    <button onClick={() => setIsEditingNote(false)} className="px-4 py-2 text-xs font-semibold text-gray-400 hover:text-gray-200 transition-colors">
                      Cancel
                    </button>
                    <button onClick={handleSaveNote} disabled={isSaving} className="px-5 py-2 text-xs font-semibold bg-blue-600 text-white rounded-lg hover:bg-blue-500 transition-colors shadow-sm">
                      {isSaving ? 'Saving...' : 'Save Note'}
                    </button>
                  </div>
                </div>
              ) : item.note ? (
                <div className="group relative bg-gray-800/30 border border-gray-700/50 rounded-xl p-4 hover:border-gray-600 transition-colors cursor-text" onClick={() => setIsEditingNote(true)}>
                  <p className="text-[14px] text-gray-300 leading-relaxed whitespace-pre-wrap">{item.note}</p>
                  <button className="absolute top-3 right-3 p-1.5 bg-gray-800 rounded-lg text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                  </button>
                </div>
              ) : (
                <button 
                  onClick={() => setIsEditingNote(true)}
                  className="w-full border-2 border-dashed border-gray-700 hover:border-gray-500 rounded-xl p-4 text-[13px] font-medium text-gray-400 hover:text-gray-300 transition-colors flex items-center justify-center"
                >
                  <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" /></svg>
                  Add a hint or memory hook
                </button>
              )}
            </div>

            {/* Review Progress Section */}
            <div className="pt-2">
              <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block mb-3 flex items-center">
                <svg className="w-3.5 h-3.5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                Study Progress
              </span>
              <div className="bg-gray-800/30 border border-gray-700/50 rounded-xl p-4 flex items-center justify-between">
                <div>
                  <p className="text-[13px] text-gray-300 font-medium">
                    {item.reviewCount ? `Reviewed ${item.reviewCount} time${item.reviewCount > 1 ? 's' : ''}` : 'Not reviewed yet'}
                  </p>
                  {item.lastReviewedAt && (
                    <p className="text-[11px] text-gray-500 mt-0.5">
                      Last review: {new Date(item.lastReviewedAt).toLocaleDateString()}
                    </p>
                  )}
                </div>
                <div className="flex items-center space-x-1.5 shrink-0">
                  <button
                    onClick={() => handleMarkReviewed('hard')}
                    className="px-2.5 py-1.5 bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/30 rounded text-[11px] font-bold transition-colors active:scale-95"
                  >
                    Hard
                  </button>
                  <button
                    onClick={() => handleMarkReviewed('medium')}
                    className="px-2.5 py-1.5 bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 border border-blue-500/30 rounded text-[11px] font-bold transition-colors active:scale-95"
                  >
                    Good
                  </button>
                  <button
                    onClick={() => handleMarkReviewed('easy')}
                    className="px-2.5 py-1.5 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/30 rounded text-[11px] font-bold transition-colors active:scale-95"
                  >
                    Easy
                  </button>
                </div>
              </div>
            </div>

          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-gray-800/80 border-t border-gray-700/60 flex items-center justify-between mt-auto">
          <button 
            onClick={handleRemove}
            className="flex items-center space-x-1.5 px-4 py-2.5 text-[13px] font-semibold text-red-400 hover:text-red-300 hover:bg-red-400/10 rounded-lg transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
            <span>Remove Word</span>
          </button>

          <span className="text-[11px] text-gray-500 font-medium">Added {new Date(item.createdAt).toLocaleDateString()}</span>
        </div>
      </div>
      <style>{`
        @keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
        @keyframes popIn { from { opacity: 0; transform: scale(0.95) translateY(10px); } to { opacity: 1; transform: scale(1) translateY(0); } }
        .animate-slide-up { animation: slideUp 0.3s cubic-bezier(0.2, 0.8, 0.2, 1) forwards; }
        .animate-pop-in { animation: popIn 0.2s cubic-bezier(0.2, 0.8, 0.2, 1) forwards; }
      `}</style>
    </div>
  );
};

export default VocabDetailPopup;
