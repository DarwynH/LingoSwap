import React, { useState, useEffect, useRef } from 'react';
import { UserProfile } from '../types';
import { db } from '../firebase';
import { doc, updateDoc, getDoc, collection, addDoc, onSnapshot } from 'firebase/firestore';

interface CallRoomProps {
  currentUser: UserProfile;
  partner: UserProfile;
  callId: string | null;
  callType: 'voice' | 'video'; // NEW: Accept the call type
  onClose: () => void;
}

const servers = {
  iceServers: [
    { urls: ['stun:stun1.l.google.com:19302', 'stun:stun2.l.google.com:19302'] },
  ],
};

const CallRoom: React.FC<CallRoomProps> = ({ currentUser, partner, callId, callType, onClose }) => {
  const [status, setStatus] = useState<'connecting' | 'active' | 'ended'>('connecting');
  const [callTime, setCallTime] = useState(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteStreamRef = useRef<MediaStream | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const timerRef = useRef<number | null>(null);
  
  // NEW: Refs for the video elements
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  
  const hasSetupStarted = useRef(false);
  const ringbackRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (!callId || hasSetupStarted.current) return;
    hasSetupStarted.current = true;

    let unsubCallData: () => void;
    let unsubCallerICE: () => void;
    let unsubReceiverICE: () => void;

    const setupWebRTC = async () => {
      try {
        // 1. Get Local Media (Microphone AND optionally Camera)
        try {
          localStreamRef.current = await navigator.mediaDevices.getUserMedia({ 
            audio: true, 
            video: callType === 'video' // True if video call, false if voice
          });
        } catch (micError) {
          throw new Error(`Microphone ${callType === 'video' ? 'and Camera' : ''} access denied. Please allow permissions.`);
        }

        // Attach local stream to the picture-in-picture video element
        if (callType === 'video' && localVideoRef.current) {
          localVideoRef.current.srcObject = localStreamRef.current;
        }

        // 2. Initialize Peer Connection & Streams
        const pc = new RTCPeerConnection(servers);
        pcRef.current = pc;
        remoteStreamRef.current = new MediaStream();

        // Attach remote stream to the main video element
        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = remoteStreamRef.current;
        }

        localStreamRef.current.getTracks().forEach((track) => {
          pc.addTrack(track, localStreamRef.current!);
        });

        pc.ontrack = (event) => {
          event.streams[0].getTracks().forEach((track) => {
            remoteStreamRef.current?.addTrack(track);
          });
        };

        pc.onconnectionstatechange = () => {
          if (pc.connectionState === 'connected') {
            if (ringbackRef.current) ringbackRef.current.pause(); 
            setStatus('active');
            timerRef.current = window.setInterval(() => setCallTime((t) => t + 1), 1000);
          } else if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
            handleHangup(false);
          }
        };

        // 3. Signaling Logic via Firestore
        const callDocRef = doc(db, 'calls', callId);
        const callerCandidatesRef = collection(callDocRef, 'callerCandidates');
        const receiverCandidatesRef = collection(callDocRef, 'receiverCandidates');

        const callDocSnap = await getDoc(callDocRef);
        const callData = callDocSnap.data();

        if (callData?.callerId === currentUser.id) {
          // --- WE ARE THE CALLER ---
          ringbackRef.current = new Audio('/ringback.mp3');
          ringbackRef.current.loop = true;
          ringbackRef.current.play().catch(e => console.warn("Ringback autoplay blocked:", e));

          pc.onicecandidate = (event) => {
            event.candidate && addDoc(callerCandidatesRef, event.candidate.toJSON());
          };

          const offerDescription = await pc.createOffer();
          await pc.setLocalDescription(offerDescription);
          await updateDoc(callDocRef, {
            offer: { type: offerDescription.type, sdp: offerDescription.sdp }
          });

          unsubCallData = onSnapshot(callDocRef, (snapshot) => {
            const data = snapshot.data();
            if (!pc.currentRemoteDescription && data?.answer) {
              const answerDescription = new RTCSessionDescription(data.answer);
              pc.setRemoteDescription(answerDescription);
            }
            if (data?.status === 'rejected' || data?.status === 'ended') {
              handleHangup(false);
            }
          });

          unsubReceiverICE = onSnapshot(receiverCandidatesRef, (snapshot) => {
            snapshot.docChanges().forEach((change) => {
              if (change.type === 'added') {
                const candidate = new RTCIceCandidate(change.doc.data());
                pc.addIceCandidate(candidate);
              }
            });
          });

        } else {
          // --- WE ARE THE RECEIVER ---
          pc.onicecandidate = (event) => {
            event.candidate && addDoc(receiverCandidatesRef, event.candidate.toJSON());
          };

          let offerDescription = callData?.offer;
          
          if (!offerDescription) {
            await new Promise<void>((resolve) => {
              const unsubWait = onSnapshot(callDocRef, (snap) => {
                if (snap.data()?.offer) {
                  offerDescription = snap.data()?.offer;
                  unsubWait();
                  resolve();
                }
              });
            });
          }

          if (offerDescription) {
            await pc.setRemoteDescription(new RTCSessionDescription(offerDescription));
            const answerDescription = await pc.createAnswer();
            await pc.setLocalDescription(answerDescription);
            await updateDoc(callDocRef, {
              answer: { type: answerDescription.type, sdp: answerDescription.sdp }
            });
          }

          unsubCallData = onSnapshot(callDocRef, (snapshot) => {
            const data = snapshot.data();
            if (data?.status === 'ended') {
              handleHangup(false);
            }
          });

          unsubCallerICE = onSnapshot(callerCandidatesRef, (snapshot) => {
            snapshot.docChanges().forEach((change) => {
              if (change.type === 'added') {
                const candidate = new RTCIceCandidate(change.doc.data());
                pc.addIceCandidate(candidate);
              }
            });
          });
        }
      } catch (error: any) {
        console.error("WebRTC Setup Error:", error);
        setErrorMsg(error.message || "An unknown WebRTC error occurred.");
      }
    };

    setupWebRTC();

    return () => {
      if (unsubCallData) unsubCallData();
      if (unsubCallerICE) unsubCallerICE();
      if (unsubReceiverICE) unsubReceiverICE();
      cleanupMedia();
    };
  }, [callId, currentUser.id, callType]);

  const cleanupMedia = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
    }
    if (pcRef.current) {
      pcRef.current.close();
    }
    if (ringbackRef.current) {
      ringbackRef.current.pause();
    }
  };

  const handleHangup = async (updateFirebase = true) => {
    setStatus('ended');
    cleanupMedia();

    if (updateFirebase && callId) {
      try {
        await updateDoc(doc(db, 'calls', callId), { status: 'ended' });
      } catch (err) {
        console.error("Error updating call status:", err);
      }
    }
    
    setTimeout(() => {
      onClose();
    }, 1500);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="flex-1 flex flex-col items-center justify-between bg-[#075e54] text-white relative h-full overflow-hidden">
      
      {/* Remote Video Element (Hidden if voice-only, full background if video) */}
      <video 
        ref={remoteVideoRef} 
        autoPlay 
        playsInline 
        className={callType === 'video' ? "absolute inset-0 w-full h-full object-cover z-0" : "hidden"} 
      />

      {/* Local Video Element (Picture-in-Picture) */}
      {callType === 'video' && (
        <video 
          ref={localVideoRef} 
          autoPlay 
          playsInline 
          muted // CRITICAL: Mute local video so you don't hear your own echo!
          className="absolute bottom-32 right-6 w-28 h-40 bg-[#1a1a1a] rounded-xl object-cover border-2 border-white/20 shadow-2xl z-10" 
        />
      )}

      {/* Top Header / Avatar UI */}
      <div className={`text-center z-10 w-full px-4 ${callType === 'voice' ? 'mt-12' : 'mt-8'}`}>
        
        {/* Only show avatar for voice calls */}
        {callType === 'voice' && (
          <img 
            src={partner.avatar} 
            className={`w-32 h-32 rounded-full border-4 border-[#25d366] mx-auto shadow-2xl ${status === 'connecting' && !errorMsg ? 'animate-pulse' : ''}`} 
            alt="partner avatar"
          />
        )}
        
        <h2 className={`font-bold ${callType === 'voice' ? 'text-2xl mt-6' : 'text-xl drop-shadow-md'}`}>
          {partner.name}
        </h2>
        
        {errorMsg ? (
          <div className="bg-red-500/80 text-red-100 p-4 rounded-xl mt-4 max-w-sm mx-auto text-center border border-red-500/50 backdrop-blur-md">
            <p className="font-bold">Connection Failed</p>
            <p className="text-sm mt-1">{errorMsg}</p>
          </div>
        ) : (
          <div className={`mt-2 ${callType === 'video' ? 'bg-black/40 inline-block px-4 py-1 rounded-full backdrop-blur-sm' : ''}`}>
            <p className={`font-medium ${callType === 'voice' ? 'text-[#25d366]' : 'text-white'}`}>
              {status === 'connecting' ? 'Connecting...' : status === 'active' ? formatTime(callTime) : 'Call Ended'}
            </p>
          </div>
        )}
      </div>

      {/* Voice Practice Text Overlay (Only for voice calls) */}
      {callType === 'voice' && status === 'active' && (
        <div className="w-full max-w-xs space-y-4 z-10">
          <div className="bg-white/10 backdrop-blur-md p-4 rounded-2xl text-center text-sm border border-white/20">
            <p className="opacity-80">Practice your {partner.nativeLanguage} skills</p>
            <p className="font-bold text-[#25d366] mt-1 italic">"Speak naturally!"</p>
          </div>
        </div>
      )}

      {/* Bottom Controls */}
      <div className="mb-12 flex space-x-8 z-10">
        <button 
          onClick={() => handleHangup(true)}
          className="p-4 bg-red-500 hover:bg-red-600 rounded-full shadow-lg transform active:scale-90 transition-all"
        >
          <svg className="w-8 h-8 rotate-135" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 9c-1.6 0-3.15.25-4.6.72v3.1c0 .39-.23.74-.56.9-.98.49-1.87 1.12-2.66 1.85-.18.18-.43.28-.7.28-.28 0-.53-.11-.71-.29L.29 13.08a.994.994 0 01-.29-.7c0-.28.11-.53.29-.71C3.34 8.78 7.46 7 12 7s8.66 1.78 11.71 4.67c.18.18.29.43.29.71 0 .28-.11.53-.29.71l-2.48 2.48c-.18.18-.43.29-.71.29-.27 0-.52-.11-.7-.28-.79-.74-1.69-1.36-2.67-1.85-.33-.16-.56-.5-.56-.9v-3.1C15.15 9.25 13.6 9 12 9z" />
          </svg>
        </button>
      </div>
    </div>
  );
};

export default CallRoom;