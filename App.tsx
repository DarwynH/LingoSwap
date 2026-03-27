import { db, auth } from './firebase';
import { doc, getDoc, setDoc, updateDoc, collection, query, where, onSnapshot } from 'firebase/firestore';
import React, { useState, useEffect, useRef } from 'react';
import { UserProfile, Language, ChatSession, CallData, ChatMessage } from './types';
import Auth from './components/Auth';
import Dashboard from './components/Dashboard';
import FindPartners from './components/FindPartners';
import ChatsList from './components/ChatsList';
import ChatRoom from './components/ChatRoom';
import CallRoom from './components/CallRoom';
import ProfileSetup from './components/ProfileSetup';
import Sidebar, { TabType } from './components/Sidebar';
import { onAuthStateChanged, signOut, signInWithEmailAndPassword } from 'firebase/auth';
import SavedItemsView from './components/SavedItemsView';

const App: React.FC = () => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [view, setView] = useState<'auth' | 'setup' | 'main' | 'chat' | 'call'>('auth');
  const [activeTab, setActiveTab] = useState<TabType>('dashboard');
  const [activeSession, setActiveSession] = useState<ChatSession | null>(null);
  const [selectedPartner, setSelectedPartner] = useState<UserProfile | null>(null);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [jumpToMessageId, setJumpToMessageId] = useState<string | null>(null);
  
  const ringtoneRef = useRef<HTMLAudioElement | null>(null);

  const [incomingCall, setIncomingCall] = useState<CallData | null>(null);
  const [activeCallId, setActiveCallId] = useState<string | null>(null);
  const [activeCallType, setActiveCallType] = useState<'voice' | 'video'>('voice');

  useEffect(() => {
    if (incomingCall && view !== 'call') {
      if (!ringtoneRef.current) {
        ringtoneRef.current = new Audio('/ringtone.mp3');
        ringtoneRef.current.loop = true;
      }
      ringtoneRef.current.play().catch(e => console.warn("Audio autoplay blocked:", e));
    } else {
      if (ringtoneRef.current) {
        ringtoneRef.current.pause();
        ringtoneRef.current.currentTime = 0;
      }
    }

    return () => {
      if (ringtoneRef.current) {
        ringtoneRef.current.pause();
      }
    };
  }, [incomingCall, view]);

