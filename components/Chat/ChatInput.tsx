// components/Chat/ChatInput.tsx
import React, { useState } from 'react';
import { useVoiceRecorder } from '../../hooks/useVoiceRecorder';

interface ChatInputProps {
  onSendMessage: (text: string) => void;
  onSendVoice: (audioBlob: Blob, duration: number) => void;
  onTriggerFileSelect: () => void;
  isUploading: boolean;
}

const ChatInput: React.FC<ChatInputProps> = ({ 
  onSendMessage, 
  onSendVoice, 
  onTriggerFileSelect, 
  isUploading 
}) => {
  const [inputText, setInputText] = useState('');
  const { 
    isRecording, 
    recordingTime, 
    formatTime, 
    startRecording, 
    stopRecording, 
    cancelRecording 
  } = useVoiceRecorder();

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
    <div className="w-full px-3 pt-2 pb-5 sm:pb-4 flex items-end space-x-2 bg-white">
      
      {/* Attachment Button - Added active:scale-[0.92] and specific duration */}
      {!isRecording && (
        <button 
          type="button" 
          onClick={onTriggerFileSelect}
          disabled={isUploading}
          className="p-2 flex-shrink-0 text-gray-400 hover:text-blue-500 rounded-full hover:bg-gray-100 mb-0.5 disabled:opacity-50 transition-all duration-200 active:scale-[0.92]"
          title="Attach file"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
        </button>
      )}

      {/* Input / Recording Area - Added duration-300 and ease-out for smoother focus states */}
      {isRecording ? (
        <div className="flex-1 flex items-center bg-red-50 rounded-full px-5 py-2.5 justify-between border border-red-100 mb-0.5 transition-all duration-300">
          <div className="flex items-center space-x-3 text-red-500">
            <div className="w-2.5 h-2.5 bg-red-500 rounded-full animate-ping"></div>
            <span className="font-mono text-sm font-medium">{formatTime(recordingTime)}</span>
          </div>
          <button 
            type="button" 
            onClick={cancelRecording}
            className="text-sm text-red-600 hover:text-red-800 font-semibold px-2 transition-colors duration-200 active:scale-95"
          >
            Cancel
          </button>
        </div>
      ) : (
        <form onSubmit={handleTextSubmit} className="flex-1 flex items-center bg-gray-100 rounded-3xl border border-transparent focus-within:border-blue-200 focus-within:bg-white focus-within:ring-2 focus-within:ring-blue-50 transition-all duration-300 ease-out mb-0.5">
          <input
            type="text"
            className="flex-1 bg-transparent border-none px-4 py-2 text-[15px] text-gray-900 focus:outline-none placeholder-gray-400"
            placeholder="Message"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            disabled={isUploading}
            autoComplete="off"
          />
        </form>
      )}

      {/* Primary Action Buttons - Added active:scale-[0.92] for satisfying tactile feedback */}
      <div className="flex-shrink-0 mb-0.5 relative">
        {inputText.trim() && !isRecording ? (
          <button 
            onClick={handleTextSubmit}
            disabled={isUploading}
            className="p-2.5 bg-blue-500 text-white rounded-full hover:bg-blue-600 shadow-sm disabled:opacity-50 flex items-center justify-center transition-all duration-200 active:scale-[0.92]"
          >
            <svg className="w-5 h-5 ml-0.5 transform -rotate-45" fill="currentColor" viewBox="0 0 24 24">
              <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
            </svg>
          </button>
        ) : isRecording ? (
          <button 
            onClick={handleSendRecording}
            className="p-2.5 bg-blue-500 text-white rounded-full hover:bg-blue-600 shadow-sm flex items-center justify-center transition-all duration-200 active:scale-[0.92]"
          >
            <svg className="w-5 h-5 ml-0.5 transform -rotate-45" fill="currentColor" viewBox="0 0 24 24">
              <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
            </svg>
          </button>
        ) : (
          <button 
            onClick={startRecording}
            disabled={isUploading}
            className="p-2.5 bg-blue-500 text-white rounded-full hover:bg-blue-600 shadow-sm disabled:opacity-50 flex items-center justify-center transition-all duration-200 active:scale-[0.92]"
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