// components/SavedItemsView.tsx
import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, query, onSnapshot, doc, deleteDoc, updateDoc } from 'firebase/firestore';
import { UserProfile, SavedItem, SavedVocabularyItem } from '../types';
import ReviewMode from './ReviewMode';
import FlashcardMode from './FlashcardMode';
import VocabDetailPopup from './VocabDetailPopup';

interface SavedItemsViewProps {
  user: UserProfile;
}

const SavedItemsView: React.FC<SavedItemsViewProps> = ({ user }) => {
  const [items, setItems] = useState<SavedItem[]>([]);
  const [vocabItems, setVocabItems] = useState<SavedVocabularyItem[]>([]);
  const [activeTab, setActiveTab] = useState<'phrasebook' | 'study_later' | 'vocabulary'>('phrasebook');
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [noteDraft, setNoteDraft] = useState('');
  const [reviewMode, setReviewMode] = useState(false);
  const [flashcardMode, setFlashcardMode] = useState(false);
  const [selectedVocabItemId, setSelectedVocabItemId] = useState<string | null>(null);

  useEffect(() => {
    // Fetch all saved message items
    const q = query(collection(db, 'users', user.id, 'savedItems'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedItems = snapshot.docs.map(doc => doc.data() as SavedItem);
      fetchedItems.sort((a, b) => b.timestamp - a.timestamp);
      setItems(fetchedItems);
    });

    // Fetch vocabulary
    const qVocab = query(collection(db, 'users', user.id, 'vocabulary'));
    const unsubscribeVocab = onSnapshot(qVocab, (snapshot) => {
      const fetchedVocab = snapshot.docs.map(doc => doc.data() as SavedVocabularyItem);
      fetchedVocab.sort((a, b) => b.createdAt - a.createdAt);
      setVocabItems(fetchedVocab);
    });

    return () => {
      unsubscribe();
      unsubscribeVocab();
    };
  }, [user.id]);

  const phrasebookItems = items.filter(item => item.type === 'phrasebook');
  const studyLaterItems = items.filter(item => item.type === 'study_later');
  const filteredItems = activeTab === 'phrasebook' ? phrasebookItems : studyLaterItems;

  const handleRemove = async (id: string) => {
    try {
      if (activeTab === 'vocabulary') {
        await deleteDoc(doc(db, 'users', user.id, 'vocabulary', id));
      } else {
        await deleteDoc(doc(db, 'users', user.id, 'savedItems', id));
      }
    } catch (error) {
      console.error("Failed to remove item", error);
    }
  };

  const startEditingNote = (item: SavedItem) => {
    setEditingNoteId(item.id);
    setNoteDraft(item.note || '');
  };

  const cancelEditingNote = () => {
    setEditingNoteId(null);
    setNoteDraft('');
  };

  const saveNote = async (id: string) => {
    try {
      await updateDoc(doc(db, 'users', user.id, 'savedItems', id), { note: noteDraft.trim() });
      setEditingNoteId(null);
      setNoteDraft('');
    } catch (error) {
      console.error("Failed to save note", error);
    }
  };

  // Helper: format a timestamp to a readable date string, with fallback for missing data
  const formatDate = (ts?: number) => {
    if (!ts) return null;
    return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const formatTime = (ts?: number) => {
    if (!ts) return null;
    return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  // Review mode items: currently review targets phrasebook items
  const reviewItems = phrasebookItems;

  if (flashcardMode) {
    return <FlashcardMode items={reviewItems} userId={user.id} onClose={() => setFlashcardMode(false)} />;
  }

  if (reviewMode) {
    return <ReviewMode items={reviewItems} userId={user.id} onClose={() => setReviewMode(false)} />;
  }

  return (
    <div className="flex flex-col h-full bg-gray-900 text-gray-100">
      {/* Header & Tabs */}
      <div className="flex-none bg-gray-900/80 backdrop-blur-xl border-b border-gray-800 p-4 pt-[max(1rem,env(safe-area-inset-top))]">
        <div className="flex items-center justify-between mb-4 px-2">
          <h2 className="text-xl font-bold">Saved Items</h2>
          {phrasebookItems.length > 0 && (
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setReviewMode(true)}
                className="flex items-center space-x-1.5 px-3.5 py-1.5 text-xs font-semibold bg-emerald-600 text-white rounded-lg hover:bg-emerald-500 transition-colors shadow-sm active:scale-95"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                <span>Review</span>
              </button>
              <button
                onClick={() => setFlashcardMode(true)}
                className="flex items-center space-x-1.5 px-3.5 py-1.5 text-xs font-semibold bg-amber-600 text-white rounded-lg hover:bg-amber-500 transition-colors shadow-sm active:scale-95"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
                <span>Flashcards</span>
              </button>
            </div>
          )}
        </div>
        <div className="flex space-x-2 bg-gray-800 p-1 rounded-xl">
          <button
            onClick={() => setActiveTab('phrasebook')}
            className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-colors flex items-center justify-center space-x-1.5 ${
              activeTab === 'phrasebook' ? 'bg-gray-700 text-emerald-400 shadow-sm' : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            <span>Phrasebook</span>
            {phrasebookItems.length > 0 && (
              <span className={`text-[10px] font-bold min-w-[18px] h-[18px] flex items-center justify-center rounded-full ${
                activeTab === 'phrasebook' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-gray-700 text-gray-500'
              }`}>
                {phrasebookItems.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('study_later')}
            className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-colors flex items-center justify-center space-x-1.5 ${
              activeTab === 'study_later' ? 'bg-gray-700 text-purple-400 shadow-sm' : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            <span>Study Later</span>
            {studyLaterItems.length > 0 && (
              <span className={`text-[10px] font-bold min-w-[18px] h-[18px] flex items-center justify-center rounded-full ${
                activeTab === 'study_later' ? 'bg-purple-500/20 text-purple-400' : 'bg-gray-700 text-gray-500'
              }`}>
                {studyLaterItems.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('vocabulary')}
            className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-colors flex items-center justify-center space-x-1.5 ${
              activeTab === 'vocabulary' ? 'bg-gray-700 text-blue-400 shadow-sm' : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            <span>Vocabulary</span>
            {vocabItems.length > 0 && (
              <span className={`text-[10px] font-bold min-w-[18px] h-[18px] flex items-center justify-center rounded-full ${
                activeTab === 'vocabulary' ? 'bg-blue-500/20 text-blue-400' : 'bg-gray-700 text-gray-500'
              }`}>
                {vocabItems.length}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* List Area */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="max-w-3xl mx-auto space-y-4 pb-20">
          
          {activeTab === 'vocabulary' ? (
            vocabItems.length === 0 ? (
              <div className="text-center py-16 px-4">
                <div className="w-16 h-16 bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-blue-500/50" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
                </div>
                <h3 className="text-lg font-semibold text-gray-300 mb-2">No vocabulary saved</h3>
                <p className="text-gray-500 text-sm">Tap on words in your chats to translate and save them for later study.</p>
              </div>
            ) : (
              vocabItems.map(item => (
                <div 
                  key={item.id} 
                  className="bg-gray-800 border border-gray-700/50 rounded-2xl p-4 shadow-sm transition-all hover:border-gray-600 cursor-pointer group"
                  onClick={() => setSelectedVocabItemId(item.id)}
                >
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex items-center space-x-3">
                      <h4 className="text-xl font-bold text-gray-100 uppercase tracking-wide">{item.word}</h4>
                      {item.phonetic && <span className="text-sm font-mono text-gray-400">{item.phonetic}</span>}
                    </div>
                    <button 
                      onClick={(e) => { e.stopPropagation(); handleRemove(item.id); }}
                      className="p-1.5 text-gray-500 hover:text-red-400 hover:bg-gray-700/50 rounded-full transition-colors flex-shrink-0"
                      title="Remove word"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                    </button>
                  </div>
                  
                  {item.translation && item.translation.toLowerCase() !== item.word.toLowerCase() && (
                    <div className="mb-3">
                      <span className="text-[14px] font-medium text-blue-300">{item.translation}</span>
                    </div>
                  )}

                  {item.meanings && item.meanings.length > 0 && (
                    <div className="bg-gray-900/40 p-3 rounded-xl border-l-2 border-blue-500/50">
                      <div className="flex items-center space-x-2 mb-1">
                        {item.meanings[0].partOfSpeech && (
                          <span className="text-[10px] font-bold text-emerald-400/80 uppercase tracking-wider">{item.meanings[0].partOfSpeech}</span>
                        )}
                      </div>
                      <p className="text-sm text-gray-300 line-clamp-2 leading-relaxed">{item.meanings[0].definition}</p>
                    </div>
                  )}
                  
                  <div className="mt-3 flex items-center justify-between text-[11px] text-gray-500">
                    <span>Saved from chat with {item.sourceChatId ? 'partner' : 'user'}</span>
                    <span>{formatDate(item.createdAt)}</span>
                  </div>
                </div>
              ))
            )
          ) : filteredItems.length === 0 ? (
            <div className="text-center py-16 px-4">
              <div className="w-16 h-16 bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4">
                {activeTab === 'phrasebook' ? (
                  <svg className="w-8 h-8 text-emerald-500/50" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
                ) : (
                  <svg className="w-8 h-8 text-purple-500/50" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                )}
              </div>
              <h3 className="text-lg font-semibold text-gray-300 mb-2">
                {activeTab === 'phrasebook' ? 'Your phrasebook is empty' : 'Nothing to study later'}
              </h3>
              <p className="text-gray-500 text-sm">
                {activeTab === 'phrasebook' 
                  ? 'Save useful phrases and sentences from your chats to review them here.' 
                  : 'Mark important messages in your chats to easily find them later.'}
              </p>
            </div>
          ) : (
            filteredItems.map(item => (
              <div key={item.id} className="bg-gray-800 border border-gray-700/50 rounded-2xl p-4 shadow-sm transition-all hover:border-gray-600">
                
                {/* Header Row */}
                <div className="flex justify-between items-start mb-3">
                  <div className="flex flex-col min-w-0">
                    <span className="text-xs font-bold text-gray-400 uppercase tracking-wider truncate">{item.senderName}</span>
                    <div className="flex items-center flex-wrap gap-x-2 mt-0.5">
                      {/* Original message time (preferred) with fallback to save time */}
                      <span className="text-[11px] text-gray-500">
                        {item.originalTimestamp ? (
                          <>
                            <span title="Message sent">{formatDate(item.originalTimestamp)} • {formatTime(item.originalTimestamp)}</span>
                          </>
                        ) : (
                          <>
                            {formatDate(item.timestamp)} • {formatTime(item.timestamp)}
                          </>
                        )}
                      </span>
                      {/* Conversation context */}
                      {item.partnerName && (
                        <span className="text-[11px] text-gray-600 flex items-center">
                          <svg className="w-3 h-3 mr-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" /></svg>
                          Chat with {item.partnerName}
                        </span>
                      )}
                    </div>
                  </div>
                  <button 
                    onClick={() => handleRemove(item.id)}
                    className="p-1.5 text-gray-500 hover:text-red-400 hover:bg-gray-700/50 rounded-full transition-colors flex-shrink-0 ml-2"
                    title="Remove saved item"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                  </button>
                </div>

                {/* Message Content */}
                <div className={`bg-gray-900/50 p-3 rounded-xl border-l-4 mb-3 ${
                  activeTab === 'phrasebook' ? 'border-emerald-500' : 'border-purple-500'
                }`}>
                  <p className="text-[15px] leading-relaxed break-words">{item.text}</p>
                </div>

                {/* Cached Translation (if available) */}
                {item.translation && (
                  <div className="bg-gray-900/30 px-3 py-2 rounded-lg border border-gray-700/30 mb-3">
                    <div className="flex items-center text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">
                      <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" /></svg>
                      Translation
                    </div>
                    <p className="text-[14px] text-gray-300 italic leading-relaxed break-words">{item.translation}</p>
                  </div>
                )}

                {/* Personal Note Section */}
                <div className="border-t border-gray-700 pt-3">
                  {editingNoteId === item.id ? (
                    <div className="flex flex-col space-y-2 animate-fade-in">
                      <textarea
                        value={noteDraft}
                        onChange={(e) => setNoteDraft(e.target.value)}
                        placeholder="Add a personal note, translation, or memory hint..."
                        className="w-full bg-gray-900 border border-gray-700 rounded-xl p-3 text-sm text-gray-200 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 resize-none min-h-[80px]"
                        autoFocus
                      />
                      <div className="flex justify-end space-x-2">
                        <button onClick={cancelEditingNote} className="px-3 py-1.5 text-xs font-semibold text-gray-400 hover:text-gray-200 transition-colors">
                          Cancel
                        </button>
                        <button onClick={() => saveNote(item.id)} className="px-4 py-1.5 text-xs font-semibold bg-blue-600 text-white rounded-lg hover:bg-blue-500 transition-colors shadow-sm">
                          Save Note
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="group flex flex-col items-start">
                      {item.note ? (
                        <div className="w-full">
                          <div className="flex items-center text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">
                            <svg className="w-3.5 h-3.5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                            Personal Note
                          </div>
                          <p className="text-sm text-gray-300 italic bg-gray-900/30 p-2.5 rounded-lg border border-gray-700/50 break-words leading-relaxed mb-2">
                            {item.note}
                          </p>
                        </div>
                      ) : null}
                      
                      <button 
                        onClick={() => startEditingNote(item)}
                        className={`text-[12px] font-medium flex items-center transition-colors ${
                          item.note ? 'text-gray-500 hover:text-blue-400' : 'text-blue-400 hover:text-blue-300 bg-blue-500/10 hover:bg-blue-500/20 px-3 py-1.5 rounded-lg'
                        }`}
                      >
                        {item.note ? 'Edit Note' : '+ Add personal note'}
                      </button>
                    </div>
                  )}
                </div>

              </div>
            ))
          )}
        </div>
      </div>
      
      {/* Word Detail Popup Context */}
      {selectedVocabItemId && (() => {
        const activeItem = vocabItems.find(v => v.id === selectedVocabItemId);
        if (!activeItem) return null;
        return (
          <VocabDetailPopup 
            item={activeItem} 
            onClose={() => setSelectedVocabItemId(null)} 
          />
        );
      })()}
    </div>
  );
};

export default SavedItemsView;