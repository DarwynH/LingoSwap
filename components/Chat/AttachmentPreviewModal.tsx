import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { PendingAttachment } from '../../types';

interface AttachmentPreviewModalProps {
  attachment: PendingAttachment;
  onClose: () => void;
  onSend: (captionText: string) => void;
}

const AttachmentPreviewModal: React.FC<AttachmentPreviewModalProps> = ({ attachment, onClose, onSend }) => {
  const [caption, setCaption] = useState('');
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    // Prevent scrolling behind modal
    const originalStyle = window.getComputedStyle(document.body).overflow;  
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = originalStyle;
    };
  }, []);

  if (!isMounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-[100] flex flex-col bg-gray-950/98 backdrop-blur-3xl animate-chat-msg">
      {/* Header */}
      <div className="flex-none p-4 flex items-center justify-between">
        <button 
          onClick={onClose}
          className="p-2.5 text-gray-300 hover:text-white bg-gray-800/80 rounded-full transition-colors active:scale-95 shadow-sm"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
        <div className="w-10"></div> {/* Spacer for centering */}
      </div>

      {/* Preview Area */}
      <div className="flex-1 overflow-hidden flex flex-col items-center justify-center p-4">
        {attachment.type === 'image' && (
          <img 
            src={attachment.previewUrl} 
            alt="Preview" 
            className="max-w-full max-h-[70vh] rounded-[24px] object-contain drop-shadow-2xl" 
          />
        )}
        
        {attachment.type === 'video' && (
          <video 
            src={attachment.previewUrl} 
            controls 
            playsInline
            className="max-w-full max-h-[70vh] rounded-[24px] drop-shadow-2xl" 
          />
        )}

        {attachment.type === 'file' && (
          <div className="flex flex-col items-center justify-center p-12 bg-gray-800/50 rounded-[32px] border border-gray-700/50 max-w-sm w-full shadow-2xl backdrop-blur-md">
            <div className="w-24 h-24 bg-blue-500/10 rounded-full flex items-center justify-center text-blue-400 mb-6 shadow-inner">
              <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
            </div>
            <span className="text-gray-200 font-semibold text-center text-lg break-words line-clamp-3 leading-snug px-4">
              {attachment.file.name}
            </span>
            <span className="text-gray-400 text-sm mt-3 font-medium tracking-wide">
              {(attachment.file.size / 1024 / 1024).toFixed(2)} MB • Document
            </span>
          </div>
        )}
      </div>

      {/* Input Area */}
      <div className="flex-none p-4 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
        <div className="flex items-end max-w-4xl mx-auto gap-3">
          <form
            onSubmit={(e) => { e.preventDefault(); onSend(caption); }}
            className="flex-1 flex items-center bg-gray-800/90 rounded-[28px] border border-gray-700/50 focus-within:border-blue-500/50 focus-within:bg-gray-800 focus-within:ring-2 focus-within:ring-blue-500/20 transition-all duration-300 shadow-lg backdrop-blur-sm"
          >
            <input
              type="text"
              autoFocus
              className="flex-1 bg-transparent border-none px-5 py-[14px] text-[15px] text-gray-100 focus:outline-none placeholder-gray-400"
              placeholder="Add a caption..."
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
            />
          </form>
          <button 
            onClick={() => onSend(caption)}
            className="w-[52px] h-[52px] bg-blue-600 text-white rounded-full hover:bg-blue-500 shadow-xl flex-shrink-0 flex items-center justify-center transition-all duration-300 active:scale-[0.92]"
          >
            <svg className="w-[22px] h-[22px] translate-x-[1.5px] -translate-y-[1.5px] -rotate-45" fill="currentColor" viewBox="0 0 24 24">
              <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
            </svg>
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default AttachmentPreviewModal;
