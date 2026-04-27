import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { UserProfile, ConversationPreview } from '../types';
import Avatar from './ui/Avatar';

interface ChatsListProps {
  user: UserProfile; 
  onSelectChat: (partner: UserProfile, chatId: string) => void;
}

const ChatsList: React.FC<ChatsListProps> = ({ user, onSelectChat }) => {
  const [conversations, setConversations] = useState<ConversationPreview[]>([]);

  useEffect(() => {
    // NEW: Query the specific user's conversations subcollection
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
  
  return (
    <div className="flex-1 flex flex-col h-full bg-[#0f172a]">
      <header className="bg-[#1e293b]/80 backdrop-blur-md border-b border-slate-700/50 p-4">
        <h1 className="text-xl font-bold text-slate-100">Your Conversations</h1>
      </header>

      <div className="flex-1 overflow-y-auto">
        <div className="divide-y divide-slate-800/50">
          {conversations.map((conv) => (
            <button
              key={conv.partnerId}
              onClick={() => {
                const chatId = [user.id, conv.partnerId].sort().join('_');
                
                // We construct a partial UserProfile to satisfy the routing requirements in App.tsx
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
                {/* Note: Online status is omitted here because we are reading from the conversation 
                    preview rather than the live global user profile. It is still preserved in the ChatRoom! */}
              </div>
              
              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-baseline">
                   <h4 className="font-bold text-slate-100">{conv.partnerName}</h4>
                   <span className={`text-xs ${conv.unreadCount > 0 ? 'text-[#25d366] font-bold' : 'text-slate-500'}`}>
                     {new Date(conv.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                   </span>
                </div>
                
                <div className="flex justify-between items-center mt-1">
                   <p className={`text-sm truncate ${conv.unreadCount > 0 ? 'font-semibold text-white' : 'text-slate-400'}`}>
                     {conv.lastMessage}
                   </p>
                   
                   {/* NEW: Unread Badge UI */}
                   {conv.unreadCount > 0 && (
                     <span className="ml-2 bg-[#25d366] text-white text-[10px] font-bold px-2 py-0.5 rounded-full min-w-[20px] text-center shadow-sm">
                       {conv.unreadCount}
                     </span>
                   )}
                </div>
              </div>
            </button>
          ))}
        </div>

        {conversations.length === 0 && (
          <div className="flex flex-col items-center justify-center p-12 text-center">
            <h3 className="text-lg font-bold text-slate-400">No chats yet</h3>
          </div>
        )}
      </div>
    </div>
  );
};

export default ChatsList;