// components/ChatRoom.tsx
import { db, storage } from '../firebase';
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  doc,
  deleteDoc,
  writeBatch,
  increment,
  getDocs,
  limit,
  setDoc,
  updateDoc,
  arrayUnion,
  arrayRemove,
  where
} from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL, deleteObject } from 'firebase/storage';
import React, { useState, useRef, useEffect } from 'react';
import { UserProfile, ChatMessage, ChatSession, MessageType, SavedItem, SavedItemType, PendingAttachment } from '../types';
import MessageBubble from './Chat/MessageBubble';
import Avatar from './ui/Avatar';
import ChatInput from './Chat/ChatInput';
import WordActionPopup from './Chat/WordActionPopup';
import ChatHeaderMenu from './Chat/ChatHeaderMenu';
import ChatSearchBar from './Chat/ChatSearchBar';
import AttachmentPreviewModal from './Chat/AttachmentPreviewModal';
import { createPortal } from 'react-dom';

interface ChatRoomProps {
  user: UserProfile;
  session: ChatSession;
  onBack: () => void;
  onCall: (partnerId: string, type: 'voice' | 'video') => void;
  jumpToMessageId?: string | null;
  onJumpComplete?: () => void;
  /** When true, renders inline (no fixed positioning) for desktop side-by-side layout */
  isEmbedded?: boolean;
  /** Called after the user deletes the chat, so App can clean up session state */
  onDeleteChat?: () => void;
}

export interface ReplyTarget {
  messageId: string;
  text: string;
  senderId: string;
  senderName: string;
}

const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB limit

// --- Helpers for Date Separators ---
const isSameDay = (ts1: number, ts2: number) => {
  const d1 = new Date(ts1);
  const d2 = new Date(ts2);
  return (
    d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate()
  );
};

const formatDateSeparator = (ts: number) => {
  const date = new Date(ts);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);

  if (isSameDay(date.getTime(), today.getTime())) return 'Today';
  if (isSameDay(date.getTime(), yesterday.getTime())) return 'Yesterday';

  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
};

