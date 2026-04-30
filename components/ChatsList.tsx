import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, query, orderBy, onSnapshot, doc } from 'firebase/firestore';
import { UserProfile, ConversationPreview } from '../types';
import Avatar from './ui/Avatar';
import { formatLastSeen } from '../hooks/usePresence';

interface ChatsListProps {
  user: UserProfile;
  onSelectChat: (partner: UserProfile, chatId: string) => void;
}

const ChatsList: React.FC<ChatsListProps> = ({ user, onSelectChat }) => {
  const [conversations, setConversations] = useState<ConversationPreview[]>([]);
  const [presenceStatuses, setPresenceStatuses] = useState<Map<string, any>>(new Map());

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

  const getPresenceDisplay = (partnerId: string) => {
    const status = presenceStatuses.get(partnerId);
    if (!status) return null;
    
    const isOnline = status.isOnline && (Date.now() - (status.lastSeen || 0) < 120000);
    const showActiveStatus = status.showActiveStatus !== false;
    
    return {
      isOnline,
      lastSeenText: formatLastSeen(status.lastSeen, isOnline, showActiveStatus)
    };
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-[#0f172a]">
      <header className="bg-[#1e293b]/80 backdrop-blur-md border-b border-slate-700/50 p-4">
        <h1 className="text-xl font-bold text-slate-100">Your Conversations</h1>
        <p className="text-xs text-slate-400 mt-1">Chat with your language partners</p>
      </header>

      {/* FIXED SCROLLING ISSUE HERE: Added pb-24 md:pb-0 */}
      <div className="flex-1 overflow-y-auto pb-24 md:pb-0">
        <div className="divide-y divide-slate-800/50">
          {conversations.map((conv) => {
            const presence = getPresenceDisplay(conv.partnerId);
            
            return (
              <button
                key={conv.partnerId}
                onClick={() => {
                  const chatId = [user.id, conv.partnerId].sort().join('_');
                  const mockPartnerProfile = {
                    id: conv.partnerId,
                    name: conv.partnerName,
                    avatar: conv.partnerAvatar,
                  } as UserProfile;
                  onSelectChat(mockPartnerProfile, chatId);
                }}
                className="w-full bg-transparent p-4 hover:bg-[#1e293b]/50 transition-colors flex items-center space-x-4 text-left"
              >
                <div className="relative">
                  <Avatar src={conv.partnerAvatar} />
                  {presence?.isOnline && (
                    <span className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-[#25d366] border-2 border-[#0f172a] rounded-full animate-pulse" />
                  )}
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-baseline">
                    <h4 className="font-bold text-slate-100 truncate">{conv.partnerName}</h4>
                    <span className={`text-xs ${conv.unreadCount > 0 ? 'text-[#25d366] font-bold' : 'text-slate-500'}`}>
                      {new Date(conv.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  
                  <div className="flex justify-between items-center mt-1">
                    <div className="flex flex-col flex-1">
                      <p className={`text-sm truncate ${conv.unreadCount > 0 ? 'font-semibold text-white' : 'text-slate-400'}`}>
                        {conv.lastMessage}
                      </p>
                      {presence && !presence.isOnline && presence.lastSeenText && (
                        <p className="text-[10px] text-slate-500 mt-0.5">
                          {presence.lastSeenText}
                        </p>
                      )}
                    </div>
                    
                    {conv.unreadCount > 0 && (
                      <span className="ml-2 bg-[#25d366] text-white text-[10px] font-bold px-2 py-0.5 rounded-full min-w-[20px] text-center shadow-sm">
                        {conv.unreadCount}
                      </span>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {conversations.length === 0 && (
          <div className="flex flex-col items-center justify-center p-12 text-center">
            <div className="w-20 h-20 bg-slate-800/50 rounded-full flex items-center justify-center mb-4">
              <svg className="w-10 h-10 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </div>
            <h3 className="text-lg font-bold text-slate-300">No chats yet</h3>
            <p className="text-sm text-slate-400 mt-1">Start a conversation with a language partner!</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ChatsList;