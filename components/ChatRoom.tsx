import { db } from '../firebase';
import { collection, query, orderBy, onSnapshot, addDoc, deleteDoc, doc, updateDoc, setDoc, getDocs, limit, writeBatch, increment } from 'firebase/firestore';
import React, { useState, useRef, useEffect } from 'react';
import { UserProfile, ChatMessage, ChatSession } from '../types';
import MessageBubble from './Chat/MessageBubble';
import Avatar from './ui/Avatar';

interface ChatRoomProps {
  user: UserProfile;
  session: ChatSession;
  onBack: () => void;
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

  // 1. Listen to partner's online status
  useEffect(() => {
    const unsub = onSnapshot(doc(db, "users", session.partner.id), (docSnap) => {
      if (docSnap.exists()) {
        setPartnerStatus(docSnap.data() as UserProfile);
      }
    });
    return () => unsub();
  }, [session.partner.id]);

  // 2. Listen to messages and handle Read Receipts
  useEffect(() => {
    const q = query(
      collection(db, "chats", session.id, "messages"),
      orderBy("timestamp", "asc")
    );

    const unsubscribe = onSnapshot(q, async (snapshot) => {
      const liveMessages = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as ChatMessage[];
      
      setMessages(liveMessages);
      setTimeout(scrollToBottom, 100);

      // --- READ RECEIPT LOGIC ---
      // Find messages sent to us that are not read yet
      const unreadReceivedMessages = snapshot.docs.filter(docSnap => {
        const data = docSnap.data() as ChatMessage;
        return data.senderId !== user.id && !data.read;
      });

      if (unreadReceivedMessages.length > 0) {
        const batch = writeBatch(db);
        
        // Mark these specific messages as read
        unreadReceivedMessages.forEach(docSnap => {
          batch.update(docSnap.ref, { read: true, readAt: Date.now() });
        });

        // Reset our own unread count for this conversation back to 0
        const userConvRef = doc(db, "users", user.id, "conversations", session.partner.id);
        batch.set(userConvRef, { unreadCount: 0 }, { merge: true });

        await batch.commit().catch(err => console.error("Error marking messages as read:", err));
      }
    });

    return () => unsubscribe();
  }, [session.id, user.id, session.partner.id]);

  // Handle Calls (Preserved)
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
        type: callType,
        createdAt: Date.now()
      });

      onCall(callDocRef.id, callType);
    } catch (error) {
      console.error("Error initiating call:", error);
      alert("Failed to start call. Please try again.");
    }
  };

  // Handle Message Deletion (Preserved)
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

  // --- UPDATED SEND LOGIC ---
  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;

    const messageText = inputText;
    setInputText('');
    const now = Date.now();

    try {
      const userConvRef = doc(db, "users", user.id, "conversations", session.partner.id);
      const partnerConvRef = doc(db, "users", session.partner.id, "conversations", user.id);
      const newMessageRef = doc(collection(db, "chats", session.id, "messages"));

      const batch = writeBatch(db);

      // 1. Update our conversation preview (do not alter unreadCount, or set to 0 if new)
      batch.set(userConvRef, {
        lastMessage: messageText,
        timestamp: now,
        partnerId: session.partner.id,
        partnerName: session.partner.name,
        partnerAvatar: session.partner.avatar
      }, { merge: true });

      // 2. Update partner's conversation preview and increment unread
      batch.set(partnerConvRef, {
        lastMessage: messageText,
        timestamp: now,
        partnerId: user.id,
        partnerName: user.name,
        partnerAvatar: user.avatar,
        unreadCount: increment(1) // Increment the partner's badge by 1
      }, { merge: true });

      // 3. Update global user records (preserved from your original code)
      batch.update(doc(db, "users", user.id), { lastMessage: messageText, lastMessageAt: now });
      batch.update(doc(db, "users", session.partner.id), { lastMessage: messageText, lastMessageAt: now });

      // 4. Add the actual message with new read receipt fields
      batch.set(newMessageRef, {
        text: messageText,
        senderId: user.id,
        receiverId: session.partner.id,
        timestamp: now,
        read: false, // Default to false when sending
        readAt: null
      });

      // Commit everything atomically
      await batch.commit();

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