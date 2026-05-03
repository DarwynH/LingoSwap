import { collection, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import React, { useState, useEffect } from 'react';
import { UserProfile } from '../types';
import PartnerCard from './Dashboard/PartnerCard';

interface FindPartnersProps {
  user: UserProfile;
  onStartChat: (partner: UserProfile, chatId: string) => void;
}

const FindPartners: React.FC<FindPartnersProps> = ({ user, onStartChat }) => {
  const [realPartners, setRealPartners] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    const getPartners = async () => {
      try {
        const querySnapshot = await getDocs(collection(db, "users"));
        const list = querySnapshot.docs
          .map(doc => doc.data() as UserProfile)
          .filter(p => p.id !== user.id);
        setRealPartners(list);
      } catch (error) {
        console.error("Error fetching users:", error);
      } finally {
        setLoading(false);
      }
    };
    getPartners();
  }, [user.id]);

  // Apply search filter
  const filteredPartners = realPartners.filter(p =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Logic to separate "Perfect Matches" from "Global Community"
  const suggestedPartners = filteredPartners.filter(p =>
    p.nativeLanguage === user.targetLanguage &&
    p.targetLanguage === user.nativeLanguage
  );

  const otherPartners = filteredPartners.filter(p => !suggestedPartners.includes(p));

  if (loading) return (
    <div className="flex-1 flex flex-col h-full bg-surface-main items-center justify-center p-8 text-center text-theme-muted">
      Loading partners...
    </div>
  );

  return (
    <div className="flex-1 flex flex-col h-full bg-surface-main">
      <header className="bg-surface-card/90 backdrop-blur-md border-b border-theme-border p-4">
        <h1 className="text-xl font-bold text-theme-text">Find Partners</h1>
        <p className="text-xs text-theme-muted mb-4">Connect with native speakers from around the world.</p>
        
        {/* Search Input */}
        <div className="relative group">
          <svg className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 transition-colors ${searchQuery ? 'text-theme-text' : 'text-theme-muted'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
          <input
            type="text"
            placeholder="Search users by name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-surface-base border border-theme-border text-theme-text text-sm rounded-xl pl-9 pr-10 py-2.5 outline-none transition-colors shadow-sm placeholder-theme-muted focus:border-[#00a884] focus:ring-1 focus:ring-[#00a884]"
          />
          {searchQuery && (
            <button 
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-theme-muted hover:text-theme-text bg-surface-hover rounded-full transition-colors"
              title="Clear search"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12"/></svg>
            </button>
          )}
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-6 space-y-8">
        {filteredPartners.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-12 text-center h-full">
            <div className="w-20 h-20 bg-surface-hover rounded-full flex items-center justify-center mb-4">
              <svg className="w-10 h-10 text-theme-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <h3 className="text-lg font-bold text-theme-text">No users found</h3>
            <p className="text-sm text-theme-muted mt-1">Try adjusting your search query.</p>
          </div>
        ) : (
          <>
            {suggestedPartners.length > 0 && (
              <section>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xs font-bold text-theme-muted uppercase tracking-widest">Perfect Matches</h3>
                  <span className="bg-[#00a884]/10 text-[#00a884] text-[10px] px-2 py-0.5 rounded-full font-bold">Recommended</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                  {suggestedPartners.map(partner => (
                    <PartnerCard
                      key={partner.id}
                      partner={partner}
                      onClick={() => {
                        const chatId = [user.id, partner.id].sort().join('_');
                        onStartChat(partner, chatId);
                      }}
                    />
                  ))}
                </div>
              </section>
            )}

            {otherPartners.length > 0 && (
              <section>
                <h3 className="text-xs font-bold text-theme-muted mb-4 uppercase tracking-widest">Global Community</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                  {otherPartners.map(partner => (
                    <PartnerCard
                      key={partner.id}
                      partner={partner}
                      onClick={() => {
                        const chatId = [user.id, partner.id].sort().join('_');
                        onStartChat(partner, chatId);
                      }}
                    />
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default FindPartners;