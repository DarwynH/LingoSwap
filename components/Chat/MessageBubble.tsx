import React, { useState, useRef, useEffect } from 'react';
import { ChatMessage } from '../../types';
import { translateText, getLanguageDisplayName, DEEPL_SELECTABLE_LANGUAGES } from '../../services/translationService'; 
import MessageTextRenderer from './MessageTextRenderer';
import MediaLightbox from './MediaLightbox';

interface MessageBubbleProps {
  message: ChatMessage;
  isMe: boolean;
  isGroupStart?: boolean;
  isGroupEnd?: boolean;
  isFavorited?: boolean;
  isPhrasebookSaved?: boolean;
  isStudyLater?: boolean;
  onReplyClick?: (messageId: string) => void;
  onWordClick?: (word: string, messageId: string, text: string) => void;
  /** DeepL target_lang code for message translation (e.g. "EN-US", "JA"). Defaults to "EN-US". */
  translationTargetLanguage?: string;
  /** Callback when user manually changes the message translation target language */
  onTranslationTargetChange?: (langCode: string) => void;
}

const MessageBubble: React.FC<MessageBubbleProps> = ({ 
  message, 
  isMe, 
  isGroupStart = true, 
  isGroupEnd = true,
  isFavorited = false,
  isPhrasebookSaved = false,
  isStudyLater = false,
  onReplyClick,
  onWordClick,
  translationTargetLanguage = 'EN-US',
  onTranslationTargetChange
}) => {
  const [showTranslation, setShowTranslation] = useState(false);
  const [translatedText, setTranslatedText] = useState<string | null>(null);
  const [isTranslating, setIsTranslating] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [showLangPicker, setShowLangPicker] = useState(false);
  // Track which language was actually used for the cached translation
  const [translatedWithLang, setTranslatedWithLang] = useState<string>(translationTargetLanguage);

  const langPickerRef = useRef<HTMLDivElement>(null);

  // Close language picker on outside click
  useEffect(() => {
    if (!showLangPicker) return;
    const handleClick = (e: MouseEvent) => {
      if (langPickerRef.current && !langPickerRef.current.contains(e.target as Node)) {
        setShowLangPicker(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [showLangPicker]);

  const handleTranslate = async (targetLang: string) => {
    if (!message.text) return;
    setIsTranslating(true);
    setShowLangPicker(false);
    try {
      const result = await translateText(message.text, targetLang);
      setTranslatedText(result);
      setTranslatedWithLang(targetLang);
      setShowTranslation(true);
    } catch (error) {
      console.error("Failed to translate:", error);
      alert("Could not translate the message at this time.");
    } finally {
      setIsTranslating(false);
    }
  };

  const handleToggleTranslation = async () => {
    if (showTranslation) {
      setShowTranslation(false);
      return;
    }
    // If we have a cached translation for the current target, reuse it
    if (translatedText && translatedWithLang === translationTargetLanguage) {
      setShowTranslation(true);
      return;
    }
    await handleTranslate(translationTargetLanguage);
  };

  const handlePickLanguage = (langCode: string) => {
    // Notify parent so the choice persists across bubbles
    if (onTranslationTargetChange) {
      onTranslationTargetChange(langCode);
    }
    // Re-translate with new language (even if translation was cached for a different lang)
    handleTranslate(langCode);
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
  
  const timeColor = isMe ? 'text-blue-100' : 'text-gray-400';
  const dividerColor = isMe ? 'border-blue-500/50' : 'border-gray-700';
  const fileCardColor = isMe ? 'bg-white/10 hover:bg-white/20' : 'bg-gray-900/50 hover:bg-gray-700';
  const fileIconBg = isMe ? 'bg-white text-blue-600' : 'bg-gray-700 text-blue-400';
  const fileTextColor = isMe ? 'text-white' : 'text-gray-200';
  const fileSubtextColor = isMe ? 'text-blue-200' : 'text-gray-400';

  return (
    <div className={`max-w-[85%] sm:max-w-[75%] lg:max-w-xl px-3.5 py-2 sm:px-4 sm:py-2.5 relative transition-all duration-200 ${bubbleColor}`}>
      
      {/* Reply Context Block */}
      {message.replyTo && (
        <div 
          onClick={() => onReplyClick && onReplyClick(message.replyTo!.messageId)}
          className={`mb-2 px-3 py-1.5 rounded-lg cursor-pointer transition-colors border-l-4 text-[13px] ${
            isMe 
              ? 'bg-blue-700/50 border-blue-300 hover:bg-blue-700/80 text-blue-50' 
              : 'bg-gray-900/40 border-gray-500 hover:bg-gray-900/60 text-gray-300'
          }`}
        >
          <div className="font-bold text-[11px] mb-0.5 opacity-90 tracking-wide">
            {message.replyTo.senderName}
          </div>
          <div className="truncate opacity-80 text-[12px]">
            {message.replyTo.text}
          </div>
        </div>
      )}

      {message.type === 'image' && message.fileURL && (
        <div className="relative cursor-pointer transition-opacity hover:opacity-90" onClick={() => setLightboxOpen(true)}>
          <img src={message.fileURL} alt={message.fileName} className="w-full max-w-[220px] sm:max-w-[250px] rounded-xl mb-2 object-cover" />
        </div>
      )}

      {message.type === 'video' && message.fileURL && (
        <div className="relative cursor-pointer transition-opacity hover:opacity-90 group mb-2 overflow-hidden rounded-xl" onClick={() => setLightboxOpen(true)}>
          <video src={message.fileURL} className="w-full max-w-[220px] sm:max-w-[250px] bg-black pointer-events-none" />
          <div className="absolute inset-0 flex items-center justify-center bg-black/20 group-hover:bg-black/30 transition-colors">
            <div className="w-12 h-12 rounded-full bg-black/40 backdrop-blur-md flex items-center justify-center text-white/90 shadow-lg">
              <svg className="w-6 h-6 ml-0.5" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
            </div>
          </div>
        </div>
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
        <MessageTextRenderer 
          text={message.text} 
          messageId={message.id} 
          onWordClick={onWordClick} 
        />
      )}
      
      {showTranslation && translatedText && (
        <div className={`mt-2 pt-2 border-t ${dividerColor}`}>
          <div className="flex items-center justify-between mb-1">
            <p className={`text-[10.5px] font-semibold uppercase tracking-wider ${isMe ? 'text-blue-200/60' : 'text-gray-500'}`}>
              Translated to {getLanguageDisplayName(translatedWithLang)}
            </p>
            {/* Inline language change button */}
            <div className="relative" ref={langPickerRef}>
              <button
                type="button"
                onClick={() => setShowLangPicker(!showLangPicker)}
                className={`text-[10px] font-medium px-1.5 py-0.5 rounded transition-colors ${
                  isMe 
                    ? 'text-blue-200/70 hover:text-blue-100 hover:bg-blue-500/30' 
                    : 'text-gray-500 hover:text-gray-300 hover:bg-gray-700'
                }`}
                title="Change translation language"
              >
                ▾ Change
              </button>
              {showLangPicker && (
                <div className={`absolute z-50 mt-1 w-44 rounded-lg border shadow-xl py-1 max-h-52 overflow-y-auto ${
                  isMe 
                    ? 'right-0 bg-blue-800 border-blue-600/60'
                    : 'right-0 bg-gray-800 border-gray-700'
                }`}>
                  {DEEPL_SELECTABLE_LANGUAGES.map((lang) => (
                    <button
                      key={lang.code}
                      type="button"
                      onClick={() => handlePickLanguage(lang.code)}
                      className={`w-full text-left px-3 py-1.5 text-[12px] font-medium transition-colors ${
                        lang.code === translatedWithLang
                          ? (isMe ? 'bg-blue-600/50 text-white' : 'bg-gray-700 text-white')
                          : (isMe ? 'text-blue-100 hover:bg-blue-700/60' : 'text-gray-300 hover:bg-gray-700')
                      }`}
                    >
                      {lang.name}
                      {lang.code === translatedWithLang && ' ✓'}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
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
          
          {/* Study Later Indicator */}
          {isStudyLater && (
            <svg className={`w-3.5 h-3.5 mr-0.5 ${isMe ? 'text-purple-200' : 'text-purple-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          )}

          {/* Phrasebook Indicator */}
          {isPhrasebookSaved && (
            <svg className={`w-3.5 h-3.5 mr-0.5 ${isMe ? 'text-emerald-200' : 'text-emerald-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
          )}

          {/* Favorite Star */}
          {isFavorited && (
            <svg className={`w-3.5 h-3.5 mr-0.5 ${isMe ? 'text-amber-300' : 'text-amber-500'}`} fill="currentColor" viewBox="0 0 20 20">
              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
            </svg>
          )}

          <span className={`text-[10.5px] font-medium tracking-wide ${timeColor}`}>
            {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
          
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
      
      {lightboxOpen && message.fileURL && (
        <MediaLightbox 
          url={message.fileURL} 
          type={message.type as 'image' | 'video'} 
          onClose={() => setLightboxOpen(false)} 
        />
      )}
    </div>
  );
};

export default MessageBubble;