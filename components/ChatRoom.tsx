// components/ChatRoom.tsx
import { db, storage } from '../firebase'; 
import { collection, query, orderBy, onSnapshot, doc, deleteDoc, writeBatch, increment, getDocs, limit, setDoc } from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL, deleteObject } from 'firebase/storage';
import React, { useState, useRef, useEffect } from 'react';
import { UserProfile, ChatMessage, ChatSession, MessageType } from '../types';
import MessageBubble from './Chat/MessageBubble';
import Avatar from './ui/Avatar';
import ChatInput from './Chat/ChatInput';

interface ChatRoomProps {
  user: UserProfile;
  session: ChatSession;
  onBack: () => void;
  onCall: (partnerId: string, type: 'voice' | 'video') => void; 
}

const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB limit

// --- NEW Helpers for Date Separators ---
const isSameDay = (ts1: number, ts2: number) => {
  const d1 = new Date(ts1);
  const d2 = new Date(ts2);
  return d1.getFullYear() === d2.getFullYear() && 
         d1.getMonth() === d2.getMonth() && 
         d1.getDate() === d2.getDate();
};

const formatDateSeparator = (ts: number) => {
  const date = new Date(ts);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);

  if (isSameDay(date.getTime(), today.getTime())) return 'Today';
  if (isSameDay(date.getTime(), yesterday.getTime())) return 'Yesterday';
  
  return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
};