useEffect(() => {
    let callUnsub: () => void;
    let heartbeatInterval: NodeJS.Timeout;

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        const userRef = doc(db, "users", firebaseUser.uid);
        const userDoc = await getDoc(userRef);

        if (userDoc.exists()) {
          await updateDoc(userRef, { isOnline: true, lastSeen: Date.now() });
          setUser(userDoc.data() as UserProfile);
          setView('main');

          heartbeatInterval = setInterval(() => {
            if (document.visibilityState === 'visible') {
              updateDoc(userRef, { isOnline: true, lastSeen: Date.now() }).catch(e => console.warn(e));
            }
          }, 60000);

          const callsQuery = query(
            collection(db, "calls"),
            where("receiverId", "==", firebaseUser.uid),
            where("status", "==", "ringing")
          );

          callUnsub = onSnapshot(callsQuery, (snapshot) => {
            if (!snapshot.empty) {
              const callDoc = snapshot.docs[0];
              setIncomingCall({ id: callDoc.id, ...callDoc.data() } as CallData);
            } else {
              setIncomingCall(null);
            }
          });
        }
      } else {
        setUser(null);
        setView('auth');
        if (heartbeatInterval) clearInterval(heartbeatInterval);
      }
    });

    const handleVisibility = () => {
      if (!auth.currentUser) return;
      const userRef = doc(db, "users", auth.currentUser.uid);
      updateDoc(userRef, { 
        isOnline: document.visibilityState === 'visible',
        lastSeen: Date.now() 
      }).catch(e => console.warn(e));
    };

    const handleUnload = () => {
      if (auth.currentUser) {
        const userRef = doc(db, "users", auth.currentUser.uid);
        updateDoc(userRef, { isOnline: false, lastSeen: Date.now() });
      }
    };

    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener('beforeunload', handleUnload);

    return () => {
      unsubscribe();
      if (callUnsub) callUnsub();
      if (heartbeatInterval) clearInterval(heartbeatInterval);
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener('beforeunload', handleUnload);
    };
  }, []);

  const handleProfileSave = async (updatedProfile: UserProfile) => {
    if (!auth.currentUser) return;
    try {
      const userRef = doc(db, "users", auth.currentUser.uid);
      await setDoc(userRef, updatedProfile, { merge: true });
      setUser(updatedProfile);
      setActiveTab('partners');
      setView('main');
    } catch (error) {
      console.error("Firestore Save Error:", error);
    }
  };

  const handleStartChat = (partner: UserProfile, chatId: string) => {
    const session: ChatSession = { id: chatId, partner, messages: [] };
    setActiveSession(session);
    setSelectedPartner(partner);
    setActiveChatId(chatId);
    setView('chat');
  };

  const handleJumpToMessage = async (chatId: string, messageId: string) => {
    try {
      if (!auth.currentUser) return;
      
      const msgRef = doc(db, 'chats', chatId, 'messages', messageId);
      const msgDoc = await getDoc(msgRef);
      if (!msgDoc.exists()) {
        alert("Original message could not be found.");
        return;
      }
      
      const msgData = msgDoc.data() as ChatMessage;
      let targetPartnerId = msgData.senderId === auth.currentUser.uid ? msgData.receiverId : msgData.senderId;

      if (!targetPartnerId) {
        const parts = chatId.split('_');
        if (parts.length === 2) {
          targetPartnerId = parts[0] === auth.currentUser.uid ? parts[1] : parts[0];
        }
      }

      if (!targetPartnerId) {
        alert("Could not identify the chat partner.");
        return;
      }

      const partnerRef = doc(db, 'users', targetPartnerId);
      const partnerDoc = await getDoc(partnerRef);
      if (!partnerDoc.exists()) {
        alert("Chat partner no longer exists.");
        return;
      }

      setJumpToMessageId(messageId);
      handleStartChat(partnerDoc.data() as UserProfile, chatId);
    } catch (e) {
      console.error("Jump to message error:", e);
      alert("An error occurred while trying to jump to the message.");
    }
  };

  const handleStartCall = async (partner: UserProfile, existingCallId?: string, type: 'voice' | 'video' = 'voice') => {
    if (!user) return;

    let callIdToUse = existingCallId;

    if (!existingCallId) {
      try {
        const callDocRef = doc(collection(db, 'calls'));
        callIdToUse = callDocRef.id;

        await setDoc(callDocRef, {
          callerId: user.id,
          receiverId: partner.id,
          callerName: user.name,
          callerAvatar: user.avatar,
          type: type,
          status: 'ringing', 
          createdAt: Date.now()
        });
      } catch (error) {
        console.error("Failed to initiate call in Firestore:", error);
        alert("Could not start call. Check your network or adblocker.");
        return; 
      }
    }

    if (activeSession?.partner.id !== partner.id) {
      setActiveSession({ id: `call_${partner.id}`, partner, messages: [] });
    }
    
    // FIXED: These state updates must happen unconditionally at the end of the function
    setActiveCallId(callIdToUse || null);
    setActiveCallType(type); 
    setView('call');
  };

  const handleLogin = async (email: string, password: string): Promise<void> => {
    const res = await signInWithEmailAndPassword(auth, email, password);
    const userDoc = await getDoc(doc(db, "users", res.user.uid));
    if (userDoc.exists()) {
      await updateDoc(doc(db, "users", res.user.uid), { isOnline: true });
      setUser(userDoc.data() as UserProfile);
      setView('main');
    }
  };
  
  const handleLogout = async () => {
    if (user) {
      await updateDoc(doc(db, "users", user.id), { isOnline: false });
    }
    await signOut(auth);
    sessionStorage.removeItem('lingoswap_user');
    setUser(null);
    setView('auth');
  };

  const handleAcceptCall = async () => {
    if (!incomingCall) return;
    try {
      await updateDoc(doc(db, "calls", incomingCall.id), { status: 'connecting' });
      const partner: UserProfile = {
        id: incomingCall.callerId,
        name: incomingCall.callerName,
        avatar: incomingCall.callerAvatar,
        email: '',
        bio: '',
        nativeLanguage: Language.ENGLISH,
        targetLanguage: Language.SPANISH
      };
      
      const type = incomingCall.type || 'voice'; 
      setIncomingCall(null);
      handleStartCall(partner, incomingCall.id, type);
    } catch (error) {
      console.error("Error accepting call:", error);
    }
  };

  const handleRejectCall = async () => {
    if (!incomingCall) return;
    try {
      await updateDoc(doc(db, "calls", incomingCall.id), { status: 'rejected' });
      setIncomingCall(null);
    } catch (error) {
      console.error("Error rejecting call:", error);
    }
  };

  const renderMainContent = () => {
    if (!user) return null;
    switch (activeTab) {
      case 'dashboard': return <Dashboard user={user} onLogout={handleLogout} onEditProfile={() => setView('setup')} />;
      case 'partners': return <FindPartners user={user} onStartChat={handleStartChat} />;
      case 'chats': return <ChatsList user={user} onSelectChat={handleStartChat} />;
      case 'saved': return <SavedItemsView user={user} onJumpToMessage={handleJumpToMessage} />;
      default: return null;
    }
  };

  return (
    <div className="fixed inset-0 w-full flex flex-col max-w-6xl mx-auto bg-white shadow-xl overflow-hidden overscroll-none touch-manipulation">
      {/* Incoming Call Overlay */}
      {incomingCall && view !== 'call' && (
        <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-[100] bg-[#1a1a1a] text-white p-4 rounded-2xl shadow-2xl flex items-center space-x-4 border border-[#25d366]/30 animate-bounce">
          <img src={incomingCall.callerAvatar} alt="caller" className="w-12 h-12 rounded-full border-2 border-[#25d366]" />
          <div>
            <h4 className="font-bold">{incomingCall.callerName}</h4>
            <p className="text-sm text-[#25d366]">
              Incoming {incomingCall.type === 'video' ? 'video' : 'voice'} call...
            </p>
          </div>
          <div className="flex space-x-2 ml-4">
            <button onClick={handleRejectCall} className="p-3 bg-red-500 rounded-full hover:bg-red-600">
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 9c-1.6 0-3.15.25-4.6.72v3.1c0 .39-.23.74-.56.9-.98.49-1.87 1.12-2.66 1.85-.18.18-.43.28-.7.28-.28 0-.53-.11-.71-.29L.29 13.08a.994.994 0 01-.29-.7c0-.28.11-.53.29-.71C3.34 8.78 7.46 7 12 7s8.66 1.78 11.71 4.67c.18.18.29.43.29.71 0 .28-.11.53-.29.71l-2.48 2.48c-.18.18-.43.29-.71.29-.27 0-.52-.11-.7-.28-.79-.74-1.69-1.36-2.67-1.85-.33-.16-.56-.5-.56-.9v-3.1C15.15 9.25 13.6 9 12 9z" /></svg>
            </button>
            <button onClick={handleAcceptCall} className="p-3 bg-[#25d366] rounded-full hover:bg-green-500">
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M6.62 10.79a15.053 15.053 0 006.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z" /></svg>
            </button>
          </div>
        </div>
      )}

      {view === 'auth' && <Auth onLogin={handleLogin} />}
      {view === 'setup' && user && <ProfileSetup profile={user} onSave={handleProfileSave} />}
      
      {view === 'main' && user && (
        <div className="flex flex-1 overflow-hidden h-full">
          <Sidebar activeTab={activeTab} onTabChange={setActiveTab} />
          <main className="flex-1 flex flex-col overflow-hidden">
            {renderMainContent()}
          </main>
        </div>
      )}

      {view === 'chat' && activeSession && user && (
        <ChatRoom 
          user={user} 
          session={activeSession} 
          onBack={() => { setView('main'); setJumpToMessageId(null); }} 
          onCall={(partnerId, type) => handleStartCall(activeSession.partner, undefined, type)}
          jumpToMessageId={jumpToMessageId}
          onJumpComplete={() => setJumpToMessageId(null)}
        />
      )}

      {view === 'call' && activeSession && user && (
        <CallRoom 
          currentUser={user}        
          callId={activeCallId}     
          partner={activeSession.partner} 
          callType={activeCallType} 
          onClose={() => setView(activeSession.id.startsWith('call_') ? 'main' : 'chat')} 
        />
      )}
    </div>
  );
};

export default App;