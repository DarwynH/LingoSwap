import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, query, orderBy, onSnapshot, doc, setDoc } from 'firebase/firestore';
import { UserProfile, ConversationPreview } from '../types';
import Avatar from './ui/Avatar';
import { formatLastSeen, isRecentlyOnline } from '../utils/presenceUtils';

interface ChatsListProps {
  user: UserProfile;
  onSelectChat: (partner: UserProfile, chatId: string) => void;
}

const ChatsList: React.FC<ChatsListProps> = ({ user, onSelectChat }) => {
  const [conversations, setConversations] = useState<ConversationPreview[]>([]);
  const [presenceStatuses, setPresenceStatuses] = useState<Map<string, any>>(new Map());
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  // Fetch conversations
  useEffect(() => {
    const q = query(
      collection(db, "users", user.id, "conversations"),
      orderBy("timestamp", "desc")
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const convos = snapshot.docs.map(doc => doc.data() as ConversationPreview);
      setConversations(convos);
    });

    return () => unsubscribe();
  }, [user.id]);

  // Fetch presence for all conversation partners
  useEffect(() => {
    const unsubscribes: (() => void)[] = [];
    
    conversations.forEach(conv => {
      const partnerRef = doc(db, 'users', conv.partnerId);
      const unsubscribe = onSnapshot(partnerRef, (doc) => {
        if (doc.exists()) {
          setPresenceStatuses(prev => new Map(prev).set(conv.partnerId, doc.data()));
        }
      });
      unsubscribes.push(unsubscribe);
    });

    return () => unsubscribes.forEach(unsub => unsub());
  }, [conversations]);

  // Click outside to close action menu
  useEffect(() => {
    const handleClickOutside = () => setOpenMenuId(null);
    if (openMenuId) {
      document.addEventListener('click', handleClickOutside);
    }
    return () => document.removeEventListener('click', handleClickOutside);
  }, [openMenuId]);

  const getPresenceDisplay = (partnerId: string) => {
    const status = presenceStatuses.get(partnerId);
    if (!status) return null;
    
    const isOnline = isRecentlyOnline(status.isOnline, status.lastSeen);
    const showActiveStatus = status.showActiveStatus !== false;
    
    return {
      isOnline,
      lastSeenText: formatLastSeen(status.lastSeen, status.isOnline, showActiveStatus)
    };
  };

  const handleAction = async (e: React.MouseEvent, action: string, conv: ConversationPreview) => {
    e.stopPropagation();
    setOpenMenuId(null);
    const userConvRef = doc(db, 'users', user.id, 'conversations', conv.partnerId);

    try {
      switch (action) {
        case 'pin':
          await setDoc(userConvRef, { pinned: !conv.pinned, pinnedAt: !conv.pinned ? Date.now() : null }, { merge: true });
          break;
        case 'mute':
          await setDoc(userConvRef, { muted: !conv.muted, mutedAt: !conv.muted ? Date.now() : null }, { merge: true });
          break;
        case 'read':
          await setDoc(userConvRef, { unreadCount: 0 }, { merge: true });
          break;
        case 'clear':
          if (window.confirm(`Clear chat with ${conv.partnerName}?`)) {
            await setDoc(userConvRef, { clearedAt: Date.now() }, { merge: true });
          }
          break;
        case 'delete':
          if (window.confirm(`Delete chat with ${conv.partnerName}?`)) {
            await setDoc(userConvRef, { deletedAt: Date.now() }, { merge: true });
          }
          break;
        case 'block':
          if (window.confirm(`Block ${conv.partnerName}?`)) {
            const blockRef = doc(db, 'users', user.id, 'blockedUsers', conv.partnerId);
            await setDoc(blockRef, { blockedAt: Date.now(), partnerId: conv.partnerId, partnerName: conv.partnerName });
          }
          break;
      }
    } catch (err) {
      console.error("Action failed", err);
    }
  };

  const visibleConversations = conversations
    .filter(conv => {
      if (conv.deletedAt && conv.timestamp <= conv.deletedAt) {
        return false;
      }
      return true;
    })
    .sort((a, b) => {
      if (a.pinned && !b.pinned) return -1;
      if (!a.pinned && b.pinned) return 1;
      return b.timestamp - a.timestamp;
    });

  return (
    <div className="flex-1 flex flex-col h-full bg-surface-main">
      <header className="bg-surface-card/80 backdrop-blur-md border-b border-theme-border p-4">
        <h1 className="text-xl font-bold text-theme-text">Your Conversations</h1>
        <p className="text-xs text-theme-muted mt-1">Chat with your language partners</p>
      </header>

      {/* FIXED SCROLLING ISSUE HERE: Added pb-24 md:pb-0 */}
      <div className="flex-1 overflow-y-auto pb-24 md:pb-0">
        <div className="divide-y divide-theme-border">
          {visibleConversations.map((conv) => {
            const presence = getPresenceDisplay(conv.partnerId);
            
            let displayMessage = conv.lastMessage;
            if (conv.clearedAt && conv.timestamp <= conv.clearedAt) {
              displayMessage = "Empty chat";
            }
            
            return (
              <div key={conv.partnerId} className="relative group">
                <button
                  onClick={() => {
                    const chatId = [user.id, conv.partnerId].sort().join('_');
                    const mockPartnerProfile = {
                      id: conv.partnerId,
                      name: conv.partnerName,
                      avatar: conv.partnerAvatar,
                    } as UserProfile;
                    onSelectChat(mockPartnerProfile, chatId);
                  }}
                  className={`w-full bg-transparent p-4 hover:bg-surface-hover transition-colors flex items-center space-x-4 text-left ${conv.pinned ? 'bg-surface-hover/30' : ''}`}
                >
                  <div className="relative">
                    <Avatar src={conv.partnerAvatar} />
                    {presence?.isOnline && (
                      <span className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-[#25d366] border-2 border-surface-main rounded-full animate-pulse" />
                    )}
                  </div>
                  
                  <div className="flex-1 min-w-0 pr-8">
                    <div className="flex justify-between items-baseline">
                      <h4 className="font-bold text-theme-text truncate flex items-center gap-1.5">
                        {conv.partnerName}
                        {conv.muted && (
                          <svg className="w-3 h-3 text-theme-muted" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.707.707L4.586 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.586l3.707-3.707a1 1 0 011.09-.217zM12.293 7.293a1 1 0 011.414 0L15 8.586l1.293-1.293a1 1 0 111.414 1.414L16.414 10l1.293 1.293a1 1 0 01-1.414 1.414L15 11.414l-1.293 1.293a1 1 0 01-1.414-1.414L13.586 10l-1.293-1.293a1 1 0 010-1.414z" clipRule="evenodd" />
                          </svg>
                        )}
                        {conv.pinned && (
                          <svg className="w-3 h-3 text-theme-muted" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                          </svg>
                        )}
                      </h4>
                      <span className={`text-xs ${conv.unreadCount > 0 ? 'text-[#25d366] font-bold' : 'text-theme-muted'}`}>
                        {new Date(conv.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    
                    <div className="flex justify-between items-center mt-1">
                      <div className="flex flex-col flex-1 min-w-0">
                        <p className={`text-sm truncate ${conv.unreadCount > 0 ? 'font-semibold text-theme-text' : 'text-theme-muted'} ${conv.clearedAt && conv.timestamp <= conv.clearedAt ? 'italic' : ''}`}>
                          {displayMessage}
                        </p>
                        {presence && !presence.isOnline && presence.lastSeenText && (
                          <p className="text-[10px] text-theme-muted mt-0.5 truncate">
                            {presence.lastSeenText}
                          </p>
                        )}
                      </div>
                      
                      {conv.unreadCount > 0 && (
                        <span className="ml-2 bg-[#25d366] text-white text-[10px] font-bold px-2 py-0.5 rounded-full min-w-[20px] text-center shadow-sm flex-shrink-0">
                          {conv.unreadCount}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
                
                {/* 3 dots menu button */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setOpenMenuId(openMenuId === conv.partnerId ? null : conv.partnerId);
                  }}
                  className="absolute right-4 top-1/2 -translate-y-1/2 p-2 rounded-full text-theme-muted hover:text-theme-text hover:bg-surface-card opacity-100 md:opacity-0 md:group-hover:opacity-100 focus:opacity-100 transition-opacity"
                >
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <circle cx="12" cy="5" r="2" />
                    <circle cx="12" cy="12" r="2" />
                    <circle cx="12" cy="19" r="2" />
                  </svg>
                </button>

                {/* Action Menu dropdown */}
                {openMenuId === conv.partnerId && (
                  <div className="absolute right-8 top-1/2 -translate-y-1/2 w-48 bg-surface-card border border-theme-border rounded-xl shadow-xl py-1 z-50">
                    <button onClick={(e) => handleAction(e, 'pin', conv)} className="w-full text-left px-4 py-2 text-sm text-theme-text hover:bg-surface-hover">
                      {conv.pinned ? 'Unpin chat' : 'Pin chat'}
                    </button>
                    <button onClick={(e) => handleAction(e, 'mute', conv)} className="w-full text-left px-4 py-2 text-sm text-theme-text hover:bg-surface-hover">
                      {conv.muted ? 'Unmute notifications' : 'Mute notifications'}
                    </button>
                    {conv.unreadCount > 0 && (
                      <button onClick={(e) => handleAction(e, 'read', conv)} className="w-full text-left px-4 py-2 text-sm text-theme-text hover:bg-surface-hover">
                        Mark as read
                      </button>
                    )}
                    <button onClick={(e) => handleAction(e, 'clear', conv)} className="w-full text-left px-4 py-2 text-sm text-red-500 hover:bg-red-500/10">
                      Clear chat
                    </button>
                    <button onClick={(e) => handleAction(e, 'block', conv)} className="w-full text-left px-4 py-2 text-sm text-red-500 hover:bg-red-500/10">
                      Block user
                    </button>
                    <button onClick={(e) => handleAction(e, 'delete', conv)} className="w-full text-left px-4 py-2 text-sm text-red-500 hover:bg-red-500/10">
                      Delete chat
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {visibleConversations.length === 0 && (
          <div className="flex flex-col items-center justify-center p-12 text-center">
            <div className="w-20 h-20 bg-surface-card rounded-full flex items-center justify-center mb-4">
              <svg className="w-10 h-10 text-theme-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </div>
            <h3 className="text-lg font-bold text-theme-text">No chats yet</h3>
            <p className="text-sm text-theme-muted mt-1">Start a conversation with a language partner!</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ChatsList;