import React, { useState, useEffect, useRef } from 'react';
import { useVoiceRecorder } from '../../hooks/useVoiceRecorder';
import { translateText, getLanguageDisplayName, DEEPL_SELECTABLE_LANGUAGES } from '../../services/translationService';

// NEW: Added props for Reply Feature
interface ChatInputProps {
  onSendMessage: (text: string) => void;
  onSendVoice: (audioBlob: Blob, duration: number) => void;
  onTriggerFileSelect: (type: 'media' | 'file') => void; 
  isUploading: boolean;
  replyTarget?: { messageId: string; text: string; senderId: string; senderName: string } | null;
  onCancelReply?: () => void;
  currentUserId?: string;
  /** DeepL target_lang code for draft translation (e.g. "EN-US", "JA"). Defaults to "EN-US". */
  draftTranslationTarget?: string;
  /** Callback when user manually changes the draft translation target language */
  onDraftTargetChange?: (langCode: string) => void;
}

const ChatInput: React.FC<ChatInputProps> = ({ 
  onSendMessage, 
  onSendVoice, 
  onTriggerFileSelect, 
  isUploading,
  replyTarget,
  onCancelReply,
  currentUserId,
  draftTranslationTarget = 'EN-US',
  onDraftTargetChange
}) => {
  const [inputText, setInputText] = useState('');
  const [isAttachmentMenuOpen, setIsAttachmentMenuOpen] = useState(false);
  const [translatedDraft, setTranslatedDraft] = useState<string | null>(null);
  const [isTranslating, setIsTranslating] = useState(false);
  const [selectedDraftVersion, setSelectedDraftVersion] = useState<'original' | 'translated'>('original');
  const [showDraftLangPicker, setShowDraftLangPicker] = useState(false);
  // Track which language the draft was actually translated to
  const [draftTranslatedWithLang, setDraftTranslatedWithLang] = useState<string>(draftTranslationTarget);

  const draftLangPickerRef = useRef<HTMLDivElement>(null);

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

  // Close draft language picker on outside click
  useEffect(() => {
    if (!showDraftLangPicker) return;
    const handleClick = (e: MouseEvent) => {
      if (draftLangPickerRef.current && !draftLangPickerRef.current.contains(e.target as Node)) {
        setShowDraftLangPicker(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [showDraftLangPicker]);

  const handleTextSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || isUploading || isTranslating) return;
    
    const textToSend = (translatedDraft && selectedDraftVersion === 'translated') 
      ? translatedDraft 
      : inputText;
      
    onSendMessage(textToSend);
    setInputText('');
    setTranslatedDraft(null);
    setSelectedDraftVersion('original');
  };

  const handleTranslate = async (targetLang?: string) => {
    if (!inputText.trim() || isTranslating) return;
    const lang = targetLang || draftTranslationTarget;
    setIsTranslating(true);
    setShowDraftLangPicker(false);
    try {
      const translated = await translateText(inputText, lang);
      setTranslatedDraft(translated);
      setDraftTranslatedWithLang(lang);
      setSelectedDraftVersion('translated');
    } catch (e) {
      console.error(e);
      alert('Translation failed. You can still send the original message.');
    } finally {
      setIsTranslating(false);
    }
  };

  const handlePickDraftLanguage = (langCode: string) => {
    if (onDraftTargetChange) {
      onDraftTargetChange(langCode);
    }
    // Re-translate with new language
    handleTranslate(langCode);
  };

  const handleCancelTranslation = () => {
    setTranslatedDraft(null);
    setSelectedDraftVersion('original');
  };

  const handleSendRecording = async () => {
    const { blob, duration } = await stopRecording();
    if (duration > 0) {
      onSendVoice(blob, duration);
    }
  };

  return (
    <div className="w-full flex flex-col bg-gray-900 pb-[max(1rem,env(safe-area-inset-bottom))]">
      
      {/* NEW: Compact Reply Preview Banner */}
      {replyTarget && (
        <div className="px-3 pt-2 pb-1 animate-chat-msg">
          <div className="flex items-center justify-between bg-gray-800/80 border-l-4 border-blue-500 p-2.5 rounded-lg shadow-sm">
            <div className="flex flex-col overflow-hidden mr-3 flex-1">
              <span className="text-[12px] text-blue-400 font-semibold mb-0.5 tracking-wide">
                {replyTarget.senderId === currentUserId ? 'Replying to yourself' : `Replying to ${replyTarget.senderName}`}
              </span>
              <span className="text-[13px] text-gray-300 truncate">
                {replyTarget.text}
              </span>
            </div>
            <button 
              onClick={onCancelReply} 
              className="p-1.5 text-gray-400 hover:text-gray-200 hover:bg-gray-700 rounded-full transition-colors active:scale-95"
              title="Cancel reply"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* NEW: Translation Draft Banner */}
      {translatedDraft && (
        <div className="px-3 pt-2 pb-1 animate-chat-msg">
          <div className="flex flex-col bg-gray-800/80 border border-gray-700 p-2.5 rounded-lg shadow-sm">
            <div className="flex justify-between items-start mb-2.5">
              <span className="text-[12px] text-gray-300 font-semibold tracking-wide flex items-center">
                <svg className="w-3.5 h-3.5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 15h4.498" /></svg>
                Preview Mode
              </span>
              <button 
                type="button"
                onClick={handleCancelTranslation} 
                className="p-1 text-gray-400 hover:text-gray-200 hover:bg-gray-700 rounded-full transition-colors active:scale-95"
                title="Cancel translation"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            
            <div className="flex flex-col gap-2 w-full">
              {/* Original Text Option */}
              <button
                type="button"
                onClick={() => setSelectedDraftVersion('original')}
                className={`w-full text-left px-3 py-2 rounded-md transition-colors border relative overflow-hidden ${
                  selectedDraftVersion === 'original' 
                    ? 'bg-blue-600/10 border-blue-500/50' 
                    : 'bg-gray-800/50 border-gray-700 hover:bg-gray-700/50'
                }`}
              >
                {selectedDraftVersion === 'original' && (
                  <div className="absolute top-0 left-0 w-1 h-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]"></div>
                )}
                <div className="text-[11px] uppercase tracking-wider font-semibold opacity-70 mb-0.5 text-gray-400">Original</div>
                <div className={`text-[14px] leading-snug ${selectedDraftVersion === 'original' ? 'text-gray-100' : 'text-gray-400'}`}>
                  {inputText}
                </div>
              </button>

              {/* Translated Text Option */}
              <div className={`w-full text-left rounded-md transition-colors border relative ${
                selectedDraftVersion === 'translated' 
                  ? 'bg-emerald-600/10 border-emerald-500/50' 
                  : 'bg-gray-800/50 border-gray-700 hover:bg-gray-700/50'
              }`}>
                {selectedDraftVersion === 'translated' && (
                  <div className="absolute top-0 left-0 w-1 h-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)] rounded-l-md"></div>
                )}
                {/* Header row — label + Change button */}
                <div className="flex items-center justify-between gap-2 px-3 pt-2 pb-1">
                  <span className="text-[11px] uppercase tracking-wider font-semibold text-emerald-500/70 min-w-0 truncate">
                    Translated to {getLanguageDisplayName(draftTranslatedWithLang)}
                  </span>
                  <div className="relative shrink-0" ref={draftLangPickerRef}>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); setShowDraftLangPicker(!showDraftLangPicker); }}
                      className="text-[11px] font-medium text-emerald-400/70 hover:text-emerald-300 px-2 py-1 rounded-md hover:bg-gray-700/80 transition-colors whitespace-nowrap"
                      title="Change draft translation language"
                    >
                      ▾ Change
                    </button>
                    {showDraftLangPicker && (
                      <div className="absolute z-50 bottom-full mb-1 right-0 w-48 bg-gray-800 border border-gray-700 rounded-lg shadow-2xl py-1 max-h-56 overflow-y-auto">
                        {DEEPL_SELECTABLE_LANGUAGES.map((lang) => (
                          <button
                            key={lang.code}
                            type="button"
                            onClick={(e) => { e.stopPropagation(); handlePickDraftLanguage(lang.code); }}
                            className={`w-full text-left px-3 py-1.5 text-[12px] font-medium transition-colors ${
                              lang.code === draftTranslatedWithLang
                                ? 'bg-emerald-600/20 text-emerald-300'
                                : 'text-gray-300 hover:bg-gray-700'
                            }`}
                          >
                            {lang.name}
                            {lang.code === draftTranslatedWithLang && ' ✓'}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                {/* Selectable translated text body */}
                <button
                  type="button"
                  onClick={() => setSelectedDraftVersion('translated')}
                  className="w-full text-left px-3 pb-2"
                >
                  <div className={`text-[14px] leading-snug ${selectedDraftVersion === 'translated' ? 'text-gray-100' : 'text-gray-400'}`}>
                    {translatedDraft}
                  </div>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Input Row */}
      <div className="w-full px-3 pt-2 flex items-end space-x-2">
        {/* Attachment Button & Popover Menu Container */}
        {!isRecording && (
          <div 
            className="relative flex-shrink-0 mb-0.5 group"
            onClick={(e) => {
              e.stopPropagation();
              setIsAttachmentMenuOpen(!isAttachmentMenuOpen);
            }}
          >
            {/* Popover Menu */}
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
          <form
            onSubmit={handleTextSubmit}
            className="flex-1 flex items-center bg-gray-800 rounded-3xl border border-transparent focus-within:border-gray-700 focus-within:bg-gray-800 focus-within:ring-2 focus-within:ring-gray-700 transition-all duration-300 ease-out mb-0.5"
          >
            <input
              type="text"
              className="flex-1 bg-transparent border-none pl-4 pr-1 py-2 text-base text-gray-100 focus:outline-none placeholder-gray-500"
              placeholder="Message"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              disabled={isUploading}
              autoComplete="off"
            />
            {inputText.trim() && (
              <button
                type="button"
                onClick={() => handleTranslate()}
                disabled={isTranslating || isUploading}
                className="p-2 mr-1 text-gray-400 hover:text-emerald-400 disabled:opacity-50 transition-colors active:scale-95 flex items-center justify-center"
                title={`Translate to ${getLanguageDisplayName(draftTranslationTarget)}`}
              >
                {isTranslating ? (
                  <div className="w-5 h-5 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
                ) : (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 15h4.498" /></svg>
                )}
              </button>
            )}
          </form>
        )}

        {/* Primary Action Buttons */}
        <div className="flex-shrink-0 mb-0.5 relative">
          {inputText.trim() && !isRecording ? (
            <button 
              onClick={handleTextSubmit}
              disabled={isUploading || isTranslating}
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
    </div>
  );
};

export default ChatInput;