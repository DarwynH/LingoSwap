// components/Chat/MessageBubble.tsx
import React, { useState } from 'react';
import { ChatMessage } from '../../types';
import { translateTextToEnglish } from '../../services/translationService'; 

interface MessageBubbleProps {
  message: ChatMessage;
  isMe: boolean;
}

const MessageBubble: React.FC<MessageBubbleProps> = ({ message, isMe }) => {
  const [showTranslation, setShowTranslation] = useState(false);
  const [translatedText, setTranslatedText] = useState<string | null>(null);
  const [isTranslating, setIsTranslating] = useState(false);

  const handleToggleTranslation = async () => {
    if (showTranslation) {
      setShowTranslation(false);
      return;
    }
    if (translatedText) {
      setShowTranslation(true);
      return;
    }

    // Only translate if there is text
    if (!message.text) return;

    setIsTranslating(true);
    try {
      const result = await translateTextToEnglish(message.text);
      setTranslatedText(result);
      setShowTranslation(true);
    } catch (error) {
      console.error("Failed to translate:", error);
      alert("Could not translate the message at this time.");
    } finally {
      setIsTranslating(false);
    }
  };

  // Helper to format file size
  const formatBytes = (bytes: number = 0, decimals = 2) => {
    if (!+bytes) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
  };

  return (
    <div className={`flex ${isMe ? 'justify-end' : 'justify-start'} w-full`}>
      <div 
        className={`max-w-[85%] px-3 py-1.5 rounded-lg shadow-sm relative group overflow-hidden ${
          isMe ? 'bg-[#dcf8c6] rounded-tr-none' : 'bg-white rounded-tl-none'
        }`}
      >
        {/* Attachment Rendering */}
        {message.type === 'image' && message.fileURL && (
          <a href={message.fileURL} target="_blank" rel="noopener noreferrer">
            <img src={message.fileURL} alt={message.fileName} className="w-full max-w-[250px] rounded-md mb-2 object-cover" />
          </a>
        )}

        {message.type === 'video' && message.fileURL && (
          <video src={message.fileURL} controls className="w-full max-w-[250px] rounded-md mb-2 bg-black" />
        )}

        {message.type === 'file' && message.fileURL && (
          <a href={message.fileURL} target="_blank" rel="noopener noreferrer" className={`flex items-center space-x-3 p-2 rounded-md mb-2 ${isMe ? 'bg-[#c6e5b3]' : 'bg-gray-100'} hover:opacity-80 transition-opacity`}>
            <div className="bg-blue-500 text-white p-2 rounded-full flex-shrink-0">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-sm font-medium truncate text-gray-800">{message.fileName}</span>
              <span className="text-[10px] text-gray-500">{formatBytes(message.fileSize)}</span>
            </div>
          </a>
        )}

        {/* Voice Rendering */}
        {message.type === 'voice' && message.fileURL && (
          <div className="flex items-center space-x-2 py-1 min-w-[200px]">
            <audio 
              controls 
              src={message.fileURL} 
              className="h-10 w-full" 
              controlsList="nodownload"
            />
          </div>
        )}

        {/* Text Rendering */}
        {message.text && (
          <p className="text-sm text-gray-800 break-words leading-relaxed">
            {message.text}
          </p>
        )}
        
        {/* Translation Container */}
        {showTranslation && translatedText && (
          <div className={`mt-2 pt-2 border-t ${isMe ? 'border-green-300' : 'border-gray-200'} `}>
            <p className="text-sm text-gray-600 italic break-words leading-relaxed">
              {translatedText}
            </p>
          </div>
        )}

        {/* Footer */}
        <div className="flex justify-between items-center space-x-2 mt-1">
          {message.text ? (
            <button 
              onClick={handleToggleTranslation}
              disabled={isTranslating}
              className={`text-[10px] font-medium transition-opacity ${
                isTranslating ? 'opacity-50 cursor-not-allowed' : 'hover:opacity-70 cursor-pointer'
              } ${isMe ? 'text-green-800' : 'text-blue-600'}`}
            >
              {isTranslating ? 'Translating...' : (showTranslation ? 'Hide' : 'Translate')}
            </button>
          ) : <span /> /* Empty spacer if no text */}

          <div className="flex items-center space-x-1">
            <span className="text-[9px] text-gray-400">
              {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
            
            {isMe && (
              <svg className={`w-4 h-4 ${message.read ? 'text-[#34b7f1]' : 'text-gray-400'}`} fill="currentColor" viewBox="0 0 24 24">
                <path d="M18 7l-1.41-1.41-6.34 6.34 1.41 1.41L18 7zm4.24-1.41L11.66 16.17 7.48 12l-1.41 1.41L11.66 19l12-12-1.42-1.41zM.41 13.41L6 19l1.41-1.41L1.83 12 .41 13.41z" />
              </svg>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default MessageBubble;