import React, { useState, useEffect, useRef } from 'react';
import { UserProfile, CallStatus } from '../types';
import { db } from '../firebase';
import { doc, updateDoc, getDoc, collection, addDoc, onSnapshot } from 'firebase/firestore';
import CallControls from './CallControls';

interface CallRoomProps {
  currentUser: UserProfile;
  partner: UserProfile;
  callId: string | null;
  callType: 'voice' | 'video'; // NEW: Accept the call type
  onClose: (reason: CallStatus) => void;
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
  const timeoutRef = useRef<number | null>(null);
  
  // NEW: Refs for the video elements
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  
  const hasSetupStarted = useRef(false);
  const ringbackRef = useRef<HTMLAudioElement | null>(null);

  // New UI states
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoEnabling, setIsVideoEnabling] = useState(false);
  const [myVideoActive, setMyVideoActive] = useState(callType === 'video');
  const [partnerVideoActive, setPartnerVideoActive] = useState(callType === 'video');
  
  const [audioDevices, setAudioDevices] = useState<MediaDeviceInfo[]>([]);
  const [currentDeviceId, setCurrentDeviceId] = useState<string>('');

  // Captions state
  const [captionsSupported, setCaptionsSupported] = useState(false);
  const [isCaptionsEnabled, setIsCaptionsEnabled] = useState(false);
  const [transcriptLines, setTranscriptLines] = useState<string[]>([]);
  const [recognitionError, setRecognitionError] = useState<string | null>(null);

  // Captions refs
  const recognitionRef = useRef<any>(null);
  const recognitionActiveRef = useRef(false);

  useEffect(() => {
    const getDevices = async () => {
      // Graceful handling if `setSinkId` isn't supported (e.g. Safari, Firefox by default)
      if (typeof (HTMLMediaElement.prototype as any).setSinkId !== 'function') {
        return;
      }
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const outputs = devices.filter(d => d.kind === 'audiooutput');
        setAudioDevices(outputs);
        if (outputs.length > 0) setCurrentDeviceId(outputs[0].deviceId);
      } catch (e) {
        console.warn("Audio devices not fully accessible");
      }
    };
    getDevices();
  }, []);

  // Detect captions support
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || (window as any).webkitSpeechRecognition;
    setCaptionsSupported(!!SpeechRecognition);
  }, []);

  const createDummyVideoTrack = () => {
    const canvas = document.createElement('canvas');
    canvas.width = 1; canvas.height = 1;
    const ctx = canvas.getContext('2d');
    if (ctx) {
       ctx.fillStyle = '#111';
       ctx.fillRect(0, 0, 1, 1);
    }
    const dummyStream = canvas.captureStream(1);
    return dummyStream.getVideoTracks()[0];
  };

  const initSpeechRecognition = () => {
    const SpeechRecognition = window.SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = navigator.language || 'en-US';

    recognition.onresult = (event) => {
      let finalTranscript = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += transcript;
        }
      }
      if (finalTranscript.trim()) {
        setTranscriptLines(prev => [...prev, finalTranscript.trim()].slice(-3));
      }
    };

    recognition.onerror = (event) => {
      setRecognitionError(`Speech recognition error: ${event.error}`);
    };

    recognition.onend = () => {
      if (isCaptionsEnabled && status === 'active' && !recognitionActiveRef.current) {
        startCaptions();
      }
    };

    recognitionRef.current = recognition;
  };

  const startCaptions = () => {
    if (!captionsSupported || recognitionActiveRef.current) return;
    if (!recognitionRef.current) {
      initSpeechRecognition();
    }
    if (recognitionRef.current) {
      try {
        recognitionRef.current.start();
        recognitionActiveRef.current = true;
        setRecognitionError(null);
      } catch (error) {
        setRecognitionError('Failed to start speech recognition');
      }
    }
  };

  const stopCaptions = () => {
    if (recognitionRef.current && recognitionActiveRef.current) {
      recognitionRef.current.stop();
      recognitionActiveRef.current = false;
    }
  };

  // Handle captions toggle and call status changes
  useEffect(() => {
    if (isCaptionsEnabled && status === 'active') {
      startCaptions();
    } else {
      stopCaptions();
    }
  }, [isCaptionsEnabled, status]);

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
            video: callType === 'video' 
          });

          if (callType === 'voice') {
            localStreamRef.current.addTrack(createDummyVideoTrack());
          }
        } catch (micError) {
          throw new Error(`Microphone ${callType === 'video' ? 'and Camera' : ''} access denied. Please allow permissions.`);
        }

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
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
            setStatus('active');
            if (isCaptionsEnabled) startCaptions();
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

          // 30-second timeout for the caller
          timeoutRef.current = window.setTimeout(() => {
            // we have to check if still connecting or in initial state
            handleHangup(true, 'missed');
          }, 30000);

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
            if (data?.[`video_${partner.id}`] !== undefined) {
              setPartnerVideoActive(data[`video_${partner.id}`]);
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
            if (data?.[`video_${partner.id}`] !== undefined) {
              setPartnerVideoActive(data[`video_${partner.id}`]);
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
      stopCaptions();
      cleanupMedia();
    };
  }, [callId, currentUser.id, callType]);

  const cleanupMedia = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
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

  const handleHangup = async (updateFirebase = true, explicitStatus?: CallStatus) => {
    let finalStatus = explicitStatus;
    if (!finalStatus) {
      finalStatus = status === 'connecting' ? 'missed' : 'ended';
    }
    setStatus('ended');
    stopCaptions();
    cleanupMedia();

    if (updateFirebase && callId) {
      try {
        await updateDoc(doc(db, 'calls', callId), { status: finalStatus });
      } catch (err) {
        console.error("Error updating call status:", err);
      }
    }
    
    setTimeout(() => {
      onClose(finalStatus!);
    }, 1500);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const toggleMute = () => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsMuted(!audioTrack.enabled);
      }
    }
  };

  const toggleVideo = async () => {
    if (!pcRef.current || !localStreamRef.current || !callId) return;

    if (myVideoActive) {
      const videoTrack = localStreamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = false;
        videoTrack.stop();
        
        const dummyTrack = createDummyVideoTrack();
        const sender = pcRef.current.getSenders().find(s => s.track?.kind === 'video');
        if (sender) await sender.replaceTrack(dummyTrack);
        
        localStreamRef.current.removeTrack(videoTrack);
        localStreamRef.current.addTrack(dummyTrack);
        
        setMyVideoActive(false);
        await updateDoc(doc(db, 'calls', callId), { [`video_${currentUser.id}`]: false });
      }
    } else {
      setIsVideoEnabling(true);
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        const newVideoTrack = stream.getVideoTracks()[0];
        const sender = pcRef.current.getSenders().find(s => s.track?.kind === 'video');
        if (sender) {
          await sender.replaceTrack(newVideoTrack);
        }
        
        const oldTrack = localStreamRef.current.getVideoTracks()[0];
        if (oldTrack) {
          oldTrack.stop();
          localStreamRef.current.removeTrack(oldTrack);
        }
        
        localStreamRef.current.addTrack(newVideoTrack);
        
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = localStreamRef.current;
        }

        setMyVideoActive(true);
        await updateDoc(doc(db, 'calls', callId), { [`video_${currentUser.id}`]: true });
      } catch (err) {
        console.error("Could not obtain video:", err);
        alert("Camera access denied or failed.");
      } finally {
        setIsVideoEnabling(false);
      }
    }
  };



  return (
    <div className="flex-1 flex flex-col items-center justify-between bg-[#075e54] text-white relative h-full overflow-hidden">
      
      {/* Remote Video Element (Main Background) */}
      <video 
        ref={remoteVideoRef} 
        autoPlay 
        playsInline 
        className={`absolute inset-0 w-full h-full object-cover z-0 transition-opacity duration-1000 ${partnerVideoActive && status === 'active' ? 'opacity-100' : 'opacity-0'}`} 
      />

      {/* Local Video Element (Picture-in-Picture) */}
      <video 
        ref={localVideoRef} 
        autoPlay 
        playsInline 
        muted 
        className={`absolute bottom-32 right-6 w-28 h-40 bg-gray-900 rounded-2xl object-cover border border-white/20 shadow-2xl z-20 transition-all duration-500 ease-out origin-bottom-right ${myVideoActive ? 'opacity-100 transform scale-100' : 'opacity-0 transform scale-90 pointer-events-none'}`} 
      />

      {/* Captions Overlay */}
      {status === 'active' && (
        <div className="absolute bottom-32 left-6 bg-black/60 text-white p-3 rounded-lg text-sm max-w-md z-10">
          {captionsSupported ? (
            transcriptLines.length > 0 ? (
              <div>
                {transcriptLines.map((line, idx) => <p key={idx}>{line}</p>)}
              </div>
            ) : (
              <p>Captions enabled - start speaking</p>
            )
          ) : (
            <p>Captions not supported in this browser</p>
          )}
          {recognitionError && <p className="text-red-400 text-xs">{recognitionError}</p>}
        </div>
      )}

      {/* Top Header / Avatar UI */}
      <div className={`text-center z-10 w-full px-4 transition-all duration-700 mt-12 ${partnerVideoActive && status === 'active' ? 'translate-y-[-20px] opacity-0 pointer-events-none' : 'translate-y-0 opacity-100'}`}>
        
        <img 
          src={partner.avatar} 
          className={`w-32 h-32 rounded-full border-4 border-[#25d366] mx-auto shadow-2xl object-cover ${status === 'connecting' && !errorMsg ? 'animate-pulse' : ''}`} 
          alt="partner avatar"
        />
        
        <h2 className="font-bold text-2xl mt-6">
          {partner.name}
        </h2>
        
        {errorMsg ? (
          <div className="bg-red-500/80 text-red-100 p-4 rounded-xl mt-4 max-w-sm mx-auto text-center border border-red-500/50 backdrop-blur-md">
            <p className="font-bold">Connection Failed</p>
            <p className="text-sm mt-1">{errorMsg}</p>
          </div>
        ) : (
          <div className="mt-2 bg-black/30 inline-block px-4 py-1.5 rounded-full backdrop-blur-sm border border-white/10">
            <p className="font-medium text-[#25d366]">
              {status === 'connecting' ? 'Connecting...' : status === 'active' ? formatTime(callTime) : 'Call Ended'}
            </p>
          </div>
        )}
      </div>

      {/* Voice Practice Text Overlay */}
      <div className={`w-full max-w-xs space-y-4 z-10 transition-all duration-700 ${partnerVideoActive && status === 'active' ? 'opacity-0 scale-95 pointer-events-none' : 'opacity-100'}`}>
        {status === 'active' && (
          <div className="bg-white/10 backdrop-blur-md p-4 flex flex-col items-center rounded-2xl text-center text-sm border border-white/20">
            <p className="opacity-80">Practice your {partner.nativeLanguage} skills</p>
            <p className="font-bold text-[#25d366] mt-1 italic">"Speak naturally!"</p>
          </div>
        )}
      </div>

      {/* Bottom Controls Panel */}
      <CallControls 
        isMuted={isMuted}
        isVideoActive={myVideoActive}
        isVideoEnabling={isVideoEnabling}
        audioDevices={audioDevices}
        currentDeviceId={currentDeviceId}
        onToggleMute={toggleMute}
        onToggleVideo={toggleVideo}
        onSelectAudioDevice={async (deviceId) => {
          if (remoteVideoRef.current && typeof (remoteVideoRef.current as any).setSinkId === 'function') {
            try {
              await (remoteVideoRef.current as any).setSinkId(deviceId);
              setCurrentDeviceId(deviceId);
            } catch (e) {
              console.error("setSinkId error", e);
            }
          }
        }}
        isCaptionsEnabled={isCaptionsEnabled}
        captionsSupported={captionsSupported}
        onToggleCaptions={() => setIsCaptionsEnabled(!isCaptionsEnabled)}
        onHangup={() => handleHangup(true, 'ended')}
      />
    </div>
  );
};

export default CallRoom;