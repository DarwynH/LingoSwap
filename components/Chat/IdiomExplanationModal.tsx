import React, { useEffect, useState } from 'react';
import { lookupIdiomOrSlang, IdiomExplanation } from '../../services/idiomService';

interface IdiomExplanationModalProps {
  phrase: string;
  preferredLanguage?: string;
  onClose: () => void;
  // TODO: Add onSave prop once we extend the saved items schema
}

const IdiomExplanationModal: React.FC<IdiomExplanationModalProps> = ({ phrase, preferredLanguage, onClose }) => {
  const [data, setData] = useState<IdiomExplanation | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorType, setErrorType] = useState<string | null>(null);

  useEffect(() => {
    const fetchExplanation = async () => {
      setLoading(true);
      setErrorType(null);
      try {
        const result = await lookupIdiomOrSlang(phrase, preferredLanguage);
        if (result) {
          setData(result);
        } else {
          setErrorType('not_found');
        }
      } catch (err: any) {
        console.error('Failed to explain phrase', err);
        if (err.message === 'phrase_too_long') {
          setErrorType('too_long');
        } else if (err.message === 'no_api_key') {
          setErrorType('no_api_key');
        } else {
          setErrorType('error');
        }
      } finally {
        setLoading(false);
      }
    };
    fetchExplanation();
  }, [phrase, preferredLanguage]);

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div 
        className="w-full max-w-sm bg-surface-main border border-theme-border rounded-2xl shadow-2xl overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-theme-border/50 bg-surface-card">
          <h3 className="font-semibold text-theme-text text-[16px]">Phrase Explanation</h3>
          <button 
            onClick={onClose}
            className="p-1.5 text-theme-muted hover:text-theme-text hover:bg-surface-hover rounded-full transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-5 flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-8 space-y-3">
              <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
              <p className="text-theme-muted text-[13px]">Generating explanation...</p>
            </div>
          ) : errorType || !data ? (
            <div className="flex flex-col items-center justify-center py-6 text-center">
              <div className="w-12 h-12 rounded-full bg-surface-card flex items-center justify-center mb-3">
                <svg className="w-6 h-6 text-theme-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <p className="text-theme-text font-medium mb-1">No explanation found</p>
              <p className="text-theme-muted text-[13px]">
                {errorType === 'too_long' 
                  ? "Please select a shorter phrase." 
                  : errorType === 'no_api_key'
                  ? "AI explanation is not available right now."
                  : "Couldn’t generate an explanation. Try a shorter phrase."}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="mb-2">
                <h4 className="text-xl font-bold text-blue-400 capitalize">{data.phrase}</h4>
                <p className="text-[11px] text-theme-muted uppercase tracking-wide mt-1">
                  {data.source === 'ai' ? 'AI-generated explanation' : `Source: ${data.source}`}
                </p>
              </div>
              
              <div className="space-y-3">
                <div className="bg-surface-card p-3.5 rounded-xl border border-theme-border/50">
                  <p className="text-[12px] font-semibold text-theme-muted uppercase tracking-wider mb-1">Meaning</p>
                  <p className="text-theme-text text-[14px] leading-relaxed">{data.translatedMeaning || data.meaning}</p>
                  {data.translatedMeaning && (
                    <p className="text-[12px] text-theme-muted mt-1.5 italic border-t border-theme-border/50 pt-1.5">{data.meaning}</p>
                  )}
                </div>

                {(data.explanation || data.translatedExplanation) && (
                  <div className="bg-surface-card p-3.5 rounded-xl border border-theme-border/50">
                    <p className="text-[12px] font-semibold text-theme-muted uppercase tracking-wider mb-1">Explanation</p>
                    <p className="text-theme-text text-[14px] leading-relaxed">{data.translatedExplanation || data.explanation}</p>
                    {data.translatedExplanation && data.explanation && (
                      <p className="text-[12px] text-theme-muted mt-1.5 italic border-t border-theme-border/50 pt-1.5">{data.explanation}</p>
                    )}
                  </div>
                )}

                {(data.example || data.translatedExample) && (
                  <div className="bg-blue-900/10 p-3.5 rounded-xl border border-blue-500/20">
                    <p className="text-[12px] font-semibold text-blue-300 uppercase tracking-wider mb-1">Example</p>
                    <p className="text-blue-100 text-[14px] italic">"{data.translatedExample || data.example}"</p>
                    {data.translatedExample && data.example && (
                      <p className="text-[12px] text-blue-200/60 mt-1.5 italic border-t border-blue-500/20 pt-1.5">"{data.example}"</p>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-5 py-4 border-t border-theme-border/50 bg-surface-card flex justify-end space-x-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-[13px] font-semibold text-theme-muted hover:text-theme-text transition-colors"
          >
            Close
          </button>
          {!loading && !errorType && data && (
            <button
              disabled
              title="Saving idioms is coming soon"
              className="px-4 py-2 bg-blue-600/50 text-white text-[13px] font-semibold rounded-lg opacity-50 cursor-not-allowed"
            >
              Save (TODO)
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default IdiomExplanationModal;
