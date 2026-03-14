// components/Chat/ChatInput.tsx
import React, { useState, useRef } from 'react';
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
    <div className="flex-none bg-[#f0f2f5] p-2 relative z-20 w-full flex items-center space-x-2">
      
      {isRecording ? (
        // --- RECORDING STATE UI ---
        <div className="flex-1 flex items-center bg-white rounded-full px-4 py-2 shadow-sm justify-between animate-pulse">
          <div className="flex items-center space-x-2 text-red-500">
            <div className="w-3 h-3 bg-red-500 rounded-full animate-ping"></div>
            <span className="font-mono">{formatTime(recordingTime)}</span>
          </div>
          <button 
            type="button" 
            onClick={cancelRecording}
            className="text-sm text-gray-500 hover:text-red-500 font-medium px-2"
          >
            Cancel
          </button>
        </div>
      ) : (
        // --- NORMAL STATE UI ---
        <form onSubmit={handleTextSubmit} className="flex-1 flex items-center bg-white rounded-full pl-4 pr-1 py-1 shadow-sm focus-within:ring-1 focus-within:ring-[#00a884]">
          <input
            type="text"
            className="flex-1 bg-transparent border-none py-1.5 text-sm focus:outline-none"
            placeholder="Type a message"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            disabled={isUploading}
          />
          <button 
            type="button" 
            onClick={onTriggerFileSelect}
            disabled={isUploading}
            className="p-1.5 text-gray-400 hover:text-[#00a884] transition-colors rounded-full hover:bg-gray-50 mr-1 disabled:opacity-50"
          >
             <svg className="w-5 h-5 transform rotate-45" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
              </svg>
          </button>
        </form>
      )}

      {/* --- SEND / MIC BUTTON --- */}
      {inputText.trim() && !isRecording ? (
        <button 
          onClick={handleTextSubmit}
          disabled={isUploading}
          className="p-3 bg-[#00a884] text-white rounded-full hover:bg-[#008f6f] transition-colors shadow-sm disabled:opacity-50"
        >
          <svg className="w-5 h-5 ml-1 transform -rotate-45" fill="currentColor" viewBox="0 0 24 24">
            <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
          </svg>
        </button>
      ) : isRecording ? (
        <button 
          onClick={handleSendRecording}
          className="p-3 bg-[#00a884] text-white rounded-full hover:bg-[#008f6f] transition-colors shadow-sm"
        >
          <svg className="w-5 h-5 ml-1 transform -rotate-45" fill="currentColor" viewBox="0 0 24 24">
            <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
          </svg>
        </button>
      ) : (
        <button 
          onClick={startRecording}
          disabled={isUploading}
          className="p-3 bg-[#00a884] text-white rounded-full hover:bg-[#008f6f] transition-colors shadow-sm disabled:opacity-50"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
          </svg>
        </button>
      )}
    </div>
  );
};

export default ChatInput;