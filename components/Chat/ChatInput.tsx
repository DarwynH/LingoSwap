// components/Chat/ChatInput.tsx
import React, { useState, useEffect } from 'react';
import { useVoiceRecorder } from '../../hooks/useVoiceRecorder';

interface ChatInputProps {
  onSendMessage: (text: string) => void;
  onSendVoice: (audioBlob: Blob, duration: number) => void;
  onTriggerFileSelect: (type: 'media' | 'file') => void; 
  isUploading: boolean;
}

const ChatInput: React.FC<ChatInputProps> = ({ 
  onSendMessage, 
  onSendVoice, 
  onTriggerFileSelect, 
  isUploading 
}) => {
  const [inputText, setInputText] = useState('');
  const [isAttachmentMenuOpen, setIsAttachmentMenuOpen] = useState(false);

  const { 
    isRecording, 
    recordingTime, 
    formatTime, 
    startRecording, 
    stopRecording, 
    cancelRecording 
  } = useVoiceRecorder();

  // Click-outside listener for explicit clicks
  useEffect(() => {
    const handleClickOutside = () => setIsAttachmentMenuOpen(false);
    if (isAttachmentMenuOpen) {
      document.addEventListener('click', handleClickOutside);
    }
    return () => document.removeEventListener('click', handleClickOutside);
  }, [isAttachmentMenuOpen]);

  const handleTextSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || isUploading) return;
    onSendMessage(inputText);
    setInputText('');
  };

  const handleSendRecording = async () => {
    const { blob, duration } = await stopRecording();
    if (duration > 0) {
      onSendVoice(blob, duration);
    }
  };

  return (
    <div className="w-full px-3 pt-2 pb-5 sm:pb-4 flex items-end space-x-2 bg-gray-900">
      
      {/* Attachment Button & Popover Menu Container - Added 'group' for CSS hover */}
      {!isRecording && (
        <div 
          className="relative flex-shrink-0 mb-0.5 group"
          onClick={(e) => {
            e.stopPropagation();
            setIsAttachmentMenuOpen(!isAttachmentMenuOpen);
          }}
        >
          
          {/* Refined Popover Menu - Combines CSS Hover and React Click State */}
          <div className={`absolute bottom-full left-0 mb-3 w-52 bg-gray-800 border border-gray-700/80 rounded-xl shadow-[0_4px_20px_rgba(0,0,0,0.5)] p-1.5 z-50 transition-all duration-200 origin-bottom-left ${
            isAttachmentMenuOpen 
              ? 'opacity-100 visible translate-y-0' 
              : 'opacity-0 invisible translate-y-2 group-hover:opacity-100 group-hover:visible group-hover:translate-y-0'
          }`}>
            <button 
              type="button"
              onClick={(e) => { 
                e.stopPropagation(); 
                onTriggerFileSelect('media'); 
                setIsAttachmentMenuOpen(false); 
              }}
              className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-700/80 text-gray-200 hover:text-white transition-colors"
            >
              <div className="flex items-center justify-center p-1.5 bg-blue-500/10 text-blue-400 rounded-md">
                <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <span className="text-[13.5px] font-medium tracking-wide">Photo & Video</span>
            </button>
            
            <button 
              type="button"
              onClick={(e) => { 
                e.stopPropagation(); 
                onTriggerFileSelect('file'); 
                setIsAttachmentMenuOpen(false); 
              }}
              className="w-full flex items-center gap-3 px-3 py-2 mt-0.5 rounded-lg hover:bg-gray-700/80 text-gray-200 hover:text-white transition-colors"
            >
              <div className="flex items-center justify-center p-1.5 bg-purple-500/10 text-purple-400 rounded-md">
                <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                </svg>
              </div>
              <span className="text-[13.5px] font-medium tracking-wide">Document</span>
            </button>
          </div>

          {/* Trigger Button */}
          <button 
            type="button" 
            disabled={isUploading}
            className={`p-2 flex-shrink-0 rounded-full transition-all duration-200 active:scale-[0.92] disabled:opacity-50 ${
              isAttachmentMenuOpen ? 'bg-gray-800 text-gray-200' : 'text-gray-400 hover:text-gray-200 group-hover:bg-gray-800 group-hover:text-gray-200'
            }`}
            title="Attach"
          >
            <svg className={`w-6 h-6 transition-transform duration-200 ${isAttachmentMenuOpen ? 'rotate-45' : 'group-hover:rotate-45'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.1} d="M12 4v16m8-8H4" />
            </svg>
          </button>
        </div>
      )}

      {/* Input / Recording Area */}
      {isRecording ? (
        <div className="flex-1 flex items-center bg-red-900/20 rounded-full px-5 py-2.5 justify-between border border-red-900/50 mb-0.5 transition-all duration-300">
          <div className="flex items-center space-x-3 text-red-400">
            <div className="w-2.5 h-2.5 bg-red-500 rounded-full animate-ping"></div>
            <span className="font-mono text-sm font-medium">{formatTime(recordingTime)}</span>
          </div>
          <button 
            type="button" 
            onClick={cancelRecording}
            className="text-sm text-red-400 hover:text-red-300 font-semibold px-2 transition-colors duration-200 active:scale-95"
          >
            Cancel
          </button>
        </div>
      ) : (
        <form onSubmit={handleTextSubmit} className="flex-1 flex items-center bg-gray-800 rounded-3xl border border-transparent focus-within:border-gray-700 focus-within:bg-gray-800 focus-within:ring-2 focus-within:ring-gray-700 transition-all duration-300 ease-out mb-0.5">
          <input
            type="text"
            className="flex-1 bg-transparent border-none px-4 py-2 text-[15px] text-gray-100 focus:outline-none placeholder-gray-500"
            placeholder="Message"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            disabled={isUploading}
            autoComplete="off"
          />
        </form>
      )}

      {/* Primary Action Buttons */}
      <div className="flex-shrink-0 mb-0.5 relative">
        {inputText.trim() && !isRecording ? (
          <button 
            onClick={handleTextSubmit}
            disabled={isUploading}
            className="p-2.5 bg-blue-600 text-white rounded-full hover:bg-blue-500 shadow-sm disabled:opacity-50 flex items-center justify-center transition-all duration-200 active:scale-[0.92]"
          >
            <svg className="w-5 h-5 ml-0.5 transform -rotate-45" fill="currentColor" viewBox="0 0 24 24">
              <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
            </svg>
          </button>
        ) : isRecording ? (
          <button 
            onClick={handleSendRecording}
            className="p-2.5 bg-blue-600 text-white rounded-full hover:bg-blue-500 shadow-sm flex items-center justify-center transition-all duration-200 active:scale-[0.92]"
          >
            <svg className="w-5 h-5 ml-0.5 transform -rotate-45" fill="currentColor" viewBox="0 0 24 24">
              <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
            </svg>
          </button>
        ) : (
          <button 
            onClick={startRecording}
            disabled={isUploading}
            className="p-2.5 bg-blue-600 text-white rounded-full hover:bg-blue-500 shadow-sm disabled:opacity-50 flex items-center justify-center transition-all duration-200 active:scale-[0.92]"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
            </svg>
          </button>
        )}
      </div>
      
    </div>
  );
};

export default ChatInput;