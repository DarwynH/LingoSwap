import { db } from './firebase';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import React, { useState, useEffect } from 'react';
import { UserProfile, Language, ChatSession } from './types';
import Auth from './components/Auth';
import Dashboard from './components/Dashboard';
import FindPartners from './components/FindPartners';
import ChatsList from './components/ChatsList';
import ChatRoom from './components/ChatRoom';
import CallRoom from './components/CallRoom';
import ProfileSetup from './components/ProfileSetup';
import Sidebar, { TabType } from './components/Sidebar';
import { auth } from './firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { signOut } from 'firebase/auth';
import { signInWithEmailAndPassword } from 'firebase/auth';


const App: React.FC = () => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [view, setView] = useState<'auth' | 'setup' | 'main' | 'chat' | 'call'>('auth');
  const [activeTab, setActiveTab] = useState<TabType>('dashboard');
  const [activeSession, setActiveSession] = useState<ChatSession | null>(null);

  const [selectedPartner, setSelectedPartner] = useState<UserProfile | null>(null);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        const userRef = doc(db, "users", firebaseUser.uid);
        const userDoc = await getDoc(userRef);

        if (userDoc.exists()) {
          await updateDoc(userRef, { isOnline: true });
          setUser(userDoc.data() as UserProfile);
          setView('main');
        } else {
          setView('setup');
        }
      } else {
        setUser(null);
        setView('auth');
      }
    });

    const handleVisibility = () => {
      if (!auth.currentUser) return;
      const userRef = doc(db, "users", auth.currentUser.uid);
      updateDoc(userRef, { isOnline: document.visibilityState === 'visible' });
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
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener('beforeunload', handleUnload);
    };
  }, []);

  const handleProfileSave = async (updatedProfile: UserProfile) => {
    if (!auth.currentUser) {
      console.error("No user logged in");
      return;
    }

    try {
      const userRef = doc(db, "users", auth.currentUser.uid);
      // This sends everything to Firestore
      await setDoc(userRef, updatedProfile, { merge: true });

      setUser(updatedProfile);
      setActiveTab('partners'); // Optional: move them to the partners list
      setView('main');
    } catch (error) {
      console.error("Firestore Save Error:", error);
      alert("Save failed! Check console.");
    }
  };

  const handleStartChat = (partner: UserProfile, chatId: string) => {
    // 1. Create the session object
    const session: ChatSession = {
      id: chatId,
      partner,
      messages: []
    };

    // 2. Set the state so the ChatRoom has data to render
    setActiveSession(session);
    setSelectedPartner(partner);
    setActiveChatId(chatId);

    // 3. Switch the view
    setView('chat');
  };

  const handleStartCall = (partner: UserProfile) => {
    setActiveSession({
      id: `call_${partner.id}`,
      partner,
      messages: []
    });
    setView('call');
  };

  const handleLogin = async (email: string, password: string): Promise<void> => {
    try {
      const res = await signInWithEmailAndPassword(auth, email, password);
      const userDoc = await getDoc(doc(db, "users", res.user.uid));

      if (userDoc.exists()) {
        // Important: Set online status on login
        await updateDoc(doc(db, "users", res.user.uid), { isOnline: true });
        setUser(userDoc.data() as UserProfile);
        setView('main');
      }
    } catch (error) {
      console.error("Login failed:", error);
      throw error; // Re-throw so Auth.tsx can catch it
    }
  };
  
  const handleLogout = async () => {
    if (user) {
      const userRef = doc(db, "users", user.id);
      await updateDoc(userRef, { isOnline: false });
    }
    await signOut(auth);
    sessionStorage.removeItem('lingoswap_user');
    setUser(null);
    setView('auth');
  };

  const renderMainContent = () => {
    if (!user) return null;
    switch (activeTab) {
      case 'dashboard':
        return (
          <Dashboard 
            user={user} 
            onLogout={handleLogout}
            onEditProfile={() => setView('setup')}
          />
        );
      case 'partners':
        return (
          <FindPartners 
            user={user} 
            onStartChat={handleStartChat} 
          />
        );
      case 'chats':
        return (
          <ChatsList
            user={user} // ADD THIS LINE
            onSelectChat={handleStartChat}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen flex flex-col max-w-6xl mx-auto bg-white shadow-xl relative overflow-hidden">
      {view === 'auth' && <Auth onLogin={handleLogin} />}
      
      {view === 'setup' && user && (
        <ProfileSetup profile={user} onSave={handleProfileSave} />
      )}

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
          onBack={() => setView('main')} 
          onCall={() => setView('call')}
        />
      )}

      {view === 'call' && activeSession && (
        <CallRoom 
          partner={activeSession.partner} 
          onClose={() => setView('chat')} 
        />
      )}
    </div>
  );
};

export default App;
