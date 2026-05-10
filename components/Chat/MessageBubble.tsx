import React, { useState, useCallback } from 'react';
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

// Per-message, per-language translation cache entry
interface TranslationEntry {
  text: string;
  loading: boolean;
  error: string | null;
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
  onTranslationTargetChange,
}) => {
  // Whether the translation section is visible
  const [showTranslation, setShowTranslation] = useState(false);

  // Whether the inline language list is expanded
  const [showLangPicker, setShowLangPicker] = useState(false);

  // Media lightbox
  const [lightboxOpen, setLightboxOpen] = useState(false);

  /**
   * Per-language translation cache keyed by DeepL code.
   * e.g. { 'EN-US': { text: 'Hello', loading: false, error: null }, 'KO': { ... } }
   * Source is always message.text — never a previously translated result.
   */
  const [cache, setCache] = useState<Record<string, TranslationEntry>>({});

  // The language code currently displayed in the translation panel
  const [activeLang, setActiveLang] = useState<string>(translationTargetLanguage);

  // ── Core translation logic ─────────────────────────────────────────────────

  /**
   * Merge a partial update into a single language slot of the cache.
   * Uses functional update so multiple setState calls don't race.
   */
  const setEntry = useCallback((lang: string, partial: Partial<TranslationEntry>) => {
    setCache((prev) => ({
      ...prev,
      [lang]: {
        text:    '',
        loading: false,
        error:   null,
        ...prev[lang],
        ...partial,
      },
    }));
  }, []);

  /**
   * Fetch a translation for targetLang from the DeepL Cloud Function.
   * Always reads from message.text — the original source — never re-translates.
   */
  const doTranslate = useCallback(async (targetLang: string) => {
    const sourceText = message.text;
    if (!sourceText) return;

    // Show loading immediately
    setEntry(targetLang, { loading: true, error: null });
    setActiveLang(targetLang);
    setShowTranslation(true);
    setShowLangPicker(false);

    try {
      const result = await translateText(sourceText, targetLang);
      setEntry(targetLang, { text: result, loading: false, error: null });
    } catch (err) {
      console.error('[MessageBubble] Translation failed:', err);
      setEntry(targetLang, { loading: false, error: 'Translation failed. Please try again.' });
    }
  }, [message.text, setEntry]);

  // ── Event handlers ─────────────────────────────────────────────────────────

  /** Toggle the "A/文" button at the bottom of the bubble. */
  const handleToggleTranslation = useCallback(async () => {
    if (showTranslation) {
      setShowTranslation(false);
      setShowLangPicker(false);
      return;
    }

    // Check if we already have a valid cached result for the active language
    const entry = cache[activeLang];
    if (entry && entry.text && !entry.loading && !entry.error) {
      setShowTranslation(true);
      return;
    }

    // Fetch fresh translation
    await doTranslate(activeLang);
  }, [showTranslation, cache, activeLang, doTranslate]);

  /** User selects a language from the inline picker. */
  const handlePickLanguage = useCallback((langCode: string) => {
    // Tell parent so global preference can be remembered
    onTranslationTargetChange?.(langCode);

    // Return cached result instantly if available and error-free
    const entry = cache[langCode];
    if (entry && entry.text && !entry.loading && !entry.error) {
      setActiveLang(langCode);
      setShowTranslation(true);
      setShowLangPicker(false);
      return;
    }

    // Otherwise fetch from API
    doTranslate(langCode);
  }, [cache, doTranslate, onTranslationTargetChange]);

  // ── Style helpers ──────────────────────────────────────────────────────────

  const formatBytes = (bytes = 0, decimals = 2) => {
    if (!+bytes) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
  };

  const bubbleBase  = isMe ? 'shadow-sm' : 'shadow-sm border';
  const bubbleStyle: React.CSSProperties = isMe
    ? { background: 'var(--bubble-out-bg)', color: 'var(--bubble-out-text)' }
    : { background: 'var(--bubble-in-bg)', color: 'var(--bubble-in-text)', borderColor: 'var(--bubble-in-border)' };

  const timeColor        = isMe ? 'opacity-70' : 'text-theme-muted';
  const dividerColor     = isMe ? 'border-white/20' : 'border-theme-border';
  const fileCardColor    = isMe ? 'bg-white/10 hover:bg-white/20' : 'bg-surface-main/50 hover:bg-surface-hover/80';
  const fileIconBg       = isMe ? 'bg-white text-blue-600' : 'bg-surface-main text-accent-primary';
  const fileTextColor    = isMe ? 'text-white' : 'text-theme-text';
  const fileSubtextColor = isMe ? 'opacity-70' : 'text-theme-muted';

  const shapeClasses = isMe
    ? `rounded-2xl ${isGroupStart ? 'rounded-tr-[4px]' : 'rounded-tr-[16px]'} ${isGroupEnd ? 'rounded-br-2xl' : 'rounded-br-[16px]'}`
    : `rounded-2xl ${isGroupStart ? 'rounded-tl-[4px]' : 'rounded-tl-[16px]'} ${isGroupEnd ? 'rounded-bl-2xl' : 'rounded-bl-[16px]'}`;

  // Snapshot of the current active language's cache entry for rendering
  const currentEntry   = cache[activeLang] as TranslationEntry | undefined;
  const isTranslating  = currentEntry?.loading ?? false;

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div
      className={`max-w-[85%] sm:max-w-[75%] lg:max-w-xl px-3.5 py-2 sm:px-4 sm:py-2.5 relative transition-all duration-200 ${bubbleBase} ${shapeClasses}`}
      style={bubbleStyle}
    >
      {/* Reply context block */}
      {message.replyTo && (
        <div
          onClick={() => onReplyClick?.(message.replyTo!.messageId)}
          className={`mb-2 px-3 py-1.5 rounded-lg cursor-pointer transition-colors border-l-4 text-[13px] ${
            isMe
              ? 'border-white/40 hover:bg-white/10'
              : 'border-[var(--accent-primary)] hover:bg-black/5'
          }`}
          style={isMe ? { background: 'rgba(255,255,255,0.1)' } : { background: 'var(--bg-main)' }}
        >
          <div className="font-bold text-[11px] mb-0.5 opacity-90 tracking-wide">
            {message.replyTo.senderName}
          </div>
          <div className="truncate opacity-80 text-[12px]">{message.replyTo.text}</div>
        </div>
      )}

      {/* Image */}
      {message.type === 'image' && message.fileURL && (
        <div className="relative cursor-pointer transition-opacity hover:opacity-90" onClick={() => setLightboxOpen(true)}>
          <img
            src={message.fileURL}
            alt={message.fileName}
            className="w-full max-w-[220px] sm:max-w-[250px] rounded-xl mb-2 object-cover"
          />
        </div>
      )}

      {/* Video */}
      {message.type === 'video' && message.fileURL && (
        <div
          className="relative cursor-pointer transition-opacity hover:opacity-90 group mb-2 overflow-hidden rounded-xl"
          onClick={() => setLightboxOpen(true)}
        >
          <video
            src={message.fileURL}
            className="w-full max-w-[220px] sm:max-w-[250px] bg-black pointer-events-none"
          />
          <div className="absolute inset-0 flex items-center justify-center bg-black/20 group-hover:bg-black/30 transition-colors">
            <div className="w-12 h-12 rounded-full bg-black/40 backdrop-blur-md flex items-center justify-center text-white/90 shadow-lg">
              <svg className="w-6 h-6 ml-0.5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
            </div>
          </div>
        </div>
      )}

      {/* File */}
      {message.type === 'file' && message.fileURL && (
        <a
          href={message.fileURL}
          target="_blank"
          rel="noopener noreferrer"
          className={`flex items-center space-x-3 p-2.5 rounded-xl mb-2 transition-colors ${fileCardColor}`}
        >
          <div className={`p-2 rounded-full flex-shrink-0 ${fileIconBg}`}>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5}
                d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
          </div>
          <div className="flex flex-col min-w-0">
            <span className={`text-[15px] font-medium truncate ${fileTextColor}`}>{message.fileName}</span>
            <span className={`text-[11px] ${fileSubtextColor}`}>{formatBytes(message.fileSize)}</span>
          </div>
        </a>
      )}

      {/* Voice */}
      {message.type === 'voice' && message.fileURL && (
        <div className="mb-2">
          <div className="flex items-center space-x-2 py-1 min-w-[200px]">
            <audio controls src={message.fileURL} className="h-10 w-full opacity-90" controlsList="nodownload" />
          </div>
          {message.transcript && (
            <div className="mt-2 rounded-2xl bg-surface-main/80 p-3 text-[13px] text-theme-muted italic">
              {message.transcript}
            </div>
          )}
        </div>
      )}

      {/* Message text */}
      {message.text && (
        <MessageTextRenderer text={message.text} messageId={message.id} onWordClick={onWordClick} />
      )}

      {/* ── Translation panel ── */}
      {showTranslation && (
        <div className={`mt-2 pt-2 border-t ${dividerColor}`}>

          {/* Row 1: "Translated to X" label + Change toggle */}
          <div className="flex items-center justify-between mb-1.5">
            <p className={`text-[10.5px] font-semibold uppercase tracking-wider leading-none ${
              isMe ? 'opacity-60' : 'text-theme-muted'
            }`}>
              Translated to {getLanguageDisplayName(activeLang)}
            </p>
            <button
              type="button"
              onClick={() => setShowLangPicker((v) => !v)}
              className={`flex-shrink-0 text-[10px] font-medium px-1.5 py-0.5 rounded transition-colors ${
                isMe
                  ? 'text-blue-200/70 hover:text-blue-100 hover:bg-blue-500/30'
                  : 'text-theme-muted hover:text-theme-text hover:bg-surface-card'
              }`}
              title="Change translation language"
            >
              {showLangPicker ? '▴ Close' : '▾ Change'}
            </button>
          </div>

          {/* Row 2 (conditional): Inline language picker — NOT floating, so it never clips */}
          {showLangPicker && (
            <div
              className={`mb-2 rounded-lg border ${
                isMe
                  ? 'bg-blue-900/60 border-blue-600/50'
                  : 'bg-surface-card border-theme-border'
              }`}
            >
              {/*
                max-h bounds the list height.
                overflow-y-auto + overscroll-contain give smooth, contained scrolling.
                We use onMouseDown + e.preventDefault on each row so the click fires
                reliably even on touch — and doesn't get intercepted by parent handlers.
              */}
              <div className="max-h-[176px] overflow-y-auto overscroll-contain">
                {DEEPL_SELECTABLE_LANGUAGES.map((lang) => {
                  const isActive = lang.code === activeLang;
                  return (
                    <button
                      key={lang.code}
                      type="button"
                      onMouseDown={(e) => {
                        e.preventDefault(); // keep focus + prevent outside-click from firing first
                        e.stopPropagation();
                        handlePickLanguage(lang.code);
                      }}
                      className={`w-full text-left px-3 py-2 text-[12px] font-medium transition-colors flex items-center justify-between gap-2 ${
                        isActive
                          ? isMe
                            ? 'bg-blue-600/60 text-white'
                            : 'bg-[var(--accent-primary)]/15 text-[var(--accent-primary)]'
                          : isMe
                          ? 'text-blue-100/80 hover:bg-blue-700/40'
                          : 'text-theme-text hover:bg-surface-hover'
                      }`}
                    >
                      <span>{lang.name}</span>
                      {isActive && (
                        <svg className="w-3 h-3 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                          <path
                            fillRule="evenodd"
                            d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                            clipRule="evenodd"
                          />
                        </svg>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Row 3: Loading spinner */}
          {isTranslating && (
            <div className={`flex items-center gap-1.5 py-1 text-[12px] italic ${
              isMe ? 'text-blue-200/70' : 'text-theme-muted'
            }`}>
              <span className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin flex-shrink-0 inline-block" />
              Translating…
            </div>
          )}

          {/* Row 3b: Error state with Retry */}
          {!isTranslating && currentEntry?.error && (
            <div className="flex items-center gap-2 py-1">
              <p className="text-[12px] text-red-400 italic flex-1">{currentEntry.error}</p>
              <button
                type="button"
                onClick={() => doTranslate(activeLang)}
                className="text-[11px] font-medium text-red-400 hover:text-red-300 underline flex-shrink-0"
              >
                Retry
              </button>
            </div>
          )}

          {/* Row 4: Translated text */}
          {!isTranslating && !currentEntry?.error && currentEntry?.text && (
            <p className={`text-[14px] italic break-words leading-relaxed ${isMe ? 'opacity-90' : 'text-theme-text'}`}>
              {currentEntry.text}
            </p>
          )}
        </div>
      )}

      {/* Footer: A/文 toggle + timestamp + read receipt */}
      <div className="flex justify-between items-end space-x-4 mt-1.5">
        {message.text ? (
          <button
            onClick={handleToggleTranslation}
            disabled={isTranslating}
            className={`text-[11px] font-semibold tracking-wide uppercase transition-opacity ${
              isTranslating ? 'opacity-50 cursor-not-allowed' : 'hover:opacity-70 cursor-pointer'
            } ${isMe ? 'text-white/70' : 'text-[var(--accent-primary)]'}`}
          >
            {isTranslating ? '…' : showTranslation ? 'Hide' : 'A/文'}
          </button>
        ) : (
          <span />
        )}

        <div className="flex items-center space-x-1 flex-shrink-0 ml-2">
          {/* Study Later */}
          {isStudyLater && (
            <svg className={`w-3.5 h-3.5 mr-0.5 ${isMe ? 'text-purple-200' : 'text-purple-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          )}

          {/* Phrasebook */}
          {isPhrasebookSaved && (
            <svg className={`w-3.5 h-3.5 mr-0.5 ${isMe ? 'text-emerald-200' : 'text-emerald-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
          )}

          {/* Favorite star */}
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
                  : 'opacity-60 drop-shadow-[0_1px_1px_rgba(0,0,0,0.2)]'
              }`}
              fill="currentColor"
              viewBox="0 0 24 24"
            >
              <path d="M18 7l-1.41-1.41-6.34 6.34 1.41 1.41L18 7zm4.24-1.41L11.66 16.17 7.48 12l-1.41 1.41L11.66 19l12-12-1.42-1.41zM.41 13.41L6 19l1.41-1.41L1.83 12 .41 13.41z" />
            </svg>
          )}
        </div>
      </div>

      {/* Media lightbox */}
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