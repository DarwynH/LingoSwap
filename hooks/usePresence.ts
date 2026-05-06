import { useState, useEffect, useCallback, useRef } from 'react';
import { db, auth } from '../firebase';
import { doc, onSnapshot, updateDoc, getDoc } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { getFunctions } from 'firebase/functions';

export interface PresenceStatus {
  isOnline: boolean;
  lastSeen: number;
  showActiveStatus: boolean;
}

export const usePresence = (userId: string) => {
  const [status, setStatus] = useState<PresenceStatus | null>(null);
  const heartbeatRef = useRef<NodeJS.Timeout>();
  const functions = getFunctions();

  useEffect(() => {
    if (!userId) return;

    // Listen to user's presence
    const userRef = doc(db, 'users', userId);
    const unsubscribe = onSnapshot(userRef, (doc) => {
      const data = doc.data();
      if (data) {
        setStatus({
          isOnline: data.isOnline || false,
          lastSeen: data.lastSeen || Date.now(),
          showActiveStatus: data.showActiveStatus !== false // default true
        });
      }
    });

    return () => unsubscribe();
  }, [userId]);

  // Update own presence (for current user)
  const updateOwnPresence = useCallback(async (showActiveStatus: boolean) => {
    const currentUser = auth.currentUser;
    if (!currentUser) return;

    try {
      const updatePresenceFn = httpsCallable(functions, 'updatePresence');
      await updatePresenceFn({ showActiveStatus });
    } catch (error) {
      console.error('Failed to update presence:', error);
    }
  }, [functions]);

  // Start heartbeat (for current user)
  const startHeartbeat = useCallback(async () => {
    const currentUser = auth.currentUser;
    if (!currentUser) return;

    const updatePresenceFn = httpsCallable(functions, 'updatePresence');
    
    // Initial update
    await updatePresenceFn({ showActiveStatus: true });
    
    // Heartbeat every 45 seconds
    heartbeatRef.current = setInterval(async () => {
      if (document.visibilityState === 'visible') {
        await updatePresenceFn({ showActiveStatus: true });
      }
    }, 45000);
  }, [functions]);

  const stopHeartbeat = useCallback(async () => {
    if (heartbeatRef.current) {
      clearInterval(heartbeatRef.current);
    }
    
    const currentUser = auth.currentUser;
    if (currentUser) {
      const onDisconnectFn = httpsCallable(functions, 'onUserDisconnect');
      await onDisconnectFn();
    }
  }, []);

  return { status, updateOwnPresence, startHeartbeat, stopHeartbeat };
};
