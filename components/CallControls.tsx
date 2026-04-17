import React, { useState, useEffect, useRef } from 'react';

interface CallControlsProps {
  isMuted: boolean;
  isVideoActive: boolean;
  isVideoEnabling: boolean;
  audioDevices?: MediaDeviceInfo[];
  currentDeviceId?: string;
  onToggleMute: () => void;
  onToggleVideo: () => void;
  onSelectAudioDevice?: (deviceId: string) => void;
  onHangup: () => void;
}

const CallControls: React.FC<CallControlsProps> = ({
  isMuted,
  isVideoActive,
  isVideoEnabling,
  audioDevices = [],
  currentDeviceId,
  onToggleMute,
  onToggleVideo,
  onSelectAudioDevice,
  onHangup,
}) => {
  const [showDeviceMenu, setShowDeviceMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowDeviceMenu(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const hasMultipleDevices = audioDevices.length > 1;

  return (
    <div className="mb-12 flex items-center space-x-6 z-10 px-8 py-4 bg-gray-900/60 backdrop-blur-xl rounded-full border border-white/10 shadow-2xl relative">
      
      {/* Audio Output Switcher */}
      {audioDevices.length > 0 && typeof onSelectAudioDevice === 'function' && (
        <div className="relative" ref={menuRef}>
          <button 
            onClick={() => hasMultipleDevices && setShowDeviceMenu(!showDeviceMenu)}
            disabled={!hasMultipleDevices}
            className={`w-12 h-12 flex items-center justify-center rounded-full transition-all duration-300 ${!hasMultipleDevices ? 'opacity-30 cursor-not-allowed' : 'hover:bg-white/10 active:scale-95'} ${showDeviceMenu ? 'bg-white/20' : ''} text-white/80`}
            title="Switch Audio Output"
          >
            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />
            </svg>
          </button>
          
          {/* Device Selection DrownDown */}
          {showDeviceMenu && hasMultipleDevices && (
            <div className="absolute bottom-full mb-4 left-0 w-48 bg-gray-900/90 backdrop-blur-2xl border border-white/10 rounded-xl shadow-2xl overflow-hidden py-2 animate-in fade-in slide-in-from-bottom-2">
              <div className="px-3 py-2 text-xs font-bold text-gray-400 uppercase tracking-wider border-b border-white/10 mb-1">
                Audio Output
              </div>
              {audioDevices.map((device, idx) => (
                <button
                  key={device.deviceId}
                  onClick={() => {
                    onSelectAudioDevice(device.deviceId);
                    setShowDeviceMenu(false);
                  }}
                  className={`w-full text-left px-4 py-2.5 text-sm transition-colors flex items-center space-x-2 ${
                    currentDeviceId === device.deviceId ? 'bg-[#25d366]/20 text-[#25d366] font-medium' : 'text-gray-200 hover:bg-white/10'
                  }`}
                >
                  {currentDeviceId === device.deviceId && (
                    <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/></svg>
                  )}
                  <span className={`truncate ${currentDeviceId !== device.deviceId ? 'ml-6' : ''}`}>
                    {device.label || `Speaker ${idx + 1}`}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Mute Toggle */}
      <button 
        onClick={onToggleMute}
        className={`w-14 h-14 flex items-center justify-center rounded-full transition-all duration-300 ${isMuted ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30' : 'bg-white/10 text-white hover:bg-white/20 border border-white/10'} active:scale-95 shadow-lg`}
        title={isMuted ? "Unmute" : "Mute"}
      >
        {isMuted ? (
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7.02 7.02 0 01-1.63 4.54m-12.75 0A7.02 7.02 0 013 11M5.5 5.5l13 13M12 17v4m-3 0h6"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.5 4.5a4 4 0 016.94 1.73"/></svg>
        ) : (
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7.02 7.02 0 01-1.4 4.19A7 7 0 0112 19a7 7 0 01-6.6-3.81A7.02 7.02 0 013 11h2c0 3.87 3.13 7 7 7s7-3.13 7-7h2zM12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"/></svg>
        )}
      </button>

      {/* Video Toggle */}
      <button 
        onClick={onToggleVideo}
        disabled={isVideoEnabling}
        className={`w-14 h-14 relative flex items-center justify-center rounded-full transition-all duration-300 ${!isVideoActive ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30' : 'bg-white/10 text-white hover:bg-white/20 border border-white/10'} ${isVideoEnabling ? 'opacity-50 cursor-not-allowed' : 'active:scale-95'} shadow-lg`}
        title={isVideoActive ? "Turn Off Camera" : "Turn On Camera"}
      >
        {isVideoEnabling ? (
          <svg className="w-6 h-6 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
        ) : !isVideoActive ? (
          // Camera off icon
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2zM3 3l18 18"/></svg>
        ) : (
          // Camera on icon
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"/></svg>
        )}
      </button>

      {/* End Call */}
      <button 
        onClick={onHangup}
        className="w-16 h-16 flex items-center justify-center bg-red-500 hover:bg-red-600 text-white rounded-[1.5rem] shadow-[0_0_20px_rgba(239,68,68,0.4)] transform active:scale-95 transition-all"
        title="End Call"
      >
        <svg className="w-8 h-8 rotate-[135deg]" fill="currentColor" viewBox="0 0 24 24">
          <path d="M12 9c-1.6 0-3.15.25-4.6.72v3.1c0 .39-.23.74-.56.9-.98.49-1.87 1.12-2.66 1.85-.18.18-.43.28-.7.28-.28 0-.53-.11-.71-.29L.29 13.08a.994.994 0 01-.29-.7c0-.28.11-.53.29-.71C3.34 8.78 7.46 7 12 7s8.66 1.78 11.71 4.67c.18.18.29.43.29.71 0 .28-.11.53-.29.71l-2.48 2.48c-.18.18-.43.29-.71.29-.27 0-.52-.11-.7-.28-.79-.74-1.69-1.36-2.67-1.85-.33-.16-.56-.5-.56-.9v-3.1C15.15 9.25 13.6 9 12 9z" />
        </svg>
      </button>

    </div>
  );
};

export default CallControls;
