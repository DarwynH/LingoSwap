import React from 'react';

interface LandingProps {
  onNavigateToAuth: (isLogin: boolean) => void;
}

/* ── Inline chat preview mock data ── */
const chatPreview = [
  { id: 1, isMe: false, name: 'Yuki', text: 'おはよう！今日は何をしましたか？', time: '9:01 AM' },
  { id: 2, isMe: true,  name: 'You',  text: 'Good morning! I went to the park.', time: '9:02 AM', translated: 'おはようございます！公園に行きました。' },
  { id: 3, isMe: false, name: 'Yuki', text: '素晴らしい！天気はどうでしたか？', time: '9:03 AM', saved: true },
  { id: 4, isMe: true,  name: 'You',  text: 'It was sunny and warm 🌸', time: '9:04 AM' },
];

const Landing: React.FC<LandingProps> = ({ onNavigateToAuth }) => {
  return (
    <div className="flex flex-col min-h-[100dvh] bg-[var(--bg-main)] text-[var(--text-primary)] overflow-x-hidden">

      {/* ── NAV ── */}
      <nav className="flex items-center justify-between px-6 py-4 max-w-6xl mx-auto w-full">
        <div className="flex items-center space-x-2">
          <img src="/ndhu_logo.png" alt="LingoSwap" className="w-8 h-8 object-contain" />
          <span className="font-extrabold text-xl tracking-tight text-[var(--text-primary)]">LingoSwap</span>
        </div>
        <div className="flex items-center space-x-3">
          <button
            onClick={() => onNavigateToAuth(true)}
            className="px-4 py-1.5 text-sm font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
          >
            Sign In
          </button>
          <button
            onClick={() => onNavigateToAuth(false)}
            className="px-4 py-1.5 text-sm font-semibold rounded-lg btn-accent shadow-sm"
          >
            Get Started
          </button>
        </div>
      </nav>

      {/* ── HERO ── */}
      <section className="hero-gradient flex-1 flex flex-col items-center justify-center px-6 py-16 text-center">
        <div className="max-w-5xl mx-auto w-full">

          {/* Pill badge */}
          <div className="inline-flex items-center space-x-2 bg-[var(--accent-primary-muted)] border border-[var(--accent-primary)]/30 text-[var(--accent-primary)] text-xs font-semibold px-3 py-1 rounded-full mb-6">
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent-primary)] animate-pulse"></span>
            <span>Language Exchange Platform</span>
          </div>

          <h1 className="text-5xl sm:text-6xl md:text-7xl font-black tracking-tight leading-none mb-6">
            <span className="text-[var(--text-primary)]">Chat. Translate.</span>
            <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[var(--accent-primary)] via-teal-400 to-[var(--accent-violet)]">
              Actually Learn.
            </span>
          </h1>

          <p className="text-lg md:text-xl text-[var(--text-secondary)] max-w-2xl mx-auto mb-10 leading-relaxed">
            Connect with native speakers worldwide. Translate phrases in real time,
            save vocabulary from real conversations, and build fluency that sticks.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16">
            <button
              onClick={() => onNavigateToAuth(false)}
              className="w-full sm:w-auto px-8 py-3.5 text-base font-bold rounded-xl btn-accent shadow-lg shadow-teal-500/20 active:scale-95 transition-all"
            >
              Start for free
            </button>
            <button
              onClick={() => onNavigateToAuth(true)}
              className="w-full sm:w-auto px-8 py-3.5 text-base font-semibold rounded-xl bg-[var(--bg-surface)] border border-[var(--border-color)] text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)] transition-colors"
            >
              Sign In
            </button>
          </div>

          {/* ── Chat Preview Mockup ── */}
          <div className="max-w-md mx-auto bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-3xl shadow-2xl overflow-hidden text-left">
            {/* Chat header */}
            <div className="flex items-center space-x-3 px-4 py-3 border-b border-[var(--border-color)] bg-[var(--bg-surface)]">
              <div className="relative">
                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-teal-400 to-cyan-500 flex items-center justify-center text-white font-bold text-sm">Y</div>
                <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 border-2 border-[var(--bg-surface)] rounded-full"></span>
              </div>
              <div>
                <p className="text-sm font-semibold text-[var(--text-primary)]">Yuki · 🇯🇵 Japanese</p>
                <p className="text-xs text-green-500 font-medium">Online</p>
              </div>
              <div className="ml-auto flex items-center space-x-2 text-[var(--text-secondary)]">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>
              </div>
            </div>

            {/* Messages */}
            <div className="px-4 py-4 space-y-3 bg-[var(--chat-bg)] min-h-[200px]">
              {chatPreview.map(msg => (
                <div key={msg.id} className={`flex ${msg.isMe ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[80%] px-3.5 py-2.5 rounded-2xl text-sm leading-snug ${
                    msg.isMe
                      ? 'bg-[var(--bubble-out-bg)] text-[var(--bubble-out-text)] rounded-tr-[4px]'
                      : 'bg-[var(--bubble-in-bg)] text-[var(--bubble-in-text)] border border-[var(--bubble-in-border)] rounded-tl-[4px]'
                  }`}>
                    <p>{msg.text}</p>
                    {msg.translated && (
                      <div className="mt-1.5 pt-1.5 border-t border-white/20">
                        <p className="text-[11px] text-white/60 uppercase font-semibold tracking-wider mb-0.5">Translated</p>
                        <p className="text-[12px] italic opacity-90">{msg.translated}</p>
                      </div>
                    )}
                    <div className="flex items-center justify-end space-x-1 mt-1">
                      {msg.saved && (
                        <svg className="w-3 h-3 text-amber-400" fill="currentColor" viewBox="0 0 20 20"><path d="M5 4a2 2 0 012-2h6a2 2 0 012 2v14l-5-2.5L5 18V4z" /></svg>
                      )}
                      <span className={`text-[10px] ${msg.isMe ? 'text-white/60' : 'text-[var(--text-secondary)]'}`}>{msg.time}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Input bar */}
            <div className="px-3 py-2.5 border-t border-[var(--border-color)] bg-[var(--bg-surface)] flex items-center space-x-2">
              <div className="flex-1 bg-[var(--bg-main)] rounded-full px-4 py-2 text-sm text-[var(--text-secondary)] border border-[var(--border-color)]">
                Type a message…
              </div>
              <div className="w-9 h-9 rounded-full btn-accent flex items-center justify-center flex-shrink-0">
                <svg className="w-4 h-4 text-white -rotate-45" fill="currentColor" viewBox="0 0 24 24"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" /></svg>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── FEATURE CARDS ── */}
      <section className="py-20 px-6 bg-[var(--bg-surface)]">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl font-extrabold text-center mb-3 text-[var(--text-primary)]">Built for language exchange</h2>
          <p className="text-center text-[var(--text-secondary)] mb-12 max-w-xl mx-auto">Everything you need to have meaningful conversations and actually build fluency.</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

            <div className="bg-[var(--bg-main)] p-6 rounded-2xl border border-[var(--border-color)] hover:border-[var(--accent-primary)]/40 transition-colors group">
              <div className="w-10 h-10 rounded-xl bg-[var(--accent-primary-muted)] flex items-center justify-center mb-4">
                <svg className="w-5 h-5 text-[var(--accent-primary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
              </div>
              <h3 className="text-base font-bold text-[var(--text-primary)] mb-2">Find Language Partners</h3>
              <p className="text-sm text-[var(--text-secondary)] leading-relaxed">Discover native speakers who are learning your language — the perfect two-way exchange.</p>
            </div>

            <div className="bg-[var(--bg-main)] p-6 rounded-2xl border border-[var(--border-color)] hover:border-[var(--accent-primary)]/40 transition-colors group">
              <div className="w-10 h-10 rounded-xl bg-[var(--accent-primary-muted)] flex items-center justify-center mb-4">
                <svg className="w-5 h-5 text-[var(--accent-primary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" /></svg>
              </div>
              <h3 className="text-base font-bold text-[var(--text-primary)] mb-2">Translate Inside Chat</h3>
              <p className="text-sm text-[var(--text-secondary)] leading-relaxed">Tap any message to get an instant translation powered by DeepL — without leaving the conversation.</p>
            </div>

            <div className="bg-[var(--bg-main)] p-6 rounded-2xl border border-[var(--border-color)] hover:border-[var(--accent-amber)]/40 transition-colors group">
              <div className="w-10 h-10 rounded-xl bg-[var(--accent-amber-muted)] flex items-center justify-center mb-4">
                <svg className="w-5 h-5 text-[var(--accent-amber)]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" /></svg>
              </div>
              <h3 className="text-base font-bold text-[var(--text-primary)] mb-2">Save &amp; Review Phrases</h3>
              <p className="text-sm text-[var(--text-secondary)] leading-relaxed">Save phrases directly from chat, add notes, and review them later with flashcards and spaced repetition.</p>
            </div>

          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section className="py-20 px-6 bg-[var(--bg-main)]">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl font-extrabold mb-3 text-[var(--text-primary)]">How it works</h2>
          <p className="text-[var(--text-secondary)] mb-14 max-w-xl mx-auto">Three simple steps to real language progress.</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">

            {[
              { step: '01', title: 'Discover a Partner', desc: 'Browse language learners worldwide and find someone who speaks what you want to learn.', color: 'var(--accent-primary)' },
              { step: '02', title: 'Start Chatting', desc: 'Exchange messages, voice notes, and even video calls — just like a real conversation.', color: 'var(--accent-violet)' },
              { step: '03', title: 'Translate, Save & Review', desc: 'Translate any phrase in-chat, save vocabulary to your phrasebook, and review with flashcards.', color: 'var(--accent-amber)' },
            ].map(({ step, title, desc, color }) => (
              <div key={step} className="flex flex-col items-center text-center">
                <div
                  className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl font-black text-white mb-4 shadow-lg"
                  style={{ backgroundColor: color }}
                >
                  {step}
                </div>
                <h3 className="text-base font-bold text-[var(--text-primary)] mb-2">{title}</h3>
                <p className="text-sm text-[var(--text-secondary)] leading-relaxed">{desc}</p>
              </div>
            ))}

          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="py-20 px-6 bg-[var(--bg-surface)] text-center">
        <h2 className="text-3xl font-extrabold text-[var(--text-primary)] mb-4">Ready to start?</h2>
        <p className="text-[var(--text-secondary)] mb-8 max-w-md mx-auto">Create a free account and begin your language exchange journey today.</p>
        <button
          onClick={() => onNavigateToAuth(false)}
          className="px-10 py-4 text-base font-bold rounded-xl btn-accent shadow-lg shadow-teal-500/20 active:scale-95 transition-all"
        >
          Create free account
        </button>
      </section>

      {/* ── FOOTER ── */}
      <footer className="py-10 px-6 border-t border-[var(--border-color)] bg-[var(--bg-main)]">
        <div className="max-w-4xl mx-auto flex flex-col items-center space-y-3 text-center">
          <div className="flex items-center space-x-2 opacity-70">
            <img src="/ndhu_logo.png" alt="NDHU" className="w-7 h-7 object-contain" />
            <span className="text-xs text-[var(--text-secondary)] font-medium">
              Built as an academic language learning project at National Dong Hwa University.
            </span>
          </div>
          <p className="text-[10px] text-[var(--text-secondary)] opacity-50">© 2026 LingoSwap.</p>
        </div>
      </footer>

    </div>
  );
};

export default Landing;