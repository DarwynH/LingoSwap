import React, { useEffect, useState } from 'react';
import { db } from '../../firebase';
import { doc, setDoc, deleteDoc, onSnapshot } from 'firebase/firestore';
import { DictionaryResult, SavedVocabularyItem } from '../../types';
import { lookupWord } from '../../services/dictionaryService';
import { recordActions } from '../../services/gamificationService';

interface WordActionPopupProps {
  word: string;
  userId: string;
  chatId?: string;
  messageId?: string;
  sourceText?: string;
  onClose: () => void;
}

const WordActionPopup: React.FC<WordActionPopupProps> = ({ 
  word, 
  userId,
  chatId,
  messageId,
  sourceText,
  onClose 
}) => {
  const [result, setResult] = useState<DictionaryResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSaved, setIsSaved] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    
    // Safety check
    if (!word) {
      setLoading(false);
      return;
    }

    lookupWord(word).then(data => {
      if (active) {
        setResult(data);
        setLoading(false);
      }
    });

    return () => { active = false; };
  }, [word]);

  // Listen to Firestore to check if word is already saved
  useEffect(() => {
    if (!word || !userId) return;
    const cleanWord = word.trim().toLowerCase();
    const docRef = doc(db, 'users', userId, 'vocabulary', cleanWord);
    
    const unsubscribe = onSnapshot(docRef, (docSnap) => {
      setIsSaved(docSnap.exists());
    });

    return () => unsubscribe();
  }, [word, userId]);

  const handleToggleSave = async () => {
    if (!result || !word) return;
    const cleanWord = word.trim().toLowerCase();
    const docRef = doc(db, 'users', userId, 'vocabulary', cleanWord);

    setIsSaving(true);
    try {
      if (isSaved) {
        await deleteDoc(docRef);
      } else {
        const cleanMeanings = (result.meanings || []).map(m => {
          const cleanM: any = { definition: m.definition || '' };
          if (m.partOfSpeech) cleanM.partOfSpeech = m.partOfSpeech;
          if (m.example) cleanM.example = m.example;
          return cleanM;
        });

        const vocabItem: any = {
          id: cleanWord,
          userId,
          word: cleanWord,
          meanings: cleanMeanings,
          sourceMessageId: messageId || '',
          sourceChatId: chatId || '',
          sourceText: sourceText || '',
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };

        if (result.translation) vocabItem.translation = result.translation;
        if (result.phonetic) vocabItem.phonetic = result.phonetic;

        await setDoc(docRef, vocabItem);
        recordActions(userId, [
          { xpAction: 'itemSaved', questUpdates: [{ questId: 'save_item', amount: 1 }] },
        ]).catch((e) => console.warn('Gamification update failed:', e));
      }
    } catch (err) {
      console.error('Failed to toggle vocabulary save:', err);
      alert('Could not update saved word.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm transition-opacity" onClick={onClose}>
      <div 
        className="w-full sm:w-[400px] max-h-[85vh] bg-gray-900 border-t sm:border border-gray-700/60 rounded-t-2xl sm:rounded-2xl shadow-2xl overflow-hidden flex flex-col mb-0 sm:mb-8 animate-slide-up sm:animate-pop-in" 
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex justify-between items-center p-4 border-b border-gray-800 bg-gray-800/50">
          <div>
            <h3 className="text-xl font-bold text-gray-100 uppercase tracking-wide">{word}</h3>
            {result?.phonetic && (
              <p className="text-sm text-gray-400 font-mono mt-0.5">{result.phonetic}</p>
            )}
          </div>
          <button onClick={onClose} className="p-2 bg-gray-800 hover:bg-gray-700 rounded-full text-gray-400 hover:text-white transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        {/* Body */}
        <div className="p-4 overflow-y-auto flex-1 overscroll-contain">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-10 space-y-4">
              <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
              <p className="text-sm text-gray-400 animate-pulse">Looking up dictionary...</p>
            </div>
          ) : !result || (result.meanings.length === 0 && !result.translation) ? (
            <div className="flex flex-col items-center justify-center py-10 text-center px-4">
              <svg className="w-12 h-12 text-gray-600 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
              <h4 className="text-gray-300 font-medium mb-1">No Definitions Found</h4>
              <p className="text-sm text-gray-500 leading-relaxed">We could not find a translation or dictionary entry for "{word}".</p>
            </div>
          ) : (
            <div className="space-y-5">
              {/* Translation block */}
              {result.translation && result.translation.toLowerCase() !== word.toLowerCase() && (
                <div className="bg-blue-900/20 border border-blue-500/20 rounded-xl p-3">
                  <span className="text-[10px] font-bold text-blue-400 uppercase tracking-wider block mb-1">DeepL Translation</span>
                  <p className="text-[15px] font-medium text-blue-100">{result.translation}</p>
                </div>
              )}

              {/* Meanings loop */}
              {result.meanings.length > 0 && (
                <div className="space-y-4">
                  {result.meanings.map((meaning, idx) => (
                    <div key={idx} className="relative pl-3 border-l-2 border-gray-700">
                      {meaning.partOfSpeech && (
                        <span className="inline-block text-[11px] font-semibold text-emerald-400 italic mb-1 bg-emerald-400/10 px-2 py-0.5 rounded">
                          {meaning.partOfSpeech}
                        </span>
                      )}
                      <p className="text-sm text-gray-200 leading-relaxed">{meaning.definition}</p>
                      {meaning.example && (
                        <p className="text-sm text-gray-500 mt-1.5 italic">"{meaning.example}"</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer actions */}
        {!loading && result && (
          <div className="p-4 bg-gray-800/80 border-t border-gray-700/60 mt-auto">
            <button 
              onClick={handleToggleSave}
              disabled={isSaving}
              className={`w-full py-2.5 rounded-lg text-sm font-semibold transition-colors flex items-center justify-center space-x-2 ${
                isSaved 
                  ? 'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/20' 
                  : 'bg-blue-600 hover:bg-blue-500 text-white shadow-sm'
              } ${isSaving ? 'opacity-50 cursor-wait' : ''}`}
            >
              {isSaved ? (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
                  <span>Saved to Vocabulary</span>
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
                  <span>Save Word</span>
                </>
              )}
            </button>
          </div>
        )}
      </div>
      
      <style>{`
        @keyframes slideUp {
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
        }
        @keyframes popIn {
          from { opacity: 0; transform: scale(0.95) translateY(10px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }
        .animate-slide-up { animation: slideUp 0.3s cubic-bezier(0.2, 0.8, 0.2, 1) forwards; }
        .animate-pop-in { animation: popIn 0.2s cubic-bezier(0.2, 0.8, 0.2, 1) forwards; }
      `}</style>
    </div>
  );
};

export default WordActionPopup;
