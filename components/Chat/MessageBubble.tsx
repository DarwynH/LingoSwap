
import React from 'react';
import { ChatMessage } from '../../types';

interface MessageBubbleProps {
  message: ChatMessage;
  isMe: boolean;
}

const MessageBubble: React.FC<MessageBubbleProps> = ({ message, isMe }) => (
  <div className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
    <div 
      className={`max-w-[85%] px-3 py-1.5 rounded-lg shadow-sm relative ${
        isMe ? 'bg-[#dcf8c6] rounded-tr-none' : 'bg-white rounded-tl-none'
      }`}
    >
      <p className="text-sm text-gray-800 break-words leading-relaxed">{message.text}</p>
      <div className="flex justify-end items-center space-x-1 mt-0.5">
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
);

export default MessageBubble;
