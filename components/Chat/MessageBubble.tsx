// components/Chat/MessageBubble.tsx
import React, { useState } from 'react';
import { ChatMessage } from '../../types';
import { translateTextToEnglish } from '../../services/translationService'; 

interface MessageBubbleProps {
  message: ChatMessage;
  isMe: boolean;
  isGroupStart?: boolean;
  isGroupEnd?: boolean;
}

const MessageBubble: React.FC<MessageBubbleProps> = ({ 
  message, 
  isMe, 
  isGroupStart = true, 
  isGroupEnd = true 
}) => {
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

  const formatBytes = (bytes: number = 0, decimals = 2) => {
    if (!+bytes) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
  };

  const shapeClasses = isMe
    ? `rounded-2xl ${isGroupStart ? 'rounded-tr-[4px]' : 'rounded-tr-[16px]'} ${isGroupEnd ? 'rounded-br-2xl' : 'rounded-br-[16px]'}`
    : `rounded-2xl ${isGroupStart ? 'rounded-tl-[4px]' : 'rounded-tl-[16px]'} ${isGroupEnd ? 'rounded-bl-2xl' : 'rounded-bl-[16px]'}`;

  const bubbleColor = isMe 
    ? `bg-blue-600 text-white shadow-sm ${shapeClasses}` 
    : `bg-gray-800 text-gray-100 shadow-sm border border-gray-700/50 ${shapeClasses}`;
  
  // Brightened the outgoing timestamp slightly (text-blue-100) for better desktop contrast
  const timeColor = isMe ? 'text-blue-100' : 'text-gray-400';
  const dividerColor = isMe ? 'border-blue-500/50' : 'border-gray-700';
  const fileCardColor = isMe ? 'bg-white/10 hover:bg-white/20' : 'bg-gray-900/50 hover:bg-gray-700';
  const fileIconBg = isMe ? 'bg-white text-blue-600' : 'bg-gray-700 text-blue-400';
  const fileTextColor = isMe ? 'text-white' : 'text-gray-200';
  const fileSubtextColor = isMe ? 'text-blue-200' : 'text-gray-400';

  return (
    <div className={`max-w-[85%] sm:max-w-[75%] lg:max-w-xl px-4 py-2.5 relative transition-all duration-200 ${bubbleColor}`}>
      
      {message.type === 'image' && message.fileURL && (
        <a href={message.fileURL} target="_blank" rel="noopener noreferrer">
          <img src={message.fileURL} alt={message.fileName} className="w-full max-w-[250px] rounded-xl mb-2 object-cover" />
        </a>
      )}

      {message.type === 'video' && message.fileURL && (
        <video src={message.fileURL} controls className="w-full max-w-[250px] rounded-xl mb-2 bg-black" />
      )}

      {message.type === 'file' && message.fileURL && (
        <a href={message.fileURL} target="_blank" rel="noopener noreferrer" className={`flex items-center space-x-3 p-2.5 rounded-xl mb-2 transition-colors ${fileCardColor}`}>
          <div className={`p-2 rounded-full flex-shrink-0 ${fileIconBg}`}>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <div className="flex flex-col min-w-0">
            <span className={`text-[15px] font-medium truncate ${fileTextColor}`}>{message.fileName}</span>
            <span className={`text-[11px] ${fileSubtextColor}`}>{formatBytes(message.fileSize)}</span>
          </div>
        </a>
      )}

      {message.type === 'voice' && message.fileURL && (
        <div className="flex items-center space-x-2 py-1 min-w-[200px]">
          <audio controls src={message.fileURL} className="h-10 w-full opacity-90" controlsList="nodownload" />
        </div>
      )}

      {message.text && (
        <p className="text-[15px] break-words leading-relaxed">
          {message.text}
        </p>
      )}
      
      {showTranslation && translatedText && (
        <div className={`mt-2 pt-2 border-t ${dividerColor}`}>
          <p className={`text-[14px] italic break-words leading-relaxed ${isMe ? 'text-blue-100' : 'text-gray-300'}`}>
            {translatedText}
          </p>
        </div>
      )}

      <div className="flex justify-between items-end space-x-4 mt-1.5">
        {message.text ? (
          <button 
            onClick={handleToggleTranslation}
            disabled={isTranslating}
            className={`text-[11px] font-semibold tracking-wide uppercase transition-opacity ${
              isTranslating ? 'opacity-50 cursor-not-allowed' : 'hover:opacity-70 cursor-pointer'
            } ${isMe ? 'text-blue-200' : 'text-blue-400'}`}
          >
            {isTranslating ? '...' : (showTranslation ? 'Hide' : 'A/文')}
          </button>
        ) : <span /> }

        <div className="flex items-center space-x-1 flex-shrink-0 ml-2">
          <span className={`text-[10.5px] font-medium tracking-wide ${timeColor}`}>
            {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
          
          {/* IMPROVED READ RECEIPT */}
          {isMe && (
            <svg 
              className={`w-[18px] h-[18px] ml-1.5 transition-all duration-300 ${
                message.read 
                  ? 'text-amber-400 drop-shadow-[0_1px_2px_rgba(0,0,0,0.3)]' 
                  : 'text-white drop-shadow-[0_1px_1px_rgba(0,0,0,0.2)]'
              }`} 
              fill="currentColor" 
              viewBox="0 0 24 24"
            >
              <path d="M18 7l-1.41-1.41-6.34 6.34 1.41 1.41L18 7zm4.24-1.41L11.66 16.17 7.48 12l-1.41 1.41L11.66 19l12-12-1.42-1.41zM.41 13.41L6 19l1.41-1.41L1.83 12 .41 13.41z" />
            </svg>
          )}
        </div>
      </div>
      
    </div>
  );
};

export default MessageBubble;