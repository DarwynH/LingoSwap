// components/ChatRoom.tsx
import { db, storage } from '../firebase'; 
import { collection, query, orderBy, onSnapshot, doc, deleteDoc, writeBatch, increment, getDocs, limit } from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL, deleteObject } from 'firebase/storage';
import React, { useState, useRef, useEffect } from 'react';
import { UserProfile, ChatMessage, ChatSession, MessageType } from '../types';
import MessageBubble from './Chat/MessageBubble';
import Avatar from './ui/Avatar';

interface ChatRoomProps {
  user: UserProfile;
  session: ChatSession;
  onBack: () => void;
  onCall: (callId: string, type: 'voice' | 'video') => void; 
}

const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB limit

const ChatRoom: React.FC<ChatRoomProps> = ({ user, session, onBack, onCall }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
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
      setTimeout(scrollToBottom, 100);

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

  // Handle standard text send
  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;
    const text = inputText;
    setInputText('');
    await sendMessageToFirestore(text, 'text');
  };

  // Reusable function to execute the batch write for any message type
  const sendMessageToFirestore = async (
    text: string, 
    type: MessageType = 'text', 
    fileData?: { fileURL: string, fileName: string, fileSize: number, mimeType: string }
  ) => {
    const now = Date.now();
    const batch = writeBatch(db);

    const userConvRef = doc(db, "users", user.id, "conversations", session.partner.id);
    const partnerConvRef = doc(db, "users", session.partner.id, "conversations", user.id);
    const newMessageRef = doc(collection(db, "chats", session.id, "messages"));

    const previewText = type === 'text' ? text : `[${type === 'image' ? '📷 Image' : type === 'video' ? '🎥 Video' : '📄 File'}]`;

    batch.set(userConvRef, {
      lastMessage: previewText,
      timestamp: now,
      partnerId: session.partner.id,
      partnerName: session.partner.name,
      partnerAvatar: session.partner.avatar
    }, { merge: true });

    batch.set(partnerConvRef, {
      lastMessage: previewText,
      timestamp: now,
      partnerId: user.id,
      partnerName: user.name,
      partnerAvatar: user.avatar,
      unreadCount: increment(1)
    }, { merge: true });

    batch.update(doc(db, "users", user.id), { lastMessage: previewText, lastMessageAt: now });
    batch.update(doc(db, "users", session.partner.id), { lastMessage: previewText, lastMessageAt: now });

    const messagePayload: any = {
      text: text,
      type: type,
      senderId: user.id,
      receiverId: session.partner.id,
      timestamp: now,
      read: false,
      readAt: null
    };

    if (fileData) {
      messagePayload.fileURL = fileData.fileURL;
      messagePayload.fileName = fileData.fileName;
      messagePayload.fileSize = fileData.fileSize;
      messagePayload.mimeType = fileData.mimeType;
    }

    batch.set(newMessageRef, messagePayload);

    try {
      await batch.commit();
    } catch (error) {
      console.error("Chat send error:", error);
    }
  };

  // Upload Logic
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > MAX_FILE_SIZE) {
      alert("File is too large. Maximum size is 20MB.");
      return;
    }

    let fileType: MessageType = 'file';
    if (file.type.startsWith('image/')) fileType = 'image';
    else if (file.type.startsWith('video/')) fileType = 'video';

    setIsUploading(true);
    setUploadProgress(0);

    const fileExtension = file.name.split('.').pop();
    const uniqueFileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExtension}`;
    const storageRef = ref(storage, `chat_attachments/${session.id}/${uniqueFileName}`);
    
    const uploadTask = uploadBytesResumable(storageRef, file);

    uploadTask.on('state_changed', 
      (snapshot) => {
        const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
        setUploadProgress(progress);
      }, 
      (error) => {
        console.error("Upload failed:", error);
        alert("File upload failed. Please try again.");
        setIsUploading(false);
      }, 
      async () => {
        const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
        await sendMessageToFirestore('', fileType, {
          fileURL: downloadURL,
          fileName: file.name,
          fileSize: file.size,
          mimeType: file.type
        });
        setIsUploading(false);
        setUploadProgress(0);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    );
  };

  // Handle Message Deletion (Unsend)
  const handleDeleteMessage = async (message: ChatMessage) => {
    if (!window.confirm("Unsend this message for everyone?")) return;

    try {
      if (message.fileURL) {
        const fileRef = ref(storage, message.fileURL);
        await deleteObject(fileRef).catch(err => {
          console.warn("Could not delete file from storage:", err);
        });
      }

      await deleteDoc(doc(db, "chats", session.id, "messages", message.id));

      const q = query(
        collection(db, "chats", session.id, "messages"),
        orderBy("timestamp", "desc"),
        limit(1)
      );
      const snapshot = await getDocs(q);

      const batch = writeBatch(db);
      const userConvRef = doc(db, "users", user.id, "conversations", session.partner.id);
      const partnerConvRef = doc(db, "users", session.partner.id, "conversations", user.id);

      if (snapshot.empty) {
        batch.delete(userConvRef);
        batch.delete(partnerConvRef);
      } else {
        const newLastMsg = snapshot.docs[0].data() as ChatMessage;
        const previewText = newLastMsg.type === 'text' || !newLastMsg.type 
          ? newLastMsg.text 
          : `[${newLastMsg.type === 'image' ? '📷 Image' : newLastMsg.type === 'video' ? '🎥 Video' : '📄 File'}]`;

        batch.set(userConvRef, { lastMessage: previewText, timestamp: newLastMsg.timestamp }, { merge: true });
        batch.set(partnerConvRef, { lastMessage: previewText, timestamp: newLastMsg.timestamp }, { merge: true });
      }

      await batch.commit();
    } catch (error) {
      console.error("Error unsending message:", error);
      alert("Failed to unsend message.");
    }
  };

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-[#e5ddd5]">
      {/* Header */}
      <div className="flex-none bg-[#075e54] p-3 text-white flex items-center space-x-3 shadow-md z-10">
        <button onClick={onBack} className="p-1 hover:bg-black/10 rounded-full transition-colors">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
        </button>
        <div className="relative">
          <Avatar src={session.partner.avatar} size="sm" />
          {partnerStatus?.isOnline && <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-[#075e54] rounded-full"></span>}
        </div>
        <div className="flex-1">
          <h3 className="font-bold text-sm leading-tight">{session.partner.name}</h3>
          <p className="text-[10px] opacity-80">{partnerStatus?.isOnline ? 'Online' : 'Offline'}</p>
        </div>
      </div>

      {/* Messages Area */}
      <div
        className="flex-1 overflow-y-auto p-4 space-y-2 relative"
        style={{ backgroundImage: `url('https://firebasestorage.googleapis.com/v0/b/gen-lang-client-0436236234.firebasestorage.app/o/chat_background.jpg?alt=media&token=7876d3b2-3ff0-41d3-b5b8-abe9aa8a4efc')`, backgroundSize: '400px', backgroundRepeat: 'repeat', backgroundColor: '#1a1a1a' }}
      >
        {messages.map((msg) => (
          <div key={msg.id} className={`flex w-full ${msg.senderId === user.id ? 'justify-end' : 'justify-start'}`}>
            <div className="group relative max-w-[80%]">
              <MessageBubble message={msg} isMe={msg.senderId === user.id} />
              
              {/* Unsend Button - ONLY visible on the current user's messages */}
              {msg.senderId === user.id && (
                <button
                  onClick={() => handleDeleteMessage(msg)}
                  className="hidden group-hover:flex absolute -top-2 -right-2 bg-red-500 hover:bg-red-600 text-white rounded-full w-5 h-5 items-center justify-center text-xs shadow-md z-10 transition-colors"
                  title="Unsend message"
                >
                  ✕
                </button>
              )}
            </div>
          </div>
        ))}
        {isUploading && (
          <div className="flex w-full justify-end">
            <div className="bg-[#dcf8c6] max-w-[80%] px-3 py-2 rounded-lg rounded-tr-none shadow-sm flex items-center space-x-2">
              <div className="w-4 h-4 border-2 border-[#00a884] border-t-transparent rounded-full animate-spin"></div>
              <span className="text-xs text-gray-600 font-medium">Sending... {Math.round(uploadProgress)}%</span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Field Area */}
      <div className="flex-none bg-[#f0f2f5] p-2 relative z-20">
        
        {/* Hidden File Input */}
        <input 
          type="file" 
          ref={fileInputRef} 
          onChange={handleFileSelect} 
          className="hidden" 
          accept="image/*,video/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.zip"
        />

        <form onSubmit={handleSend} className="flex w-full items-center space-x-2">
          
          {/* 1. Combined Input and Attachment Bubble */}
          <div className="flex-1 flex items-center bg-white rounded-full pl-4 pr-1 py-1 shadow-sm focus-within:ring-1 focus-within:ring-[#00a884]">
            <input
              type="text"
              className="flex-1 bg-transparent border-none py-1.5 text-sm focus:outline-none"
              placeholder="Type a message"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              disabled={isUploading}
            />

            {/* 2. Attachment Button (Now inside the bubble!) */}
            <button 
              type="button" 
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              className="p-1.5 text-gray-400 hover:text-[#00a884] transition-colors flex-shrink-0 rounded-full hover:bg-gray-50 disabled:opacity-50 mr-1"
              title="Attach file"
            >
              <svg className="w-5 h-5 transform rotate-45" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
              </svg>
            </button>
          </div>

          {/* 3. Send Button */}
          <button 
            type="submit" 
            disabled={!inputText.trim() || isUploading}
            className={`p-2.5 rounded-full transition-colors flex-shrink-0 ${inputText.trim() && !isUploading ? 'bg-[#00a884] text-white hover:bg-[#008f6f]' : 'bg-gray-300 text-gray-100'}`}
          >
            <svg className="w-5 h-5 ml-1 transform -rotate-45" fill="currentColor" viewBox="0 0 24 24">
              <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
            </svg>
          </button>
          
        </form>
      </div>
    </div>
  );
};

export default ChatRoom;