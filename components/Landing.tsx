import React from 'react';

interface LandingProps {
  onNavigateToAuth: (isLogin: boolean) => void;
}

const Landing: React.FC<LandingProps> = ({ onNavigateToAuth }) => {
  return (
    <div className="flex flex-col min-h-[100dvh] bg-gray-900 text-gray-100 items-center p-6 sm:p-12 overflow-y-auto overflow-x-hidden">
      <div className="max-w-4xl w-full text-center space-y-8 my-auto">
        
        {/* Header Section with the added Logo */}
       <div className="max-w-4xl w-full text-center space-y-8 my-auto">
        
        {/* Clean Header Section - No NDHU image here! */}
        <div className="space-y-4 flex flex-col items-center">
          <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-emerald-400 pb-2">
            LingoSwap
          </h1>
          <p className="text-xl md:text-2xl text-gray-400 font-light max-w-2xl mx-auto">
            Connect with native speakers around the world. Master a new language through natural conversation.
          </p>
        </div>          <button
            onClick={() => onNavigateToAuth(false)}
            className="w-full sm:w-auto px-8 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-medium transition-colors shadow-lg shadow-blue-500/30"
          >
            Get Started
          </button>
          <button
            onClick={() => onNavigateToAuth(true)}
            className="w-full sm:w-auto px-8 py-3 bg-gray-800 hover:bg-gray-700 text-white rounded-xl font-medium transition-colors border border-gray-700"
          >
            Sign In
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-16 text-left">
          <div className="bg-gray-800/50 p-6 rounded-2xl border border-gray-700/50 hover:bg-gray-800 transition-colors">
            <h3 className="text-lg font-semibold text-blue-400 mb-2">Real-time Chat</h3>
            <p className="text-gray-400 text-sm leading-relaxed">Instant messaging designed for language exchange, keeping conversations flowing naturally.</p>
          </div>
          <div className="bg-gray-800/50 p-6 rounded-2xl border border-gray-700/50 hover:bg-gray-800 transition-colors">
            <h3 className="text-lg font-semibold text-emerald-400 mb-2">Voice & Video Calls</h3>
            <p className="text-gray-400 text-sm leading-relaxed">Practice your speaking and listening skills with high-quality calls built right in.</p>
          </div>
          <div className="bg-gray-800/50 p-6 rounded-2xl border border-gray-700/50 hover:bg-gray-800 transition-colors">
            <h3 className="text-lg font-semibold text-purple-400 mb-2">Smart Tools</h3>
            <p className="text-gray-400 text-sm leading-relaxed">Save vocabulary, track your partners, and easily jump back into past conversations.</p>
          </div>
        </div>

        {/* Footer Section with Logo */}
        <div className="pt-24 pb-8 flex flex-col items-center opacity-80 hover:opacity-100 transition-opacity duration-300">
          <img 
            src="/ndhu_logo.png" 
            alt="LingoSwap Logo" 
            className="w-16 h-16 mb-4 drop-shadow-lg object-contain"
          />
          <p className="text-xs tracking-wider uppercase text-gray-500 font-medium">An Academic Project</p>
          <p className="text-sm text-gray-400 mt-1">National Dong Hwa University</p>
        </div>
      </div>
    </div>
  );
};

export default Landing;