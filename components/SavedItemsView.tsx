// components/SavedItemsView.tsx
import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, query, onSnapshot, doc, deleteDoc, updateDoc } from 'firebase/firestore';
import { UserProfile, SavedItem, SavedVocabularyItem } from '../types';
import ReviewMode from './ReviewMode';
import FlashcardMode from './FlashcardMode';
import VocabDetailPopup from './VocabDetailPopup';
import { getSuggestedItems } from '../utils/reviewLogic';

interface SavedItemsViewProps {
  user: UserProfile;
  onJumpToMessage?: (chatId: string, messageId: string) => void;
}

const SavedItemsView: React.FC<SavedItemsViewProps> = ({ user, onJumpToMessage }) => {
  const [items, setItems] = useState<SavedItem[]>([]);
  const [vocabItems, setVocabItems] = useState<SavedVocabularyItem[]>([]);
  const [activeTab, setActiveTab] = useState<'review_today' | 'phrasebook' | 'study_later' | 'vocabulary'>('review_today');
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [noteDraft, setNoteDraft] = useState('');
  const [reviewMode, setReviewMode] = useState(false);
  const [flashcardMode, setFlashcardMode] = useState(false);
  const [selectedVocabItemId, setSelectedVocabItemId] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [filterSender, setFilterSender] = useState<string>('all');
  const [filterChat, setFilterChat] = useState<string>('all');
  const [filterReviewed, setFilterReviewed] = useState<string>('all');

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
  
  const uniqueSenders = Array.from(new Set(items.map(i => i.senderName))).filter(Boolean);
  const uniqueChats = Array.from(new Set(items.map(i => i.partnerName))).filter(Boolean);

  const applyFilters = (itemList: SavedItem[]) => {
    return itemList.filter(item => {
      const matchSearch = !searchQuery || 
        item.text.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.translation?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.note?.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchSender = filterSender === 'all' || item.senderName === filterSender;
      const matchChat = filterChat === 'all' || item.partnerName === filterChat;

      return matchSearch && matchSender && matchChat;
    });
  };

  const displayedPhrasebookItems = applyFilters(phrasebookItems);
  const displayedStudyLaterItems = applyFilters(studyLaterItems);
  
  const filteredItems = activeTab === 'phrasebook' ? displayedPhrasebookItems : displayedStudyLaterItems;

  const displayedVocabItemsRaw = vocabItems.filter(item => {
    const matchSearch = !searchQuery || 
      item.word.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.translation?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.meanings?.some(m => m.definition.toLowerCase().includes(searchQuery.toLowerCase())) ||
      item.note?.toLowerCase().includes(searchQuery.toLowerCase());
      
    const isReviewed = item.reviewCount && item.reviewCount > 0;
    const matchReviewed = filterReviewed === 'all' 
      || (filterReviewed === 'reviewed' && isReviewed)
      || (filterReviewed === 'unreviewed' && !isReviewed);

    return matchSearch && matchReviewed;
  });

  const displayedVocabItems = displayedVocabItemsRaw;

  // Review Today Logic
  const isVocab = (item: SavedItem | SavedVocabularyItem): item is SavedVocabularyItem => 'word' in item;
  const allReviewableItems = [...phrasebookItems, ...vocabItems];
  const reviewTodayItems = activeTab === 'review_today' ? getSuggestedItems(allReviewableItems, 15) : [];

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

  // Review mode items: review targets filtered phrasebook items, or suggested phrases if on default tab
  const reviewItems = activeTab === 'review_today' 
    ? reviewTodayItems.filter(i => !isVocab(i)) as SavedItem[] 
    : displayedPhrasebookItems;

  if (flashcardMode) {
    return <FlashcardMode items={reviewItems} userId={user.id} onClose={() => setFlashcardMode(false)} />;
  }

  if (reviewMode) {
    return <ReviewMode items={reviewItems} userId={user.id} onClose={() => setReviewMode(false)} />;
  }

  return (
    <div className="flex flex-col h-full bg-surface-main text-theme-text">
      {/* Header & Tabs */}
      <div className="flex-none bg-surface-main/80 backdrop-blur-xl border-b border-theme-border p-4 pt-[max(1rem,env(safe-area-inset-top))]">
        <div className="flex items-center justify-between mb-4 px-2">
          <div>
            <h2 className="text-xl font-extrabold">Study Library</h2>
            <p className="text-xs text-theme-muted mt-0.5">Phrases, vocabulary &amp; review items from your chats</p>
          </div>
          {reviewItems.length > 0 && activeTab !== 'study_later' && activeTab !== 'vocabulary' && (
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
        <div className="flex space-x-2 bg-surface-card p-1 rounded-xl overflow-x-auto">
          <button
            onClick={() => setActiveTab('review_today')}
            className={`flex-1 min-w-[120px] py-2 text-sm font-semibold rounded-lg transition-colors flex items-center justify-center space-x-1.5 ${
              activeTab === 'review_today' ? 'bg-surface-hover text-amber-400 shadow-sm' : 'text-theme-muted hover:text-theme-text'
            }`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
            <span>Review Today</span>
            {activeTab !== 'review_today' && (
              <div className="w-2 h-2 rounded-full bg-amber-500/80 animate-pulse ml-1"></div>
            )}
          </button>
          <button
            onClick={() => setActiveTab('phrasebook')}
            className={`flex-1 min-w-[110px] py-2 text-sm font-semibold rounded-lg transition-colors flex items-center justify-center space-x-1.5 ${
              activeTab === 'phrasebook' ? 'bg-surface-hover text-emerald-400 shadow-sm' : 'text-theme-muted hover:text-theme-text'
            }`}
          >
            <span>Phrasebook</span>
            {phrasebookItems.length > 0 && (
              <span className={`text-[10px] font-bold min-w-[18px] h-[18px] flex items-center justify-center rounded-full ${
                activeTab === 'phrasebook' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-surface-hover text-theme-muted'
              }`}>
                {phrasebookItems.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('study_later')}
            className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-colors flex items-center justify-center space-x-1.5 ${
              activeTab === 'study_later' ? 'bg-surface-hover text-purple-400 shadow-sm' : 'text-theme-muted hover:text-theme-text'
            }`}
          >
            <span>Study Later</span>
            {studyLaterItems.length > 0 && (
              <span className={`text-[10px] font-bold min-w-[18px] h-[18px] flex items-center justify-center rounded-full ${
                activeTab === 'study_later' ? 'bg-purple-500/20 text-purple-400' : 'bg-surface-hover text-theme-muted'
              }`}>
                {studyLaterItems.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('vocabulary')}
            className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-colors flex items-center justify-center space-x-1.5 ${
              activeTab === 'vocabulary' ? 'bg-surface-hover text-blue-400 shadow-sm' : 'text-theme-muted hover:text-theme-text'
            }`}
          >
            <span>Vocabulary</span>
            {vocabItems.length > 0 && (
              <span className={`text-[10px] font-bold min-w-[18px] h-[18px] flex items-center justify-center rounded-full ${
                activeTab === 'vocabulary' ? 'bg-blue-500/20 text-blue-400' : 'bg-surface-hover text-theme-muted'
              }`}>
                {vocabItems.length}
              </span>
            )}
          </button>
        </div>

        {/* Search & Filter Bar (hidden in Review Today) */}
        {activeTab !== 'review_today' && (
          <div className="mt-4 flex flex-col sm:flex-row space-y-3 sm:space-y-0 sm:space-x-3">
            <div className="relative flex-1 group">
              <svg className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 transition-colors ${searchQuery ? 'text-theme-text' : 'text-theme-muted'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
            <input
              type="text"
              placeholder={activeTab === 'vocabulary' ? "Search vocabulary..." : "Search saved items..."}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={`w-full bg-surface-main border text-theme-text text-sm rounded-xl pl-9 pr-10 py-2.5 outline-none transition-colors shadow-sm placeholder-theme-muted focus:ring-1 ${
                activeTab === 'vocabulary' ? 'border-theme-border focus:border-blue-500 focus:ring-blue-500' : 
                activeTab === 'study_later' ? 'border-theme-border focus:border-purple-500 focus:ring-purple-500' : 
                'border-theme-border focus:border-emerald-500 focus:ring-emerald-500'
              }`}
            />
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-theme-muted hover:text-theme-text bg-surface-card hover:bg-surface-hover rounded-full transition-colors"
                title="Clear search"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12"/></svg>
              </button>
            )}
          </div>
          
          <div className="flex space-x-3">
            {activeTab !== 'vocabulary' ? (
              <>
                <select 
                  value={filterSender} 
                  onChange={(e) => setFilterSender(e.target.value)}
                  className={`text-[13px] rounded-xl px-3 py-2.5 outline-none cursor-pointer w-full sm:w-auto min-w-[130px] shadow-sm font-medium transition-colors ${
                    filterSender !== 'all' 
                      ? (activeTab === 'study_later' ? 'bg-purple-500/10 border border-purple-500/50 text-purple-400 focus:border-purple-500' : 'bg-emerald-500/10 border border-emerald-500/50 text-emerald-400 focus:border-emerald-500')
                      : `bg-surface-main border border-theme-border text-theme-text ${activeTab === 'study_later' ? 'focus:border-purple-500' : 'focus:border-emerald-500'}`
                  }`}
                >
                  <option value="all">All Senders</option>
                  {uniqueSenders.map(sender => (
                    <option key={sender} value={sender}>{sender}</option>
                  ))}
                </select>

                <select 
                  value={filterChat} 
                  onChange={(e) => setFilterChat(e.target.value)}
                  className={`text-[13px] rounded-xl px-3 py-2.5 outline-none cursor-pointer w-full sm:w-auto min-w-[130px] shadow-sm font-medium transition-colors ${
                    filterChat !== 'all' 
                      ? (activeTab === 'study_later' ? 'bg-purple-500/10 border border-purple-500/50 text-purple-400 focus:border-purple-500' : 'bg-emerald-500/10 border border-emerald-500/50 text-emerald-400 focus:border-emerald-500')
                      : `bg-surface-main border border-theme-border text-theme-text ${activeTab === 'study_later' ? 'focus:border-purple-500' : 'focus:border-emerald-500'}`
                  }`}
                >
                  <option value="all">All Chats</option>
                  {uniqueChats.map(chat => (
                    <option key={chat} value={chat}>{chat}</option>
                  ))}
                </select>
              </>
            ) : (
              <select 
                value={filterReviewed} 
                onChange={(e) => setFilterReviewed(e.target.value)}
                className={`text-[13px] rounded-xl px-3 py-2.5 outline-none cursor-pointer w-full sm:w-auto min-w-[140px] shadow-sm font-medium transition-colors ${
                  filterReviewed !== 'all' 
                    ? 'bg-blue-500/10 border border-blue-500/50 text-blue-400 focus:border-blue-500' 
                    : 'bg-surface-main border border-theme-border text-theme-text focus:border-blue-500'
                }`}
              >
                <option value="all">All Words</option>
                <option value="reviewed">Reviewed</option>
                <option value="unreviewed">Unreviewed</option>
              </select>
            )}
          </div>
        </div>
        )}
      </div>

      {/* List Area */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="max-w-3xl mx-auto space-y-4 pb-20">
          
          {activeTab === 'review_today' ? (
            reviewTodayItems.length === 0 ? (
              <div className="text-center py-16 px-4">
                <div className="w-16 h-16 bg-surface-card rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-amber-500/50" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                </div>
                <h3 className="text-lg font-semibold text-theme-text mb-2">You are all caught up!</h3>
                <p className="text-theme-muted text-sm">There are no pending high-priority items to review right now.</p>
              </div>
            ) : (
              reviewTodayItems.map(item => (
                <div key={item.id} className="bg-surface-card border border-amber-500/20 rounded-2xl p-4 shadow-sm transition-all hover:border-amber-500/50 relative overflow-hidden flex flex-col group cursor-pointer"
                  onClick={() => {
                    if (isVocab(item)) { setSelectedVocabItemId(item.id); }
                  }}
                >
                  {/* Type Badge */}
                  <div className="absolute top-0 right-0 px-3 py-1 bg-surface-main/80 rounded-bl-xl border-l border-b border-theme-border/50 flex items-center space-x-1.5">
                    {item.lastReviewedAt && (Date.now() - item.lastReviewedAt) / (1000 * 60 * 60 * 24) > 30 && (
                      <span className="text-[9px] font-bold text-red-400 bg-red-500/10 border border-red-500/30 px-1.5 py-0.5 rounded uppercase tracking-wider animate-pulse">
                        Forgotten?
                      </span>
                    )}
                    {item.difficulty && (
                      <span className={`text-[9px] font-bold uppercase ${
                        item.difficulty === 'hard' ? 'text-red-400' :
                        item.difficulty === 'medium' ? 'text-blue-400' :
                        'text-emerald-400'
                      }`}>
                        {item.difficulty}
                      </span>
                    )}
                    <span className="text-[10px] font-bold text-theme-muted uppercase tracking-wider">
                      {isVocab(item) ? 'Vocab' : 'Phrase'}
                    </span>
                  </div>

                  <div className="pr-20 mb-3">
                    <h4 className="text-xl font-bold text-theme-text uppercase tracking-wide">
                      {isVocab(item) ? item.word : item.text}
                    </h4>
                    {isVocab(item) && item.phonetic && <span className="text-sm font-mono text-theme-muted ml-2">{item.phonetic}</span>}
                  </div>

                  <div className="mb-4 flex-1">
                    <p className="text-[14px] text-theme-text">
                      {isVocab(item) ? (item.meanings?.[0]?.definition || item.translation) : item.translation}
                    </p>
                  </div>

                  <div className="mt-auto pt-3 border-t border-theme-border/50 flex items-center justify-between text-[11px] text-theme-muted">
                    <div className="flex items-center space-x-2">
                      {item.reviewCount ? (
                        <span className="text-emerald-500/80 font-semibold border-r border-theme-border pr-2">
                          Reviews: {item.reviewCount}
                        </span>
                      ) : (
                        <span className="text-amber-500/80 font-semibold border-r border-theme-border pr-2">
                          Never reviewed
                        </span>
                      )}
                      {item.lastReviewedAt && (
                        <span>Last: {formatDate(item.lastReviewedAt)}</span>
                      )}
                    </div>
                    {isVocab(item) && (
                      <button 
                        onClick={(e) => { e.stopPropagation(); setSelectedVocabItemId(item.id); }}
                        className="text-amber-400 hover:text-amber-300 font-bold px-3 py-1.5 bg-amber-500/10 rounded transition-colors"
                      >
                        Study
                      </button>
                    )}
                  </div>
                </div>
              ))
            )
          ) : activeTab === 'vocabulary' ? (
            displayedVocabItems.length === 0 ? (
              <div className="text-center py-16 px-4">
                <div className="w-16 h-16 bg-surface-card rounded-full flex items-center justify-center mx-auto mb-4">
                  {searchQuery || filterReviewed !== 'all' ? (
                    <svg className="w-8 h-8 text-theme-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                  ) : (
                    <svg className="w-8 h-8 text-blue-500/50" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
                  )}
                </div>
                <h3 className="text-lg font-semibold text-theme-text mb-2">
                  {searchQuery || filterReviewed !== 'all' ? 'No results found' : 'No vocabulary saved'}
                </h3>
                <p className="text-theme-muted text-sm">
                  {searchQuery || filterReviewed !== 'all' 
                    ? 'Try adjusting your search or filters.' 
                    : 'Tap on words in your chats to translate and save them for later study.'}
                </p>
              </div>
            ) : (
              displayedVocabItems.map(item => (
                <div 
                  key={item.id} 
                  className="bg-surface-card border border-theme-border/50 rounded-2xl p-4 shadow-sm transition-all hover:border-[var(--accent-primary)]/30 cursor-pointer group"
                  onClick={() => setSelectedVocabItemId(item.id)}
                >
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex items-center space-x-3">
                      <h4 className="text-xl font-bold text-theme-text uppercase tracking-wide">{item.word}</h4>
                      {item.phonetic && <span className="text-sm font-mono text-theme-muted">{item.phonetic}</span>}
                    </div>
                    <button 
                      onClick={(e) => { e.stopPropagation(); handleRemove(item.id); }}
                      className="p-1.5 text-theme-muted hover:text-red-400 hover:bg-surface-hover/50 rounded-full transition-colors flex-shrink-0"
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
                    <div className="bg-surface-main/40 p-3 rounded-xl border-l-2 border-blue-500/50">
                      <div className="flex items-center space-x-2 mb-1">
                        {item.meanings[0].partOfSpeech && (
                          <span className="text-[10px] font-bold text-emerald-400/80 uppercase tracking-wider">{item.meanings[0].partOfSpeech}</span>
                        )}
                      </div>
                      <p className="text-sm text-theme-text line-clamp-2 leading-relaxed">{item.meanings[0].definition}</p>
                    </div>
                  )}
                  
                  <div className="mt-3 flex items-center justify-between text-[11px] text-theme-muted">
                    <div className="flex items-center space-x-2">
                      <span>Saved from chat with {item.sourceChatId ? 'partner' : 'user'}</span>
                      {item.difficulty && (
                        <span className={`text-[10px] font-bold uppercase border-l border-theme-border pl-2 ${
                          item.difficulty === 'hard' ? 'text-red-400' :
                          item.difficulty === 'medium' ? 'text-blue-400' :
                          'text-emerald-400'
                        }`}>
                          {item.difficulty}
                        </span>
                      )}
                      {item.reviewCount && item.reviewCount > 0 ? (
                        <span className="text-emerald-500/80 font-semibold border-l border-theme-border pl-2">
                          ✓ Reviewed ({item.reviewCount})
                        </span>
                      ) : null}
                      {item.sourceChatId && item.sourceMessageId && onJumpToMessage && (
                        <button 
                          onClick={(e) => { e.stopPropagation(); onJumpToMessage(item.sourceChatId, item.sourceMessageId); }}
                          className="text-[11px] font-semibold text-blue-400 hover:text-blue-300 transition-colors flex items-center ml-2 border-l border-theme-border pl-2"
                        >
                          <svg className="w-3 h-3 mr-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                          View Chat
                        </button>
                      )}
                    </div>
                    <span>{formatDate(item.createdAt)}</span>
                  </div>
                </div>
              ))
            )
          ) : filteredItems.length === 0 ? (
            <div className="text-center py-16 px-4">
              <div className="w-16 h-16 bg-surface-card rounded-full flex items-center justify-center mx-auto mb-4">
                {searchQuery || filterSender !== 'all' || filterChat !== 'all' ? (
                  <svg className="w-8 h-8 text-theme-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                ) : activeTab === 'phrasebook' ? (
                  <svg className="w-8 h-8 text-emerald-500/50" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
                ) : (
                  <svg className="w-8 h-8 text-purple-500/50" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                )}
              </div>
              <h3 className="text-lg font-semibold text-theme-text mb-2">
                {searchQuery || filterSender !== 'all' || filterChat !== 'all' 
                  ? 'No results found' 
                  : activeTab === 'phrasebook' ? 'Your phrasebook is empty' : 'Nothing to study later'}
              </h3>
              <p className="text-theme-muted text-sm">
                {searchQuery || filterSender !== 'all' || filterChat !== 'all'
                  ? 'Try adjusting your search or filters.'
                  : activeTab === 'phrasebook' 
                    ? 'Save useful phrases and sentences from your chats to review them here.' 
                    : 'Mark important messages in your chats to easily find them later.'}
              </p>
            </div>
          ) : (
            filteredItems.map(item => (
              <div key={item.id} className="bg-surface-card border border-theme-border/50 rounded-2xl p-4 shadow-sm transition-all hover:border-[var(--accent-primary)]/30">
                
                {/* Header Row */}
                <div className="flex justify-between items-start mb-3">
                  <div className="flex flex-col min-w-0">
                    <span className="text-xs font-bold text-theme-muted uppercase tracking-wider truncate">{item.senderName}</span>
                    <div className="flex items-center flex-wrap gap-x-2 mt-0.5">
                      {/* Original message time (preferred) with fallback to save time */}
                      <span className="text-[11px] text-theme-muted">
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
                        <span className="text-[11px] text-theme-muted flex items-center">
                          <svg className="w-3 h-3 mr-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" /></svg>
                          Chat with {item.partnerName}
                        </span>
                      )}
                      {item.difficulty && (
                        <span className={`text-[10px] font-bold uppercase flex items-center ${
                          item.difficulty === 'hard' ? 'text-red-400' :
                          item.difficulty === 'medium' ? 'text-blue-400' :
                          'text-emerald-400'
                        }`}>
                          <span className="w-1 h-1 rounded-full bg-gray-600 mx-2"></span>
                          {item.difficulty}
                        </span>
                      )}
                      {item.reviewCount ? (
                        <span className="text-[11px] text-emerald-500/80 font-semibold flex items-center">
                          <span className="w-1 h-1 rounded-full bg-gray-600 mx-2"></span>
                          ✓ Reviewed ({item.reviewCount})
                        </span>
                      ) : null}
                      {onJumpToMessage && (
                        <button 
                          onClick={(e) => { e.stopPropagation(); onJumpToMessage(item.chatId, item.messageId); }}
                          className="text-[11px] font-semibold text-blue-400 hover:text-blue-300 transition-colors flex items-center ml-2 border-l border-theme-border pl-2"
                        >
                          <svg className="w-3 h-3 mr-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                          View Chat
                        </button>
                      )}
                    </div>
                  </div>
                  <button 
                    onClick={() => handleRemove(item.id)}
                    className="p-1.5 text-theme-muted hover:text-red-400 hover:bg-surface-hover/50 rounded-full transition-colors flex-shrink-0 ml-2"
                    title="Remove saved item"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                  </button>
                </div>

                {/* Message Content */}
                <div className={`bg-surface-main/50 p-3 rounded-xl border-l-4 mb-3 ${
                  activeTab === 'phrasebook' ? 'border-emerald-500' : 'border-purple-500'
                }`}>
                  <p className="text-[15px] leading-relaxed break-words">{item.text}</p>
                </div>

                {/* Cached Translation (if available) */}
                {item.translation && (
                  <div className="bg-surface-main/30 px-3 py-2 rounded-lg border border-theme-border/30 mb-3">
                    <div className="flex items-center text-[10px] font-bold text-theme-muted uppercase tracking-wider mb-1">
                      <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" /></svg>
                      Translation
                    </div>
                    <p className="text-[14px] text-theme-text italic leading-relaxed break-words">{item.translation}</p>
                  </div>
                )}

                {/* Personal Note Section */}
                <div className="border-t border-theme-border pt-3">
                  {editingNoteId === item.id ? (
                    <div className="flex flex-col space-y-2 animate-fade-in">
                      <textarea
                        value={noteDraft}
                        onChange={(e) => setNoteDraft(e.target.value)}
                        placeholder="Add a personal note, translation, or memory hint..."
                        className="w-full bg-surface-main border border-theme-border rounded-xl p-3 text-sm text-theme-text focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 resize-none min-h-[80px]"
                        autoFocus
                      />
                      <div className="flex justify-end space-x-2">
                        <button onClick={cancelEditingNote} className="px-3 py-1.5 text-xs font-semibold text-theme-muted hover:text-theme-text transition-colors">
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
                          <div className="flex items-center text-xs font-bold text-theme-muted uppercase tracking-wider mb-1.5">
                            <svg className="w-3.5 h-3.5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                            Personal Note
                          </div>
                          <p className="text-sm text-theme-text italic bg-surface-main/30 p-2.5 rounded-lg border border-theme-border/50 break-words leading-relaxed mb-2">
                            {item.note}
                          </p>
                        </div>
                      ) : null}
                      
                      <button 
                        onClick={() => startEditingNote(item)}
                        className={`text-[12px] font-medium flex items-center transition-colors ${
                          item.note ? 'text-theme-muted hover:text-blue-400' : 'text-blue-400 hover:text-blue-300 bg-blue-500/10 hover:bg-blue-500/20 px-3 py-1.5 rounded-lg'
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