const ChatRoom: React.FC<ChatRoomProps> = ({ user, session, onBack, onCall, jumpToMessageId, onJumpComplete, isEmbedded = false, onDeleteChat }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [partnerStatus, setPartnerStatus] = useState<UserProfile | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  // Status and active UI states
  const [isPartnerOnline, setIsPartnerOnline] = useState(false);
  const [menuConfig, setMenuConfig] = useState<{ 
    id: string; 
    rect: { top: number; bottom: number; left: number; right: number };
    position: 'top' | 'bottom'; 
    align: 'left' | 'right' 
  } | null>(null);
  
  // Group C & Reply States
  const [replyTarget, setReplyTarget] = useState<ReplyTarget | null>(null);
  const [pendingAttachment, setPendingAttachment] = useState<PendingAttachment | null>(null);
  const [favorites, setFavorites] = useState<string[]>(user.favoriteMessages || []);

  // Group A (Phrasebook & Study Later) State
  const [savedStates, setSavedStates] = useState<Record<string, { phrasebook: boolean; study_later: boolean }>>({});

  // Word Learning State
  const [selectedWordContext, setSelectedWordContext] = useState<{
    word: string;
    messageId: string;
    sourceText: string;
  } | null>(null);

  // Header menu & search state
  const [isHeaderMenuOpen, setIsHeaderMenuOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const headerMenuBtnRef = useRef<HTMLButtonElement>(null);

  // Mute / Block state
  const [isMuted, setIsMuted] = useState(false);
  const [isBlocked, setIsBlocked] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const messageRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const scrollToOriginalMessage = (messageId: string) => {
    const el = messageRefs.current[messageId];
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.classList.add('bg-gray-800/60', 'transition-colors', 'duration-500', 'rounded-xl');
      setTimeout(() => el.classList.remove('bg-gray-800/60', 'rounded-xl'), 1500);
    }
  };

  // Cleanup pending attachment object URL on unmount
  useEffect(() => {
    return () => {
      if (pendingAttachment?.previewUrl) {
        URL.revokeObjectURL(pendingAttachment.previewUrl);
      }
    };
  }, [pendingAttachment]);

  // Jump-to-message interceptor logic (Scrolls and highlights target message)
  useEffect(() => {
    if (jumpToMessageId && messages.length > 0) {
      const el = messageRefs.current[jumpToMessageId];
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        // Apply temporary highlight effect matching reply behavior
        el.classList.add('bg-gray-800/60', 'transition-colors', 'duration-500', 'rounded-xl');
        setTimeout(() => el.classList.remove('bg-gray-800/60', 'rounded-xl'), 1500);

        if (onJumpComplete) onJumpComplete();
      }
    }
  }, [jumpToMessageId, messages, onJumpComplete]);

  // Reset search & menu state when switching chats
  useEffect(() => {
    setIsSearchOpen(false);
    setIsHeaderMenuOpen(false);
  }, [session.id]);

  // Listen to mute state from the conversation document
  useEffect(() => {
    const convRef = doc(db, 'users', user.id, 'conversations', session.partner.id);
    const unsub = onSnapshot(convRef, (snap) => {
      if (snap.exists()) {
        setIsMuted(snap.data().muted === true);
      } else {
        setIsMuted(false);
      }
    });
    return () => unsub();
  }, [user.id, session.partner.id]);

  // Listen to block state
  useEffect(() => {
    const blockRef = doc(db, 'users', user.id, 'blockedUsers', session.partner.id);
    const unsub = onSnapshot(blockRef, (snap) => {
      setIsBlocked(snap.exists());
    });
    return () => unsub();
  }, [user.id, session.partner.id]);

  // Close the context menu if the user clicks anywhere else
  useEffect(() => {
    const handleClickOutside = () => setMenuConfig(null);
    if (menuConfig) {
      document.addEventListener('click', handleClickOutside);
    }
    return () => document.removeEventListener('click', handleClickOutside);
  }, [menuConfig]);

  // Listen to partner's user document
  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'users', session.partner.id), (docSnap) => {
      if (docSnap.exists()) {
        setPartnerStatus(docSnap.data() as UserProfile);
      } else {
        setPartnerStatus(null);
      }
    });
    return () => unsub();
  }, [session.partner.id]);

  // Staleness checker for true online presence
  useEffect(() => {
    const checkPresence = () => {
      if (!partnerStatus) {
        setIsPartnerOnline(false);
        return;
      }
      const isRecent = partnerStatus.lastSeen ? Date.now() - partnerStatus.lastSeen < 120000 : false;
      setIsPartnerOnline((partnerStatus.isOnline || false) && isRecent);
    };

    checkPresence();
    const stalenessInterval = setInterval(checkPresence, 30000);

    return () => clearInterval(stalenessInterval);
  }, [partnerStatus]);

  // Listen to saved items for this specific chat
  useEffect(() => {
    const q = query(
      collection(db, 'users', user.id, 'savedItems'), 
      where('chatId', '==', session.id)
    );
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const newStates: Record<string, { phrasebook: boolean; study_later: boolean }> = {};
      snapshot.forEach(docSnap => {
        const data = docSnap.data() as SavedItem;
        if (!newStates[data.messageId]) {
          newStates[data.messageId] = { phrasebook: false, study_later: false };
        }
        newStates[data.messageId][data.type] = true;
      });
      setSavedStates(newStates);
    });

    return () => unsubscribe();
  }, [user.id, session.id]);

  // Listen to chat messages and mark read
  useEffect(() => {
    const q = query(collection(db, 'chats', session.id, 'messages'), orderBy('timestamp', 'asc'));
    const unsubscribe = onSnapshot(q, async (snapshot) => {
      const liveMessages = snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data(),
      })) as ChatMessage[];

      setMessages(liveMessages);
      setTimeout(scrollToBottom, 50);

      if (snapshot.empty) {
        const userConvRef = doc(db, 'users', user.id, 'conversations', session.partner.id);
        try {
          await setDoc(userConvRef, { lastMessage: '', unreadCount: 0 }, { merge: true });
        } catch (error) {
          console.warn('Could not sync empty state', error);
        }
      }

      const unreadReceivedMessages = snapshot.docs.filter((docSnap) => {
        const data = docSnap.data() as ChatMessage;
        return data.senderId !== user.id && !data.read;
      });

      if (unreadReceivedMessages.length > 0) {
        const batch = writeBatch(db);
        unreadReceivedMessages.forEach((docSnap) =>
          batch.update(docSnap.ref, { read: true, readAt: Date.now() })
        );

        const userConvRef = doc(db, 'users', user.id, 'conversations', session.partner.id);
        batch.set(userConvRef, { unreadCount: 0 }, { merge: true });

        await batch.commit().catch((err) => console.error('Error marking read:', err));
      }
    });

    return () => unsubscribe();
  }, [session.id, user.id, session.partner.id]);

  // Actively pin the scroll position to the bottom when the keyboard resizes
  // Only needed for mobile full-screen mode (not embedded desktop)
  useEffect(() => {
    if (isEmbedded) return;

    const handleViewportChange = () => {
      if (!window.visualViewport) return;
      
      if (chatContainerRef.current) {
        chatContainerRef.current.style.height = `${window.visualViewport.height}px`;
      }
      
      window.scrollTo(0, 0);

      if (scrollContainerRef.current) {
        scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
      }
    };

    window.visualViewport?.addEventListener('resize', handleViewportChange);
    window.visualViewport?.addEventListener('scroll', handleViewportChange);
    
    handleViewportChange();

    return () => {
      window.visualViewport?.removeEventListener('resize', handleViewportChange);
      window.visualViewport?.removeEventListener('scroll', handleViewportChange);
    };
  }, [isEmbedded]);

  // Clear ghost notification badges
  useEffect(() => {
    const clearGhostBadge = async () => {
      const userConvRef = doc(db, 'users', user.id, 'conversations', session.partner.id);
      try {
        await setDoc(userConvRef, { unreadCount: 0 }, { merge: true });
      } catch (error) {
        console.error('Failed to clear ghost badge:', error);
      }
    };

    clearGhostBadge();
  }, [user.id, session.partner.id]);

  // ── Chat-level actions (Delete / Mute / Block) ──

  const handleDeleteConversation = async () => {
    if (!window.confirm('Delete this conversation? It will be removed from your chat list. The other user may still see the conversation.')) return;
    try {
      const convRef = doc(db, 'users', user.id, 'conversations', session.partner.id);
      await deleteDoc(convRef);
      if (onDeleteChat) {
        onDeleteChat();
      } else {
        onBack();
      }
    } catch (error) {
      console.error('Failed to delete conversation:', error);
      alert('Could not delete conversation.');
    }
  };

  const handleToggleMute = async () => {
    try {
      const convRef = doc(db, 'users', user.id, 'conversations', session.partner.id);
      await setDoc(convRef, { muted: !isMuted }, { merge: true });
    } catch (error) {
      console.error('Failed to toggle mute:', error);
      alert('Could not update mute setting.');
    }
  };

  const handleToggleBlock = async () => {
    const blockRef = doc(db, 'users', user.id, 'blockedUsers', session.partner.id);
    if (isBlocked) {
      if (!window.confirm(`Unblock ${session.partner.name}? You will be able to send messages again.`)) return;
      try {
        await deleteDoc(blockRef);
      } catch (error) {
        console.error('Failed to unblock:', error);
        alert('Could not unblock user.');
      }
    } else {
      if (!window.confirm(`Block ${session.partner.name}? You will not be able to send messages to this user.`)) return;
      try {
        await setDoc(blockRef, {
          blockedAt: Date.now(),
          partnerId: session.partner.id,
          partnerName: session.partner.name,
        });
      } catch (error) {
        console.error('Failed to block:', error);
        alert('Could not block user.');
      }
    }
  };

 const sendMessageToFirestore = async (text: string, type: MessageType = 'text', fileData?: any) => {
    if (isBlocked) {
      alert(`You have blocked ${session.partner.name}. Unblock to send messages.`);
      return;
    }
    const now = Date.now();
    const batch = writeBatch(db);

    const userConvRef = doc(db, 'users', user.id, 'conversations', session.partner.id);
    const partnerConvRef = doc(db, 'users', session.partner.id, 'conversations', user.id);
    const newMessageRef = doc(collection(db, 'chats', session.id, 'messages'));

    const previewText = type === 'text' 
      ? text 
      : `[${type.charAt(0).toUpperCase() + type.slice(1)}]`;

    // 1. Update Sender's Conversation Inbox
    batch.set(userConvRef, {
      lastMessage: previewText,
      timestamp: now,
      partnerId: session.partner.id,
      partnerName: session.partner.name,
      partnerAvatar: session.partner.avatar,
    }, { merge: true });

    // 2. Update Receiver's Conversation Inbox
    batch.set(partnerConvRef, {
      lastMessage: previewText,
      timestamp: now,
      partnerId: user.id,
      partnerName: user.name,
      partnerAvatar: user.avatar,
      unreadCount: increment(1),
    }, { merge: true });

    // REMOVED THE TWO ROOT USER DOCUMENT UPDATES HERE

    // 3. Create the actual message document
    const messagePayload: any = {
      text,
      type,
      senderId: user.id,
      receiverId: session.partner.id,
      timestamp: now,
      read: false,
      readAt: null,
    };

    if (fileData) {
      messagePayload.fileURL = fileData.fileURL;
      messagePayload.fileName = fileData.fileName;
      messagePayload.fileSize = fileData.fileSize;
      messagePayload.mimeType = fileData.mimeType;
      if (fileData.audioDuration) messagePayload.audioDuration = fileData.audioDuration;
    }

    if (replyTarget) {
      messagePayload.replyTo = {
        messageId: replyTarget.messageId,
        text: replyTarget.text,
        senderId: replyTarget.senderId,
        senderName: replyTarget.senderName,
      };
    }

    batch.set(newMessageRef, messagePayload);

    try {
      await batch.commit();
      setReplyTarget(null);
    } catch (error) {
      console.error('Chat send error:', error);
    }
  };
  
  const confirmAndUploadAttachment = async (captionText: string, attachment: PendingAttachment) => {
    setIsUploading(true);
    setUploadProgress(0);

    const { file, type: fileType, previewUrl } = attachment;
    const uniqueFileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${file.name.split('.').pop()}`;
    const storageRef = ref(storage, `chat_attachments/${session.id}/${uniqueFileName}`);
    const uploadTask = uploadBytesResumable(storageRef, file);

    // Clean up local draft immediately from UI
    setPendingAttachment(null);
    URL.revokeObjectURL(previewUrl);

    uploadTask.on(
      'state_changed',
      (snapshot) => setUploadProgress((snapshot.bytesTransferred / snapshot.totalBytes) * 100),
      (error) => {
        console.error('Upload failed:', error);
        alert('Upload failed.');
        setIsUploading(false);
      },
      async () => {
        const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
        await sendMessageToFirestore(captionText, fileType, {
          fileURL: downloadURL,
          fileName: file.name,
          fileSize: file.size,
          mimeType: file.type,
        });
        setIsUploading(false);
        setUploadProgress(0);
      }
    );
  };

  const handleCancelAttachment = () => {
    if (pendingAttachment?.previewUrl) {
      URL.revokeObjectURL(pendingAttachment.previewUrl);
    }
    setPendingAttachment(null);
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (isBlocked) {
      alert(`You have blocked ${session.partner.name}. Unblock to send files.`);
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      alert('File is too large.');
      return;
    }

    let fileType: MessageType = 'file';
    if (file.type.startsWith('image/')) fileType = 'image';
    else if (file.type.startsWith('video/')) fileType = 'video';

    if (pendingAttachment?.previewUrl) {
      URL.revokeObjectURL(pendingAttachment.previewUrl);
    }

    setPendingAttachment({
      file,
      type: fileType,
      previewUrl: URL.createObjectURL(file)
    });

    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleVoiceUpload = async (audioBlob: Blob, duration: number) => {
    if (isBlocked) {
      alert(`You have blocked ${session.partner.name}. Unblock to send voice messages.`);
      return;
    }
    setIsUploading(true);
    setUploadProgress(0);

    const uniqueFileName = `voice_${Date.now()}_${Math.random().toString(36).substring(7)}.webm`;
    const storageRef = ref(storage, `chat_attachments/${session.id}/${uniqueFileName}`);
    const uploadTask = uploadBytesResumable(storageRef, audioBlob);

    uploadTask.on(
      'state_changed',
      (snapshot) => setUploadProgress((snapshot.bytesTransferred / snapshot.totalBytes) * 100),
      (error) => {
        console.error('Voice upload failed:', error);
        alert('Voice failed.');
        setIsUploading(false);
      },
      async () => {
        const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
        await sendMessageToFirestore('', 'voice', {
          fileURL: downloadURL,
          fileName: uniqueFileName,
          fileSize: audioBlob.size,
          mimeType: 'audio/webm',
          audioDuration: duration,
        });
        setIsUploading(false);
        setUploadProgress(0);
      }
    );
  };

  const handleDeleteMessage = async (message: ChatMessage) => {
    if (!window.confirm('Unsend this message for everyone?')) return;

    try {
      if (message.fileURL) {
        await deleteObject(ref(storage, message.fileURL)).catch((err) => console.warn(err));
      }

      await deleteDoc(doc(db, 'chats', session.id, 'messages', message.id));

      const snapshot = await getDocs(
        query(collection(db, 'chats', session.id, 'messages'), orderBy('timestamp', 'desc'), limit(1))
      );

      const userConvRef = doc(db, 'users', user.id, 'conversations', session.partner.id);
      const partnerConvRef = doc(db, 'users', session.partner.id, 'conversations', user.id);

      if (snapshot.empty) {
        await deleteDoc(userConvRef).catch((e) => console.warn(e));
        await deleteDoc(partnerConvRef).catch((e) => console.warn(e));
      } else {
        const newLastMsg = snapshot.docs[0].data() as ChatMessage;
        const previewText = newLastMsg.type === 'text' || !newLastMsg.type ? newLastMsg.text : '[Attachment]';

        await setDoc(userConvRef, { lastMessage: previewText, timestamp: newLastMsg.timestamp }, { merge: true }).catch((e) => console.warn(e));
        await setDoc(partnerConvRef, { lastMessage: previewText, timestamp: newLastMsg.timestamp }, { merge: true }).catch((e) => console.warn(e));
      }
    } catch (error) {
      console.error('Error unsending:', error);
      alert('Failed to unsend.');
    }
  };

  const handleCallClick = (type: 'voice' | 'video') => {
    if (!isPartnerOnline) {
      alert(`${session.partner.name} is offline.`);
      return;
    }
    onCall(session.partner.id, type);
  };

  const handleReplyMessage = (msg: ChatMessage) => {
    setReplyTarget({
      messageId: msg.id,
      text: msg.type === 'text' || !msg.type ? msg.text : `[${msg.type.charAt(0).toUpperCase() + msg.type.slice(1)}]`,
      senderId: msg.senderId,
      senderName: msg.senderId === user.id ? user.name : session.partner.name
    });
  };

  const handleCancelReply = () => setReplyTarget(null);

  const handleWordClick = (word: string, messageId: string, text: string) => {
    // Basic regex safe-strip for surrounding accidental punctuation
    const cleanWord = word.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '');
    if (cleanWord) {
      setSelectedWordContext({ word: cleanWord, messageId, sourceText: text });
    }
  };

  const handleToggleFavorite = async (msgId: string, currentlyFavorited: boolean) => {
    const userRef = doc(db, 'users', user.id);
    try {
      if (currentlyFavorited) {
        await updateDoc(userRef, { favoriteMessages: arrayRemove(msgId) });
        setFavorites((prev) => prev.filter((id) => id !== msgId));
      } else {
        await updateDoc(userRef, { favoriteMessages: arrayUnion(msgId) });
        setFavorites((prev) => [...prev, msgId]);
      }
    } catch (e) {
      console.error("Failed to toggle favorite", e);
    }
  };

  const handleToggleSave = async (msg: ChatMessage, type: SavedItemType, isCurrentlySaved: boolean) => {
    const docId = `${msg.id}_${type}`;
    const docRef = doc(db, 'users', user.id, 'savedItems', docId);

    try {
      if (isCurrentlySaved) {
        await deleteDoc(docRef);
      } else {
        const savedItem: SavedItem = {
          id: docId,
          userId: user.id,
          chatId: session.id,
          messageId: msg.id,
          type,
          text: msg.text || '', 
          senderId: msg.senderId,
          senderName: msg.senderId === user.id ? user.name : session.partner.name,
          timestamp: Date.now(),
          partnerName: session.partner.name,
          originalTimestamp: msg.timestamp,
        };
        await setDoc(docRef, savedItem);
      }
    } catch (e) {
      console.error(`Failed to toggle ${type}`, e);
      alert(`Could not update ${type.replace('_', ' ')}.`);
    }
  };

  return (
    <div ref={chatContainerRef} className={`flex flex-col overflow-hidden bg-gray-900 overscroll-none ${isEmbedded ? 'relative w-full h-full' : 'fixed inset-0 w-full max-w-6xl mx-auto z-50'}`}>
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
      <div className="flex-none bg-gray-900/80 backdrop-blur-xl border-b border-gray-800 shadow-sm z-20 flex justify-center">
        <div className="w-full max-w-4xl px-4 pb-3.5 pt-[max(0.875rem,env(safe-area-inset-top))] flex items-center space-x-3">
          <button onClick={onBack} className="p-2 -ml-2 text-gray-400 hover:text-gray-200 hover:bg-gray-800 rounded-full transition-all duration-200 active:scale-95">
            <svg className="w-[22px] h-[22px]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" /></svg>
          </button>
          
          <div className="flex items-center flex-1 min-w-0 space-x-3">
            <div className="relative flex-shrink-0">
              <Avatar src={session.partner.avatar} size="sm" />
              {isPartnerOnline && <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-gray-900 rounded-full"></span>}
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-gray-100 text-[16px] leading-tight truncate">{session.partner.name}</h3>
              <p className="text-[13px] text-gray-400 truncate mt-0.5">{isPartnerOnline ? 'Active now' : 'Offline'}</p>
            </div>
          </div>
          
          <div className="flex items-center space-x-1 pr-1">
            <button onClick={() => handleCallClick('video')} className={`p-2.5 rounded-full transition-all duration-200 active:scale-95 ${isPartnerOnline ? 'text-gray-400 hover:text-blue-400 hover:bg-gray-800' : 'text-gray-600 cursor-not-allowed'}`}>
              <svg className="w-[22px] h-[22px]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
            </button>
            <button onClick={() => handleCallClick('voice')} className={`p-2.5 rounded-full transition-all duration-200 active:scale-95 ${isPartnerOnline ? 'text-gray-400 hover:text-blue-400 hover:bg-gray-800' : 'text-gray-600 cursor-not-allowed'}`}>
              <svg className="w-[20px] h-[20px]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>
            </button>

            {/* Chat-level 3-dot header menu */}
            <div className="relative">
              <button
                ref={headerMenuBtnRef}
                onClick={() => setIsHeaderMenuOpen((prev) => !prev)}
                className={`p-2.5 rounded-full transition-all duration-200 active:scale-95 text-gray-400 hover:text-gray-200 hover:bg-gray-800 ${isHeaderMenuOpen ? 'bg-gray-800 text-gray-200' : ''}`}
                title="More options"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <circle cx="12" cy="5" r="2" />
                  <circle cx="12" cy="12" r="2" />
                  <circle cx="12" cy="19" r="2" />
                </svg>
              </button>
              <ChatHeaderMenu
                isOpen={isHeaderMenuOpen}
                onClose={() => setIsHeaderMenuOpen(false)}
                anchorRef={headerMenuBtnRef}
                items={[
                  {
                    label: 'Search in chat',
                    icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>,
                    onClick: () => { setIsSearchOpen(true); setIsHeaderMenuOpen(false); },
                  },
                  {
                    label: isMuted ? 'Unmute' : 'Mute',
                    active: isMuted,
                    icon: isMuted
                      ? <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072M12 6.253v11.494m-3.536-1.965a5 5 0 010-7.072M5.636 5.636a9 9 0 1012.728 0" /></svg>
                      : <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" /></svg>,
                    onClick: () => { handleToggleMute(); setIsHeaderMenuOpen(false); },
                  },
                  {
                    label: isBlocked ? `Unblock ${session.partner.name}` : `Block ${session.partner.name}`,
                    danger: !isBlocked,
                    active: isBlocked,
                    icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" /></svg>,
                    onClick: () => { handleToggleBlock(); setIsHeaderMenuOpen(false); },
                  },
                  {
                    label: 'Delete chat',
                    danger: true,
                    icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>,
                    onClick: () => { handleDeleteConversation(); setIsHeaderMenuOpen(false); },
                  },
                ]}
              />
            </div>
          </div>
        </div>
      </div>

      {/* In-chat search bar */}
      {isSearchOpen && (
        <ChatSearchBar
          messages={messages}
          messageRefs={messageRefs}
          onClose={() => setIsSearchOpen(false)}
        />
      )}

      {/* Messages Area */}
      <div ref={scrollContainerRef} className="flex-1 overflow-y-auto relative bg-gray-900 z-0 flex justify-center">
        <div className="w-full max-w-4xl px-4 py-6">
          {messages.map((msg, index) => {
            const prevMsg = messages[index - 1];
            const nextMsg = messages[index + 1];

            const showDate = !prevMsg || !isSameDay(prevMsg.timestamp, msg.timestamp);
            const TIME_LIMIT = 5 * 60 * 1000;
            const isGroupedWithPrev = prevMsg && prevMsg.senderId === msg.senderId && (msg.timestamp - prevMsg.timestamp < TIME_LIMIT) && !showDate;
            const isGroupedWithNext = nextMsg && nextMsg.senderId === msg.senderId && (nextMsg.timestamp - msg.timestamp < TIME_LIMIT) && isSameDay(msg.timestamp, nextMsg.timestamp);

            const isGroupStart = !isGroupedWithPrev;
            const isGroupEnd = !isGroupedWithNext;
            const marginTop = index === 0 ? 'mt-0' : (isGroupedWithPrev ? 'mt-1' : 'mt-4');

            const isMe = msg.senderId === user.id;
            const isFavorited = favorites.includes(msg.id);
            const isPhrasebookSaved = savedStates[msg.id]?.phrasebook || false;
            const isStudyLater = savedStates[msg.id]?.study_later || false;
            
            const isActiveMenu = menuConfig?.id === msg.id;

            const actionMenu = (
              <div className={`relative flex flex-col justify-start pt-1.5 ${isMe ? 'mr-2' : 'ml-2'}`}>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (isActiveMenu) {
                      setMenuConfig(null);
                    } else {
                      const rect = e.currentTarget.getBoundingClientRect();
                      const shouldOpenUp = (window.innerHeight - rect.bottom) < 250;
                      const shouldOpenLeft = rect.left > (window.innerWidth / 2);
                      
                      setMenuConfig({
                        id: msg.id,
                        rect: { top: rect.top, bottom: rect.bottom, left: rect.left, right: rect.right },
                        position: shouldOpenUp ? 'bottom' : 'top',
                        align: shouldOpenLeft ? 'right' : 'left'
                      });
                    }
                  }}
                  className={`p-1.5 rounded-full text-gray-500 hover:text-gray-200 hover:bg-gray-800 transition-all ${
                    isActiveMenu ? 'opacity-100 bg-gray-800' : 'opacity-0 group-hover:opacity-100'
                  }`}
                  title="Message options"
                >
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <circle cx="5" cy="12" r="2" />
                    <circle cx="12" cy="12" r="2" />
                    <circle cx="19" cy="12" r="2" />
                  </svg>
                </button>

                {isActiveMenu && typeof document !== 'undefined' && createPortal(
                  <div 
                    className="fixed w-48 bg-gray-800 border border-gray-700 rounded-lg shadow-2xl py-1 z-[100] overflow-hidden"
                    style={{
                      ...(menuConfig.position === 'top' 
                        ? { top: menuConfig.rect.bottom + 4 } 
                        : { bottom: window.innerHeight - menuConfig.rect.top + 4 }),
                      ...(menuConfig.align === 'left' 
                        ? { left: Math.max(12, menuConfig.rect.left) } 
                        : { right: Math.max(12, window.innerWidth - menuConfig.rect.right) })
                    }}
                  >
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleReplyMessage(msg);
                        setMenuConfig(null);
                      }}
                      className="w-full text-left px-4 py-2.5 text-[13px] font-medium text-gray-200 hover:bg-gray-700 hover:text-white transition-colors"
                    >
                      Reply
                    </button>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleToggleSave(msg, 'phrasebook', isPhrasebookSaved);
                        setMenuConfig(null);
                      }}
                      className={`w-full text-left px-4 py-2.5 text-[13px] font-medium transition-colors ${
                        isPhrasebookSaved 
                          ? 'text-emerald-400 hover:bg-gray-700 hover:text-emerald-300' 
                          : 'text-gray-200 hover:bg-gray-700 hover:text-white'
                      }`}
                    >
                      {isPhrasebookSaved ? 'Remove from phrasebook' : 'Save to phrasebook'}
                    </button>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleToggleSave(msg, 'study_later', isStudyLater);
                        setMenuConfig(null);
                      }}
                      className={`w-full text-left px-4 py-2.5 text-[13px] font-medium transition-colors ${
                        isStudyLater 
                          ? 'text-purple-400 hover:bg-gray-700 hover:text-purple-300' 
                          : 'text-gray-200 hover:bg-gray-700 hover:text-white'
                      }`}
                    >
                      {isStudyLater ? 'Remove from study later' : 'Mark as study later'}
                    </button>
                    
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleToggleFavorite(msg.id, isFavorited);
                        setMenuConfig(null);
                      }}
                      className="w-full text-left px-4 py-2.5 text-[13px] font-medium text-amber-400 hover:bg-gray-700 hover:text-amber-300 transition-colors"
                    >
                      {isFavorited ? 'Unfavorite' : 'Favorite'}
                    </button>

                    {isMe && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteMessage(msg);
                          setMenuConfig(null);
                        }}
                        className="w-full text-left px-4 py-2.5 text-[13px] font-medium text-red-400 hover:bg-gray-700 hover:text-red-300 transition-colors"
                      >
                        Unsend
                      </button>
                    )}
                  </div>,
                  document.body
                )}
              </div>
            );

            return (
              <React.Fragment key={msg.id}>
                {showDate && (
                  <div className="flex justify-center my-6">
                    <span className="px-3 py-1 bg-gray-800/80 text-gray-400 border border-gray-700/50 text-[11px] font-bold rounded-full uppercase tracking-wider backdrop-blur-sm shadow-sm">
                      {formatDateSeparator(msg.timestamp)}
                    </span>
                  </div>
                )}

                <div 
                  ref={(el) => {messageRefs.current[msg.id] = el; }}
                  className={`group flex w-full animate-chat-msg ${isMe ? 'justify-end' : 'justify-start'} ${marginTop}`}
                >
                  {isMe && actionMenu}

                  <MessageBubble 
                    message={msg} 
                    isMe={isMe} 
                    isGroupStart={isGroupStart}
                    isGroupEnd={isGroupEnd}
                    isFavorited={isFavorited}
                    isPhrasebookSaved={isPhrasebookSaved}
                    isStudyLater={isStudyLater}
                    onReplyClick={scrollToOriginalMessage}
                    onWordClick={handleWordClick}
                  />

                  {!isMe && actionMenu}
                </div>
              </React.Fragment>
            );
          })}

          {isUploading && (
            <div className="flex w-full justify-end animate-chat-msg mt-4">
              <div className="bg-gray-800 border border-gray-700 max-w-[80%] px-4 py-2 rounded-2xl rounded-tr-[4px] shadow-sm flex items-center space-x-2">
                <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                <span className="text-xs text-gray-300 font-medium">Sending... {Math.round(uploadProgress)}%</span>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} className="h-2" />
        </div>
      </div>

      {/* Blocked user banner */}
      {isBlocked && (
        <div className="flex-none bg-red-900/20 border-t border-red-900/30 px-4 py-2.5 flex items-center justify-center space-x-2 z-20">
          <svg className="w-4 h-4 text-red-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
          </svg>
          <span className="text-[13px] text-red-400 font-medium">You blocked {session.partner.name}.</span>
          <button
            onClick={handleToggleBlock}
            className="text-[13px] text-red-300 hover:text-red-200 font-semibold underline underline-offset-2 transition-colors"
          >
            Unblock
          </button>
        </div>
      )}

      {/* Input Field Area */}
      <div className="flex-none relative z-20 bg-gray-900 border-t border-gray-800 transition-colors duration-300 flex justify-center">
        <div className="w-full max-w-4xl">
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleFileSelect} 
            className="hidden" 
          />
          
          <ChatInput 
            onSendMessage={(text) => sendMessageToFirestore(text, 'text')} 
            onSendVoice={handleVoiceUpload} 
            onTriggerFileSelect={(type) => {
              if (isBlocked) {
                alert(`You have blocked ${session.partner.name}. Unblock to send files.`);
                return;
              }
              if (fileInputRef.current) {
                fileInputRef.current.accept = type === 'media' 
                  ? 'image/*,video/*' 
                  : '.pdf,.doc,.docx,.xls,.xlsx,.txt,.zip';
                fileInputRef.current.click();
              }
            }} 
            isUploading={isUploading}
            replyTarget={replyTarget}
            onCancelReply={handleCancelReply}
            currentUserId={user.id}
          />
        </div>
      </div>

      {/* Word Context Action Popup */}
      {selectedWordContext && (
        <WordActionPopup 
          word={selectedWordContext.word} 
          messageId={selectedWordContext.messageId}
          chatId={session.id}
          sourceText={selectedWordContext.sourceText}
          userId={user.id}
          onClose={() => setSelectedWordContext(null)} 
        />
      )}

      {/* Attachment Modal */}
      {pendingAttachment && (
        <AttachmentPreviewModal 
          attachment={pendingAttachment}
          onClose={handleCancelAttachment}
          onSend={(caption) => confirmAndUploadAttachment(caption, pendingAttachment)}
        />
      )}
    </div>
  );
};

export default ChatRoom;