import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

interface MediaLightboxProps {
  url: string;
  type: 'image' | 'video';
  onClose: () => void;
}

const MediaLightbox: React.FC<MediaLightboxProps> = ({ url, type, onClose }) => {
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    const originalStyle = window.getComputedStyle(document.body).overflow;
    document.body.style.overflow = 'hidden';
    
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEscape);
    
    return () => {
      document.body.style.overflow = originalStyle;
      window.removeEventListener('keydown', handleEscape);
    };
  }, [onClose]);

  if (!isMounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-[100] flex flex-col bg-black/95 backdrop-blur-sm animate-chat-msg cursor-pointer" onClick={onClose}>
      {/* Header */}
      <div className="absolute top-0 right-0 p-4 z-10">
        <button 
          onClick={(e) => { e.stopPropagation(); onClose(); }}
          className="p-2.5 text-gray-300 hover:text-white bg-gray-800/50 hover:bg-gray-700/80 rounded-full transition-colors active:scale-95 shadow-sm"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Media Area */}
      <div className="flex-1 w-full h-full flex items-center justify-center p-4 sm:p-8">
        <div className="relative max-w-full max-h-full flex items-center justify-center" onClick={(e) => e.stopPropagation()}>
          {type === 'image' && (
            <img 
              src={url} 
              alt="Attachment" 
              className="max-w-full max-h-[85vh] md:max-h-[90vh] rounded-xl object-contain drop-shadow-2xl" 
            />
          )}
          {type === 'video' && (
            <video 
              src={url} 
              controls 
              autoPlay
              playsInline
              className="max-w-full max-h-[85vh] md:max-h-[90vh] rounded-xl drop-shadow-2xl outline-none bg-black/50" 
            />
          )}
        </div>
      </div>
    </div>,
    document.body
  );
};

export default MediaLightbox;
