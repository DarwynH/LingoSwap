import React, { useState, useEffect } from 'react'; // Added hooks
import { db } from '../firebase'; // Ensure correct path
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { UserProfile } from '../types';
import Avatar from './ui/Avatar';

interface ChatsListProps {
  user: UserProfile; // Need this to generate the ID
  onSelectChat: (partner: UserProfile, chatId: string) => void;
}

// Update this line:
const ChatsList: React.FC<ChatsListProps> = ({ user, onSelectChat }) => {
  const [recentPartners, setRecentPartners] = useState<UserProfile[]>([]);

  useEffect(() => {
    // Query users, newest messages first
    const q = query(
      collection(db, "users"),
      orderBy("lastMessageAt", "desc")
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const others = snapshot.docs
        .map(doc => doc.data() as UserProfile)
        .filter(p => p.id !== user.id); // Filter yourself out locally

      setRecentPartners(others);
    });

    return () => unsubscribe();
  }, [user.id]);
  
  return (
    <div className="flex-1 flex flex-col h-full bg-[#f8fafb]">
      <header className="bg-white border-b border-gray-200 p-4">
        <h1 className="text-xl font-bold text-gray-800">Your Conversations</h1>
      </header>

      <div className="flex-1 overflow-y-auto">
        <div className="divide-y divide-gray-100">
          {recentPartners.map((partner) => ( // Changed from recentChats
            <button
              key={partner.id}
              onClick={() => {
                const chatId = [user.id, partner.id].sort().join('_');
                onSelectChat(partner, chatId);
              }}
              className="w-full bg-white p-4 hover:bg-gray-50 flex items-center space-x-4 text-left"
            >
              <div className="relative">
                <Avatar src={partner.avatar} />
                {partner.isOnline && (
                  <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-white rounded-full"></span>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="font-bold text-gray-800">{partner.name}</h4>
                <p className="text-sm text-gray-500 truncate">{partner.lastMessage}</p>
              </div>
            </button>
          ))}
        </div>

        {recentPartners.length === 0 && (
          <div className="flex flex-col items-center justify-center p-12 text-center">
            <h3 className="text-lg font-bold text-gray-700">No chats yet</h3>
          </div>
        )}
      </div>
    </div>
  );
};

export default ChatsList;