const ChatRoom: React.FC<ChatRoomProps> = ({ user, session, onBack, onCall }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [partnerStatus, setPartnerStatus] = useState<UserProfile | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
    const q = query(collection(db, "chats", session.id, "messages"), orderBy("timestamp", "asc"));
    const unsubscribe = onSnapshot(q, async (snapshot) => {
      const liveMessages = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as ChatMessage[];
      setMessages(liveMessages);
      setTimeout(scrollToBottom, 50);

      if (snapshot.empty) {
        const userConvRef = doc(db, "users", user.id, "conversations", session.partner.id);
        try {
          await setDoc(userConvRef, { lastMessage: "", unreadCount: 0 }, { merge: true });
        } catch (error) {
          console.warn("Could not sync empty state", error);
        }
      }

      const unreadReceivedMessages = snapshot.docs.filter(docSnap => {
        const data = docSnap.data() as ChatMessage;
        return data.senderId !== user.id && !data.read;
      });

      if (unreadReceivedMessages.length > 0) {
        const batch = writeBatch(db);
        unreadReceivedMessages.forEach(docSnap => batch.update(docSnap.ref, { read: true, readAt: Date.now() }));
        const userConvRef = doc(db, "users", user.id, "conversations", session.partner.id);
        batch.set(userConvRef, { unreadCount: 0 }, { merge: true });
        await batch.commit().catch(err => console.error("Error marking read:", err));
      }
    });
    return () => unsubscribe();
  }, [session.id, user.id, session.partner.id]);

  useEffect(() => {
    const clearGhostBadge = async () => {
      const userConvRef = doc(db, "users", user.id, "conversations", session.partner.id);
      try {
        await setDoc(userConvRef, { unreadCount: 0 }, { merge: true });
      } catch (error) {
        console.error("Failed to clear ghost badge:", error);
      }
    };
    clearGhostBadge();
  }, [user.id, session.partner.id]);

  const sendMessageToFirestore = async (text: string, type: MessageType = 'text', fileData?: any) => {
    const now = Date.now();
    const batch = writeBatch(db);

    const userConvRef = doc(db, "users", user.id, "conversations", session.partner.id);
    const partnerConvRef = doc(db, "users", session.partner.id, "conversations", user.id);
    const newMessageRef = doc(collection(db, "chats", session.id, "messages"));

    const previewText = type === 'text' ? text : `[${type === 'image' ? '🖼️ Image' : type === 'video' ? '🎥 Video' : type === 'voice' ? '🎤 Voice Message' : '📁 File'}]`;

    batch.set(userConvRef, { lastMessage: previewText, timestamp: now, partnerId: session.partner.id, partnerName: session.partner.name, partnerAvatar: session.partner.avatar }, { merge: true });
    batch.set(partnerConvRef, { lastMessage: previewText, timestamp: now, partnerId: user.id, partnerName: user.name, partnerAvatar: user.avatar, unreadCount: increment(1) }, { merge: true });
    batch.update(doc(db, "users", user.id), { lastMessage: previewText, lastMessageAt: now });
    batch.update(doc(db, "users", session.partner.id), { lastMessage: previewText, lastMessageAt: now });

    const messagePayload: any = { text, type, senderId: user.id, receiverId: session.partner.id, timestamp: now, read: false, readAt: null };

    if (fileData) {
      messagePayload.fileURL = fileData.fileURL;
      messagePayload.fileName = fileData.fileName;
      messagePayload.fileSize = fileData.fileSize;
      messagePayload.mimeType = fileData.mimeType;
      if (fileData.audioDuration) messagePayload.audioDuration = fileData.audioDuration;
    }

    batch.set(newMessageRef, messagePayload);

    try { await batch.commit(); } catch (error) { console.error("Chat send error:", error); }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > MAX_FILE_SIZE) { alert("File is too large."); return; }

    let fileType: MessageType = 'file';
    if (file.type.startsWith('image/')) fileType = 'image';
    else if (file.type.startsWith('video/')) fileType = 'video';

    setIsUploading(true);
    setUploadProgress(0);

    const uniqueFileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${file.name.split('.').pop()}`;
    const storageRef = ref(storage, `chat_attachments/${session.id}/${uniqueFileName}`);
    const uploadTask = uploadBytesResumable(storageRef, file);

    uploadTask.on('state_changed', 
      (snapshot) => setUploadProgress((snapshot.bytesTransferred / snapshot.totalBytes) * 100), 
      (error) => { console.error("Upload failed:", error); alert("Upload failed."); setIsUploading(false); }, 
      async () => {
        const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
        await sendMessageToFirestore('', fileType, { fileURL: downloadURL, fileName: file.name, fileSize: file.size, mimeType: file.type });
        setIsUploading(false); setUploadProgress(0); if (fileInputRef.current) fileInputRef.current.value = '';
      }
    );
  };

  const handleVoiceUpload = async (audioBlob: Blob, duration: number) => {
    setIsUploading(true); setUploadProgress(0);
    const uniqueFileName = `voice_${Date.now()}_${Math.random().toString(36).substring(7)}.webm`;
    const storageRef = ref(storage, `chat_attachments/${session.id}/${uniqueFileName}`);
    const uploadTask = uploadBytesResumable(storageRef, audioBlob);

    uploadTask.on('state_changed', 
      (snapshot) => setUploadProgress((snapshot.bytesTransferred / snapshot.totalBytes) * 100), 
      (error) => { console.error("Voice upload failed:", error); alert("Voice failed."); setIsUploading(false); }, 
      async () => {
        const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
        await sendMessageToFirestore('', 'voice', { fileURL: downloadURL, fileName: uniqueFileName, fileSize: audioBlob.size, mimeType: 'audio/webm', audioDuration: duration });
        setIsUploading(false); setUploadProgress(0);
      }
    );
  };

  const handleDeleteMessage = async (message: ChatMessage) => {
    if (!window.confirm("Unsend this message for everyone?")) return;
    try {
      if (message.fileURL) await deleteObject(ref(storage, message.fileURL)).catch(err => console.warn(err));
      await deleteDoc(doc(db, "chats", session.id, "messages", message.id));
      
      const snapshot = await getDocs(query(collection(db, "chats", session.id, "messages"), orderBy("timestamp", "desc"), limit(1)));
      const userConvRef = doc(db, "users", user.id, "conversations", session.partner.id);
      const partnerConvRef = doc(db, "users", session.partner.id, "conversations", user.id);

      if (snapshot.empty) {
        await deleteDoc(userConvRef).catch(e => console.warn(e));
        await deleteDoc(partnerConvRef).catch(e => console.warn(e));
      } else {
        const newLastMsg = snapshot.docs[0].data() as ChatMessage;
        const previewText = newLastMsg.type === 'text' || !newLastMsg.type ? newLastMsg.text : `[Attachment]`;
        await setDoc(userConvRef, { lastMessage: previewText, timestamp: newLastMsg.timestamp }, { merge: true }).catch(e => console.warn(e));
        await setDoc(partnerConvRef, { lastMessage: previewText, timestamp: newLastMsg.timestamp }, { merge: true }).catch(e => console.warn(e));
      }
    } catch (error) {
      console.error("Error unsending:", error); alert("Failed to unsend.");
    }
  };

  const handleCallClick = (type: 'voice' | 'video') => {
    if (!partnerStatus?.isOnline) { alert(`${session.partner.name} is offline.`); return; }
    onCall(session.partner.id, type); 
  };

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-gray-50">
      <style>{`
        @keyframes chatPopIn {
          0% { opacity: 0; transform: translateY(8px); }
          100% { opacity: 1; transform: translateY(0); }
        }
        .animate-chat-msg {
          animation: chatPopIn 0.25s cubic-bezier(0.2, 0.8, 0.2, 1) forwards;
        }
      `}</style>

      {/* Header */}
      <div className="flex-none bg-white/80 backdrop-blur-xl px-4 py-3.5 flex items-center space-x-3 border-b border-black/5 shadow-[0_1px_2px_rgba(0,0,0,0.02)] z-20">
        <button onClick={onBack} className="p-2 -ml-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-full transition-all duration-200 active:scale-95">
          <svg className="w-[22px] h-[22px]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" /></svg>
        </button>
        <div className="flex items-center flex-1 min-w-0 space-x-3">
          <div className="relative flex-shrink-0">
            <Avatar src={session.partner.avatar} size="sm" />
            {partnerStatus?.isOnline && <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-white rounded-full"></span>}
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-gray-900 text-[16px] leading-tight truncate">{session.partner.name}</h3>
            <p className="text-[13px] text-gray-500 truncate mt-0.5">{partnerStatus?.isOnline ? 'Active now' : 'Offline'}</p>
          </div>
        </div>
        <div className="flex items-center space-x-1 pr-1">
          <button onClick={() => handleCallClick('video')} className={`p-2.5 rounded-full transition-all duration-200 active:scale-95 ${partnerStatus?.isOnline ? 'text-blue-500 hover:bg-blue-50' : 'text-gray-300 cursor-not-allowed'}`}>
            <svg className="w-[22px] h-[22px]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
          </button>
          <button onClick={() => handleCallClick('voice')} className={`p-2.5 rounded-full transition-all duration-200 active:scale-95 ${partnerStatus?.isOnline ? 'text-blue-500 hover:bg-blue-50' : 'text-gray-300 cursor-not-allowed'}`}>
            <svg className="w-[20px] h-[20px]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>
          </button>
        </div>
      </div>

      {/* Messages Area - Removed generic space-y-3 in favor of dynamic margins */}
      <div className="flex-1 overflow-y-auto px-4 py-6 relative bg-gray-50 z-0 scroll-smooth">
        {messages.map((msg, index) => {
          const prevMsg = messages[index - 1];
          const nextMsg = messages[index + 1];

          // 1. Date Separator Logic
          const showDate = !prevMsg || !isSameDay(prevMsg.timestamp, msg.timestamp);

          // 2. Grouping Logic (Same sender, within 5 mins, no day break)
          const TIME_LIMIT = 5 * 60 * 1000;
          const isGroupedWithPrev = prevMsg && 
                                    prevMsg.senderId === msg.senderId && 
                                    (msg.timestamp - prevMsg.timestamp < TIME_LIMIT) && 
                                    !showDate;

          const isGroupedWithNext = nextMsg && 
                                    nextMsg.senderId === msg.senderId && 
                                    (nextMsg.timestamp - msg.timestamp < TIME_LIMIT) && 
                                    isSameDay(msg.timestamp, nextMsg.timestamp);

          const isGroupStart = !isGroupedWithPrev;
          const isGroupEnd = !isGroupedWithNext;

          // Dynamic top margin: tiny gap if grouped, normal gap if new thought
          const marginTop = index === 0 ? 'mt-0' : (isGroupedWithPrev ? 'mt-1' : 'mt-4');

          return (
            <React.Fragment key={msg.id}>
              {/* Date Pill Injector */}
              {showDate && (
                <div className="flex justify-center my-6">
                  <span className="px-3 py-1 bg-gray-200/60 text-gray-500 text-[11px] font-bold rounded-full uppercase tracking-wider backdrop-blur-sm">
                    {formatDateSeparator(msg.timestamp)}
                  </span>
                </div>
              )}

              <div className={`flex w-full animate-chat-msg ${msg.senderId === user.id ? 'justify-end' : 'justify-start'} ${marginTop}`}>
                <div className="group relative max-w-[80%]">
                  <MessageBubble 
                    message={msg} 
                    isMe={msg.senderId === user.id} 
                    isGroupStart={isGroupStart}
                    isGroupEnd={isGroupEnd}
                  />
                  
                  {msg.senderId === user.id && (
                    <button
                      onClick={() => handleDeleteMessage(msg)}
                      className="hidden group-hover:flex absolute -top-2 -left-3 bg-white border border-gray-200 text-red-500 hover:bg-red-50 rounded-full w-6 h-6 items-center justify-center text-xs shadow-md z-10 transition-all duration-200 active:scale-90"
                      title="Unsend message"
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>
            </React.Fragment>
          );
        })}

        {isUploading && (
          <div className="flex w-full justify-end animate-chat-msg mt-4">
            <div className="bg-white border border-gray-100 max-w-[80%] px-4 py-2 rounded-2xl rounded-tr-[4px] shadow-sm flex items-center space-x-2">
              <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
              <span className="text-xs text-gray-600 font-medium">Sending... {Math.round(uploadProgress)}%</span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} className="h-2" />
      </div>

      <div className="flex-none relative z-20 bg-white border-t border-gray-200 transition-colors duration-300">
        <input type="file" ref={fileInputRef} onChange={handleFileSelect} className="hidden" accept="image/*,video/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.zip" />
        <ChatInput onSendMessage={(text) => sendMessageToFirestore(text, 'text')} onSendVoice={handleVoiceUpload} onTriggerFileSelect={() => fileInputRef.current?.click()} isUploading={isUploading} />
      </div>
    </div>
  );
};

export default ChatRoom;