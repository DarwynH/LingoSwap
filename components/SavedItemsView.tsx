// components/SavedItemsView.tsx
import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, query, onSnapshot, doc, deleteDoc, updateDoc } from 'firebase/firestore';
import { UserProfile, SavedItem } from '../types';

interface SavedItemsViewProps {
  user: UserProfile;
}

const SavedItemsView: React.FC<SavedItemsViewProps> = ({ user }) => {
  const [items, setItems] = useState<SavedItem[]>([]);
  const [activeTab, setActiveTab] = useState<'phrasebook' | 'study_later'>('phrasebook');
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [noteDraft, setNoteDraft] = useState('');

  useEffect(() => {
    // Fetch all saved items for the current user
    const q = query(collection(db, 'users', user.id, 'savedItems'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedItems = snapshot.docs.map(doc => doc.data() as SavedItem);
      // Sort in memory by newest first to avoid needing a composite index in Firestore initially
      fetchedItems.sort((a, b) => b.timestamp - a.timestamp);
      setItems(fetchedItems);
    });

    return () => unsubscribe();
  }, [user.id]);

  const filteredItems = items.filter(item => item.type === activeTab);

  const handleRemove = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'users', user.id, 'savedItems', id));
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

  return (
    <div className="flex flex-col h-full bg-gray-900 text-gray-100">
      {/* Header & Tabs */}
      <div className="flex-none bg-gray-900/80 backdrop-blur-xl border-b border-gray-800 p-4 pt-[max(1rem,env(safe-area-inset-top))]">
        <h2 className="text-xl font-bold mb-4 px-2">Saved Items</h2>
        <div className="flex space-x-2 bg-gray-800 p-1 rounded-xl">
          <button
            onClick={() => setActiveTab('phrasebook')}
            className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-colors ${
              activeTab === 'phrasebook' ? 'bg-gray-700 text-emerald-400 shadow-sm' : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            Phrasebook
          </button>
          <button
            onClick={() => setActiveTab('study_later')}
            className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-colors ${
              activeTab === 'study_later' ? 'bg-gray-700 text-purple-400 shadow-sm' : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            Study Later
          </button>
        </div>
      </div>

      {/* List Area */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="max-w-3xl mx-auto space-y-4 pb-20">
          {filteredItems.length === 0 ? (
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
                  <div className="flex flex-col">
                    <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">{item.senderName}</span>
                    <span className="text-[11px] text-gray-500 mt-0.5">
                      {new Date(item.timestamp).toLocaleDateString()} • {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <button 
                    onClick={() => handleRemove(item.id)}
                    className="p-1.5 text-gray-500 hover:text-red-400 hover:bg-gray-700/50 rounded-full transition-colors"
                    title="Remove saved item"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                  </button>
                </div>

                {/* Message Content */}
                <div className="bg-gray-900/50 p-3 rounded-xl border-l-4 border-blue-500 mb-4">
                  <p className="text-[15px] leading-relaxed break-words">{item.text}</p>
                </div>

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
    </div>
  );
};

export default SavedItemsView;