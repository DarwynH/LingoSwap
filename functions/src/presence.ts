import * as functions from 'firebase-functions/v2';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { getFirestore } from 'firebase-admin/firestore';

const db = getFirestore();

// User presence tracking on disconnect
export const onUserDisconnect = functions.https.onCall(async (request) => {
  const userId = request.auth?.uid;
  if (!userId) throw new functions.https.HttpsError('unauthenticated', 'No user ID');

  const userRef = db.collection('users').doc(userId);
  
  await userRef.update({
    isOnline: false,
    lastSeen: Date.now(),
    lastStatusUpdate: Date.now()
  });
  
  return { success: true };
});

// Auto-update user presence (called periodically from client)
export const updatePresence = functions.https.onCall(async (request) => {
  const userId = request.auth?.uid;
  if (!userId) throw new functions.https.HttpsError('unauthenticated', 'No user ID');

  const { showActiveStatus } = request.data;
  const userRef = db.collection('users').doc(userId);
  
  await userRef.update({
    isOnline: true,
    lastSeen: Date.now(),
    showActiveStatus: showActiveStatus ?? true,
    lastStatusUpdate: Date.now()
  });
  
  return { success: true };
});

// Clean up stale connections (runs every 5 minutes)
export const cleanupStaleConnections = onSchedule('every 5 minutes', async (event) => {
  const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
  
  const staleUsers = await db
    .collection('users')
    .where('isOnline', '==', true)
    .where('lastStatusUpdate', '<', fiveMinutesAgo)
    .get();
  
  const batch = db.batch();
  staleUsers.forEach(doc => {
    batch.update(doc.ref, {
      isOnline: false,
      lastSeen: doc.data().lastStatusUpdate || fiveMinutesAgo
    });
  });
  
  await batch.commit();
  console.log(`Cleaned up ${staleUsers.size} stale connections`);
  
  // The 'return null;' line has been removed. 
  // An async function without a return statement implicitly returns a Promise<void>.
});