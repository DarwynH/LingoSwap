import { db } from '../firebase';
import { collection, query, orderBy, onSnapshot, addDoc, deleteDoc, doc, updateDoc, setDoc, getDocs, limit } from 'firebase/firestore';
import React, { useState, useRef, useEffect } from 'react';
import { UserProfile, ChatMessage, ChatSession } from '../types';
import MessageBubble from './Chat/MessageBubble';
import Avatar from './ui/Avatar';

interface ChatRoomProps {
  user: UserProfile;
  session: ChatSession;
  onBack: () => void;
  // UPDATED: Now expects both a callId and a type
  onCall: (callId: string, type: 'voice' | 'video') => void; 
}

const ChatRoom: React.FC<ChatRoomProps> = ({ user, session, onBack, onCall }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [partnerStatus, setPartnerStatus] = useState<UserProfile | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    const unsub = onSnapshot(doc(db, "users", session.partner.id), (docSnap) => {
      if (docSnap.exists()) {
        setPartnerStatus(docSnap.data() as UserProfile);
      }
    });
    return () => unsub();
  }, [session.partner.id]);

  useEffect(() => {
    const q = query(
      collection(db, "chats", session.id, "messages"),
      orderBy("timestamp", "asc")
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const liveMessages = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as ChatMessage[];
      setMessages(liveMessages);
      setTimeout(scrollToBottom, 100);
    });

    return () => unsubscribe();
  }, [session.id]);

  // UPDATED: Now accepts callType
  const handleInitiateCall = async (callType: 'voice' | 'video') => {
    if (!partnerStatus?.isOnline) {
      alert(`${session.partner.name} is currently offline and cannot receive calls.`);
      return;
    }

    try {
      const callDocRef = await addDoc(collection(db, "calls"), {
        callerId: user.id,
        receiverId: session.partner.id,
        callerName: user.name,
        callerAvatar: user.avatar,
        status: 'ringing',
        type: callType, // NEW: Save the call type to Firestore
        createdAt: Date.now()
      });

      // Pass the new call ID and type up to App.tsx
      onCall(callDocRef.id, callType);
    } catch (error) {
      console.error("Error initiating call:", error);
      alert("Failed to start call. Please try again.");
    }
  };

  const handleDeleteMessage = async (messageId: string) => {
    await deleteDoc(doc(db, "chats", session.id, "messages", messageId));

    const q = query(
      collection(db, "chats", session.id, "messages"),
      orderBy("timestamp", "desc"),
      limit(1)
    );
    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      await deleteDoc(doc(db, "users", user.id, "conversations", session.partner.id));
    } else {
      const newLastMsg = snapshot.docs[0].data();
      await updateDoc(doc(db, "users", user.id, "conversations", session.partner.id), {
        lastMessage: newLastMsg.text,
        timestamp: newLastMsg.timestamp
      });
    }
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;

    const messageText = inputText;
    setInputText('');

    try {
      const userConvRef = doc(db, "users", user.id, "conversations", session.partner.id);
      const partnerConvRef = doc(db, "users", session.partner.id, "conversations", user.id);

      const conversationData = {
        lastMessage: messageText,
        timestamp: Date.now(),
        partnerId: session.partner.id,
        partnerName: session.partner.name,
        partnerAvatar: session.partner.avatar
      };

      await Promise.all([
        setDoc(userConvRef, conversationData, { merge: true }),
        setDoc(partnerConvRef, {
          ...conversationData,
          partnerId: user.id,
          partnerName: user.name,
          partnerAvatar: user.avatar
        }, { merge: true }),
        addDoc(collection(db, "chats", session.id, "messages"), {
          text: messageText,
          senderId: user.id,
          timestamp: Date.now()
        }),
        updateDoc(doc(db, "users", user.id), {
          lastMessage: messageText,
          lastMessageAt: Date.now()
        }),
        updateDoc(doc(db, "users", session.partner.id), {
          lastMessage: messageText,
          lastMessageAt: Date.now()
        })
      ]);

    } catch (error) {
      console.error("Chat error:", error);
    }
  };

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-[#e5ddd5]">
      {/* Header */}
      <div className="flex-none bg-[#075e54] p-3 text-white flex items-center space-x-3 shadow-md z-10">
        <button onClick={onBack} className="p-1 hover:bg-black/10 rounded-full transition-colors">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
        </button>

        <div className="relative">
          <Avatar src={session.partner.avatar} size="sm" />
          {partnerStatus?.isOnline && (
            <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-[#075e54] rounded-full"></span>
          )}
        </div>

        <div className="flex-1">
          <h3 className="font-bold text-sm leading-tight">{session.partner.name}</h3>
          <p className="text-[10px] opacity-80">
            {partnerStatus?.isOnline ? 'Online' : 'Offline'}
          </p>
        </div>

        {/* Video Call Button */}
        <button onClick={() => handleInitiateCall('video')} className="p-2 hover:bg-black/10 rounded-full transition-colors">
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z"/>
          </svg>
        </button>

        {/* Voice Call Button */}
        <button onClick={() => handleInitiateCall('voice')} className="p-2 hover:bg-black/10 rounded-full transition-colors">
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M6.62 10.79a15.053 15.053 0 006.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z" />
          </svg>
        </button>
      </div>

      {/* Messages Area */}
      <div
        className="flex-1 overflow-y-auto p-4 space-y-2"
        style={{
          backgroundImage: `url('https://firebasestorage.googleapis.com/v0/b/gen-lang-client-0436236234.firebasestorage.app/o/chat_background.jpg?alt=media&token=7876d3b2-3ff0-41d3-b5b8-abe9aa8a4efc')`,
          backgroundSize: '400px',
          backgroundRepeat: 'repeat',
          backgroundColor: '#1a1a1a'
        }}
      >
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex w-full ${msg.senderId === user.id ? 'justify-end' : 'justify-start'}`}
          >
            <div className="group relative max-w-[80%]">
              <MessageBubble message={msg} isMe={msg.senderId === user.id} />
              <button
                onClick={() => handleDeleteMessage(msg.id)}
                className="hidden group-hover:block absolute -top-2 right-0 bg-red-500 text-white rounded-full p-1 text-xs"
              >
                ✕
              </button>
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Field */}
      <form onSubmit={handleSend} className="flex-none bg-[#f0f2f5] p-2 flex items-center space-x-2">
        <input
          type="text"
          className="flex-1 bg-white border-none rounded-full px-4 py-2 text-sm shadow-sm"
          placeholder="Type a message"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
        />
        <button type="submit" className="bg-[#00a884] text-white p-2.5 rounded-full">
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
          </svg>
        </button>
      </form>
    </div>
  );
};

export default ChatRoom;