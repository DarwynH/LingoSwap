import React, { useState } from 'react';
import { ChatMessage } from '../../types';
import { translateTextToEnglish } from '../../services/translationService';

interface MessageBubbleProps {
  message: ChatMessage;
  isMe: boolean;
}

const MessageBubble: React.FC<MessageBubbleProps> = ({ message, isMe }) => {
  // Temporary UI State
  const [showTranslation, setShowTranslation] = useState(false);
  const [translatedText, setTranslatedText] = useState<string | null>(null);
  const [isTranslating, setIsTranslating] = useState(false);

  const handleToggleTranslation = async () => {
    // If it's already showing, just hide it
    if (showTranslation) {
      setShowTranslation(false);
      return;
    }

    // If we've already fetched it previously, just show it
    if (translatedText) {
      setShowTranslation(true);
      return;
    }

    // Otherwise, fetch the translation
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

  return (
    <div className={`flex ${isMe ? 'justify-end' : 'justify-start'} w-full`}>
      <div 
        className={`max-w-[85%] px-3 py-1.5 rounded-lg shadow-sm relative group ${
          isMe ? 'bg-[#dcf8c6] rounded-tr-none' : 'bg-white rounded-tl-none'
        }`}
      >
        {/* Original Message */}
        <p className="text-sm text-gray-800 break-words leading-relaxed">
          {message.text}
        </p>
        
        {/* Translated Message Container */}
        {showTranslation && translatedText && (
          <div className={`mt-2 pt-2 border-t ${isMe ? 'border-green-300' : 'border-gray-200'} `}>
            <p className="text-sm text-gray-600 italic break-words leading-relaxed">
              {translatedText}
            </p>
          </div>
        )}

        {/* Footer: Time, Status, and Translate Button */}
        <div className="flex justify-between items-center space-x-2 mt-1">
          {/* Translate Button */}
          <button 
            onClick={handleToggleTranslation}
            disabled={isTranslating}
            className={`text-[10px] font-medium transition-opacity ${
              isTranslating ? 'opacity-50 cursor-not-allowed' : 'hover:opacity-70 cursor-pointer'
            } ${isMe ? 'text-green-800' : 'text-blue-600'}`}
          >
            {isTranslating ? 'Translating...' : (showTranslation ? 'Hide' : 'Translate')}
          </button>

          <div className="flex items-center space-x-1">
            <span className="text-[9px] text-gray-400">
              {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
            {isMe && (
              <svg className="w-3 h-3 text-[#34b7f1]" fill="currentColor" viewBox="0 0 24 24">
                <path d="M22 6L9 19l-5-5 1.41-1.41L9 16.17l11.59-11.59L22 6z" />
              </svg>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default MessageBubble;