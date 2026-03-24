import React from 'react';

interface MessageTextRendererProps {
  text: string;
  messageId: string;
  onWordClick?: (word: string, messageId: string, text: string) => void;
}

const MessageTextRenderer: React.FC<MessageTextRendererProps> = ({ text, messageId, onWordClick }) => {
  if (!text) return null;

  // Simple regex to split text by whitespace and common punctuation, capturing the delimiters
  // This allows us to separate words from trailing commas/periods without losing them visually
  const tokens = text.split(/([\s.,!?;:"'()[\]{}<>]+)/g);

  return (
    <p className="text-[15px] break-words leading-relaxed">
      {tokens.map((token, index) => {
        if (!token) return null;

        // Check if the token is just whitespace or punctuation
        if (/^[\s.,!?;:"'()[\]{}<>]+$/.test(token)) {
          return <span key={`${messageId}-token-${index}`}>{token}</span>;
        }

        // Otherwise, it's a treatable word
        return (
          <span
            key={`${messageId}-token-${index}`}
            onClick={(e) => {
              e.stopPropagation();
              if (onWordClick) onWordClick(token, messageId, text);
            }}
            className="cursor-pointer hover:bg-blue-500/30 active:bg-blue-500/40 rounded px-[2px] -mx-[2px] transition-colors duration-150 inline-block"
          >
            {token}
          </span>
        );
      })}
    </p>
  );
};

export default MessageTextRenderer;
