import { db, auth } from './firebase';
import { doc, getDoc, setDoc, updateDoc, collection, query, where, orderBy, onSnapshot, getDocs, writeBatch, increment } from 'firebase/firestore';
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
import Landing from './components/Landing';
import { onAuthStateChanged, signOut, signInWithEmailAndPassword } from 'firebase/auth';
import SavedItemsView from './components/SavedItemsView';
import ProgressView from './components/ProgressView';
import { useMediaQuery } from './hooks/useMediaQuery';
import { playMessageNotification } from './utils/notificationSound';
import BottomNav from './components/BottomNav';

const App: React.FC = () => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [view, setView] = useState<'landing' | 'auth' | 'setup' | 'main' | 'chat' | 'call'>('landing');
  const [authMode, setAuthMode] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<TabType>('dashboard');
  const [activeSession, setActiveSession] = useState<ChatSession | null>(null);
  const [selectedPartner, setSelectedPartner] = useState<UserProfile | null>(null);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [jumpToMessageId, setJumpToMessageId] = useState<string | null>(null);
  const [totalUnread, setTotalUnread] = useState<number>(0);

  // Desktop: ≥768px — keeps sidebar visible alongside chat
  const isDesktop = useMediaQuery('(min-width: 768px)');
  
  const ringtoneRef = useRef<HTMLAudioElement | null>(null);

  // Notification sound tracking refs
  const prevUnreadTotalRef = useRef<number | null>(null);
  const notifInitializedRef = useRef(false);

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
        } else {
          const newProfile: UserProfile = {
            id: firebaseUser.uid,
            name: firebaseUser.displayName || '',
            email: firebaseUser.email || '',
            avatar: firebaseUser.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${firebaseUser.uid}`,
            bio: '',
            nativeLanguage: Language.ENGLISH,
            targetLanguage: Language.SPANISH,
            xp: 0
          };
          setUser(newProfile);
          setView('setup');
        }
      } else {
        setUser(null);
        setView('landing');
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

  // ── Global notification sound listener ──
  // Watches the user's conversations subcollection for unread count changes.
  // Plays a sound when total unread increases (new incoming message).
  // Uses a ref for `view` to avoid re-subscribing the Firestore listener on view changes.
  const viewRef = useRef(view);
  useEffect(() => { viewRef.current = view; }, [view]);

  useEffect(() => {
    if (!user) {
      // Reset tracking on logout
      prevUnreadTotalRef.current = null;
      notifInitializedRef.current = false;
      return;
    }

    const convQuery = query(
      collection(db, 'users', user.id, 'conversations'),
      orderBy('timestamp', 'desc')
    );

    const unsub = onSnapshot(convQuery, async (snapshot) => {
      // Sum up unread counts, but exclude muted conversations
      // Also check blocked users to suppress their notifications
      let totalUnmutedUnread = 0;

      // Load blocked user IDs once per snapshot for efficiency
      let blockedIds: Set<string> = new Set();
      try {
        const blockedSnap = await getDocs(collection(db, 'users', user.id, 'blockedUsers'));
        blockedSnap.docs.forEach((d) => blockedIds.add(d.id));
      } catch {
        // If blocked collection doesn't exist yet, just proceed
      }

      snapshot.docs.forEach((d) => {
        const data = d.data();
        const unread = data.unreadCount || 0;
        const isMuted = data.muted === true;
        const partnerId = data.partnerId || d.id;
        const isBlockedUser = blockedIds.has(partnerId);

        // Only count unread from non-muted, non-blocked conversations
        if (!isMuted && !isBlockedUser) {
          totalUnmutedUnread += unread;
        }
      });

      if (!notifInitializedRef.current) {
        // First snapshot after mount/login — record baseline, don't play sound
        prevUnreadTotalRef.current = totalUnmutedUnread;
        notifInitializedRef.current = true;
        return;
      }

      const prevTotal = prevUnreadTotalRef.current ?? 0;

      if (totalUnmutedUnread > prevTotal) {
        // New incoming message detected from a non-muted, non-blocked conversation
        if (viewRef.current !== 'call') {
          playMessageNotification();
        }
      }

      prevUnreadTotalRef.current = totalUnmutedUnread;
      setTotalUnread(totalUnmutedUnread);
    });

    return () => unsub();
  }, [user]);

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
    // On desktop, keep 'main' view so sidebar stays visible
    // On mobile, switch to full-screen 'chat' view as before
    setView(isDesktop ? 'main' : 'chat');
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

  const logCallMessageInChat = async (targetPartner: UserProfile, status: 'missed' | 'rejected' | 'declined' | 'ended' | 'offline' | 'busy', type: 'voice' | 'video', callerId: string) => {
    if (!user) return;
    const isCaller = user.id === callerId;
    const chatId = [user.id, targetPartner.id].sort().join('_');
    let text = '';
    const typeCased = type.charAt(0).toUpperCase() + type.slice(1);
    
    if (status === 'missed') text = isCaller ? `No answer for ${type} call` : `Missed ${type} call`;
    else if (status === 'rejected' || status === 'declined') text = isCaller ? `${typeCased} call declined` : `You declined ${type} call`;
    else if (status === 'offline') text = `Missed ${type} call (User offline)`;
    else if (status === 'busy') text = `Missed ${type} call (User busy)`;
    else if (status === 'ended') text = `${typeCased} call ended`;

    const now = Date.now();
    const batch = writeBatch(db);
    const newMessageRef = doc(collection(db, 'chats', chatId, 'messages'));
    
    batch.set(newMessageRef, {
      text,
      type: 'system',
      senderId: callerId, 
      receiverId: isCaller ? targetPartner.id : user.id,
      timestamp: now,
      read: false,
      readAt: null
    });

    const userConvRef = doc(db, 'users', user.id, 'conversations', targetPartner.id);
    const partnerConvRef = doc(db, 'users', targetPartner.id, 'conversations', user.id);
    
    const previewText = `[${typeCased} Call]`;

    batch.set(userConvRef, {
      lastMessage: previewText,
      timestamp: now,
      partnerId: targetPartner.id,
      partnerName: targetPartner.name,
      partnerAvatar: targetPartner.avatar,
    }, { merge: true });

    batch.set(partnerConvRef, {
      lastMessage: previewText,
      timestamp: now,
      partnerId: user.id,
      partnerName: user.name,
      partnerAvatar: user.avatar,
      unreadCount: increment(1),
    }, { merge: true });

    try {
      await batch.commit();
    } catch(e) {
      console.warn("Could not log call message:", e);
    }
  };

  const handleStartCall = async (partner: UserProfile, existingCallId?: string, type: 'voice' | 'video' = 'voice') => {
    if (!user) return;

    let callIdToUse = existingCallId;

    if (!existingCallId) {
      try {
        const partnerDoc = await getDoc(doc(db, 'users', partner.id));
        const partnerData = partnerDoc.data() as UserProfile | undefined;
        
        const isRecent = partnerData?.lastSeen ? Date.now() - partnerData.lastSeen < 120000 : false;
        const isOnline = partnerData?.isOnline && isRecent;
        
        if (!isOnline) {
          alert(`${partner.name} is offline.`);
          await logCallMessageInChat(partner, 'offline', type, user.id);
          return;
        }

        const receiverCallsQuery = query(
          collection(db, "calls"),
          where("receiverId", "==", partner.id),
          where("status", "in", ["ringing", "connecting", "active"])
        );
        const callerCallsQuery = query(
          collection(db, "calls"),
          where("callerId", "==", partner.id),
          where("status", "in", ["ringing", "connecting", "active"])
        );

        const [receiverSnap, callerSnap] = await Promise.all([
          getDocs(receiverCallsQuery),
          getDocs(callerCallsQuery)
        ]);

        const now = Date.now();
        const isBusy = [...receiverSnap.docs, ...callerSnap.docs].some((docSnap) => {
          const c = docSnap.data();
          const age = now - (c.createdAt || 0);

          // Ignore stale ringing/connecting stuck over 60s
          if ((c.status === 'ringing' || c.status === 'connecting') && age > 60000) return false;
          // Ignore abandoned active calls stuck over 12 hours
          if (c.status === 'active' && age > 12 * 60 * 60 * 1000) return false;
          
          return true;
        });

        if (isBusy) {
          alert(`${partner.name} is currently in another call.`);
          await logCallMessageInChat(partner, 'busy', type, user.id);
          return;
        }

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
    setView('landing');
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
      const partner: UserProfile = {
        id: incomingCall.callerId,
        name: incomingCall.callerName,
        avatar: incomingCall.callerAvatar,
        email: '',
        bio: '',
        nativeLanguage: Language.ENGLISH,
        targetLanguage: Language.SPANISH
      };
      await logCallMessageInChat(partner, 'rejected', incomingCall.type, incomingCall.callerId);
      setIncomingCall(null);
    } catch (error) {
      console.error("Error rejecting call:", error);
    }
  };

  const renderMainContent = () => {
    if (!user) return null;
    switch (activeTab) {
      case 'dashboard': return <Dashboard user={user} onLogout={handleLogout} onEditProfile={() => setActiveTab('profile')} onNavigateToProgress={() => setActiveTab('progress')} />;
      case 'progress': return <ProgressView user={user} />;
      case 'partners': return <FindPartners user={user} onStartChat={handleStartChat} />;
      case 'chats': return <ChatsList user={user} onSelectChat={handleStartChat} />;
      case 'saved': return <SavedItemsView user={user} onJumpToMessage={handleJumpToMessage} />;
      case 'profile': return <ProfileSetup profile={user} onSave={handleProfileSave} onLogout={handleLogout} />;
      default: return null;
    }
  };

  return (
    <div className="fixed inset-0 w-full flex flex-col max-w-6xl mx-auto bg-white shadow-xl overflow-hidden overscroll-none touch-manipulation">
      <style>{`
        @keyframes slideInDown {
          0% { opacity: 0; transform: translateY(-20px); }
          100% { opacity: 1; transform: translateY(0); }
        }
        .animate-call-popup {
          animation: slideInDown 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
      `}</style>
      
      {/* Incoming Call Overlay */}
      {incomingCall && view !== 'call' && (
        <div className="absolute top-4 left-4 right-4 md:left-auto md:right-6 md:w-96 z-[100] animate-call-popup">
          <div className="bg-gray-900 border border-gray-700/50 shadow-[0_20px_50px_rgba(0,0,0,0.5)] rounded-2xl p-4 flex items-center space-x-4 backdrop-blur-xl">
            <div className="relative flex-shrink-0">
              <img src={incomingCall.callerAvatar} alt="caller" className="w-14 h-14 rounded-full object-cover border border-gray-700" />
              <span className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-[#25d366] border-2 border-gray-900 rounded-full animate-pulse"></span>
            </div>
            
            <div className="flex-1 min-w-0">
              <h4 className="font-bold text-gray-100 text-base truncate">{incomingCall.callerName}</h4>
              <p className="text-sm text-[#25d366] font-medium flex items-center gap-1.5 mt-0.5">
                {incomingCall.type === 'video' ? (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                ) : (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>
                )}
                Incoming {incomingCall.type} call
              </p>
            </div>
            
            <div className="flex items-center space-x-2 flex-shrink-0">
              <button 
                onClick={handleRejectCall} 
                className="w-10 h-10 flex items-center justify-center bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white rounded-full transition-colors"
                title="Decline"
              >
                <svg className="w-5 h-5 rotate-135" fill="currentColor" viewBox="0 0 24 24"><path d="M12 9c-1.6 0-3.15.25-4.6.72v3.1c0 .39-.23.74-.56.9-.98.49-1.87 1.12-2.66 1.85-.18.18-.43.28-.7.28-.28 0-.53-.11-.71-.29L.29 13.08a.994.994 0 01-.29-.7c0-.28.11-.53.29-.71C3.34 8.78 7.46 7 12 7s8.66 1.78 11.71 4.67c.18.18.29.43.29.71 0 .28-.11.53-.29.71l-2.48 2.48c-.18.18-.43.29-.71.29-.27 0-.52-.11-.7-.28-.79-.74-1.69-1.36-2.67-1.85-.33-.16-.56-.5-.56-.9v-3.1C15.15 9.25 13.6 9 12 9z" /></svg>
              </button>
              <button 
                onClick={handleAcceptCall} 
                className="w-10 h-10 flex items-center justify-center bg-[#25d366] text-white hover:bg-green-500 rounded-full transition-colors shadow-lg shadow-[#25d366]/30"
                title="Accept"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M6.62 10.79a15.053 15.053 0 006.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z" /></svg>
              </button>
            </div>
          </div>
        </div>
      )}

      {view === 'landing' && <Landing onNavigateToAuth={(isLogin) => { setAuthMode(isLogin); setView('auth'); }} />}
      {view === 'auth' && <Auth key={authMode ? 'login' : 'signup'} initialIsLogin={authMode} onLogin={handleLogin} onBack={() => setView('landing')} />}
      {view === 'setup' && user && <ProfileSetup profile={user} onSave={handleProfileSave} onLogout={handleLogout} />}
      
      {view === 'main' && user && (
        <div className="flex flex-1 overflow-hidden h-full">
          <Sidebar 
            activeTab={activeTab} 
            onTabChange={(tab) => {
              setActiveTab(tab);
              // On desktop, close the embedded chat when switching tabs
              if (isDesktop && activeSession) {
                setActiveSession(null);
                setActiveChatId(null);
                setJumpToMessageId(null);
              }
            }} 
            user={user}
            onLogout={handleLogout}
            onSettings={() => setActiveTab('profile')}
            unreadCount={totalUnread}
          />
          <main className="flex-1 flex flex-col overflow-hidden pb-[calc(4rem+env(safe-area-inset-bottom))] md:pb-0">
            {/* Desktop: show embedded chat beside sidebar when a session is active */}
            {isDesktop && activeSession ? (
              <ChatRoom
                user={user}
                session={activeSession}
                isEmbedded
                onBack={() => {
                  setActiveSession(null);
                  setActiveChatId(null);
                  setJumpToMessageId(null);
                }}
                onDeleteChat={() => {
                  setActiveSession(null);
                  setActiveChatId(null);
                  setJumpToMessageId(null);
                }}
                onCall={(partnerId, type) => handleStartCall(activeSession.partner, undefined, type)}
                jumpToMessageId={jumpToMessageId}
                onJumpComplete={() => setJumpToMessageId(null)}
              />
            ) : (
              renderMainContent()
            )}
          </main>
          {/* Mobile Bottom Navigation */}
          {!isDesktop && (
            <BottomNav 
              activeTab={activeTab} 
              onTabChange={setActiveTab} 
              unreadCount={totalUnread}
            />
          )}
        </div>
      )}

      {/* Mobile only: full-screen chat view */}
      {view === 'chat' && !isDesktop && activeSession && user && (
        <ChatRoom 
          user={user} 
          session={activeSession} 
          onBack={() => { setView('main'); setActiveSession(null); setActiveChatId(null); setJumpToMessageId(null); }}
          onDeleteChat={() => { setView('main'); setActiveSession(null); setActiveChatId(null); setJumpToMessageId(null); }}
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
          onClose={(reason) => {
            if (reason === 'missed' || reason === 'ended') {
              // Ensure we only log if it's our action to log or was missed by system
              // The caller logs a missed call.
              if (reason === 'missed' && activeCallId) {
                logCallMessageInChat(activeSession.partner, 'missed', activeCallType, user.id);
              }
              // Active ended call is logged as 'ended'
              if (reason === 'ended' && activeCallId) {
                logCallMessageInChat(activeSession.partner, 'ended', activeCallType, user.id);
              }
            }
            setView(activeSession.id.startsWith('call_') ? 'main' : (isDesktop ? 'main' : 'chat'));
          }} 
        />
      )}
    </div>
  );
};

export default App;