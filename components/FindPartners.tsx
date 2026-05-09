/**
 * FindPartners.tsx (Discover / Find Partners section)
 * Adds an opt-in map view (Leaflet + OpenStreetMap) alongside the existing partner list.
 * Language matching remains the primary sorting criterion.
 * Location is a secondary bonus only.
 */

import { collection, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import React, { useState, useEffect, lazy, Suspense } from 'react';
import { UserProfile } from '../types';
import PartnerCard from './Dashboard/PartnerCard';
import { sortPartnersByMatch, isReciprocalMatch, getMatchDescription } from '../utils/matching';
import { hasSharedApproxLocation, calculateDistanceKm, formatDistance } from '../utils/locationUtils';
import LocationSettings from './LocationSettings';

// Lazy-load the map to avoid loading Leaflet CSS globally on app start
const PartnerMap = lazy(() => import('./PartnerMap'));

interface FindPartnersProps {
  user: UserProfile;
  onStartChat: (partner: UserProfile, chatId: string) => void;
}

type ViewTab = 'list' | 'map';

const FindPartners: React.FC<FindPartnersProps> = ({ user, onStartChat }) => {
  const [realPartners, setRealPartners] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<ViewTab>('list');

  // Local copy of current user — updated optimistically when location is saved
  const [localUser, setLocalUser] = useState<UserProfile>(user);

  // Merge incoming prop updates with local optimistic state
  useEffect(() => {
    setLocalUser((prev) => ({ ...prev, ...user }));
  }, [user]);

  const handleUserUpdated = (patch: Partial<UserProfile>) => {
    setLocalUser((prev) => ({ ...prev, ...patch }));
  };

  // ── Fetch partners ──────────────────────────────────────────────────────────
  useEffect(() => {
    const getPartners = async () => {
      try {
        const querySnapshot = await getDocs(collection(db, 'users'));
        const list = querySnapshot.docs
          .map((doc) => doc.data() as UserProfile)
          .filter((p) => p.id !== user.id);
        setRealPartners(list);
      } catch (error) {
        console.error('Error fetching users:', error);
      } finally {
        setLoading(false);
      }
    };
    getPartners();
  }, [user.id]);

  // ── Filtering & sorting ─────────────────────────────────────────────────────
  const filteredPartners = realPartners.filter((p) =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (p.basedCity ?? '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (p.basedCountry ?? '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  const sortedPartners = sortPartnersByMatch(localUser, filteredPartners);
  const suggestedPartners = sortedPartners.filter((p) => isReciprocalMatch(localUser, p));
  const otherPartners = sortedPartners.filter((p) => !isReciprocalMatch(localUser, p));

  // Partners shown in the Nearby list (sorted by distance if both have coords)
  const nearbyPartners = [...sortedPartners].sort((a, b) => {
    const aHas = hasSharedApproxLocation(a) && hasSharedApproxLocation(localUser);
    const bHas = hasSharedApproxLocation(b) && hasSharedApproxLocation(localUser);
    if (aHas && bHas) {
      const dA = calculateDistanceKm(localUser.approximateLat!, localUser.approximateLng!, a.approximateLat!, a.approximateLng!);
      const dB = calculateDistanceKm(localUser.approximateLat!, localUser.approximateLng!, b.approximateLat!, b.approximateLng!);
      return dA - dB;
    }
    if (aHas) return -1;
    if (bHas) return 1;
    return 0;
  });

  // ── Loading state ───────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex-1 flex flex-col h-full bg-surface-main items-center justify-center p-8 text-center text-theme-muted">
        Loading partners…
      </div>
    );
  }

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="flex-1 flex flex-col h-full bg-surface-main">
      {/* ── Header ── */}
      <header className="bg-surface-card/90 backdrop-blur-md border-b border-theme-border p-4">
        <h1 className="text-xl font-extrabold text-theme-text">Discover Partners</h1>
        <p className="text-xs text-theme-muted mb-4">
          Find native speakers who are learning your language — the perfect exchange.
        </p>

        {/* Tabs */}
        <div className="flex gap-2 mb-3">
          {(['list', 'map'] as ViewTab[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className="px-4 py-1.5 rounded-xl text-sm font-semibold transition-all"
              style={{
                background: activeTab === tab ? 'var(--accent-primary)' : 'var(--bg-surface-hover)',
                color: activeTab === tab ? '#fff' : 'var(--text-secondary)',
              }}
            >
              {tab === 'list' ? '👥 List' : '🗺️ Map'}
            </button>
          ))}
        </div>

        {/* Search (list tab only) */}
        {activeTab === 'list' && (
          <div className="relative group">
            <svg
              className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 transition-colors ${searchQuery ? 'text-theme-text' : 'text-theme-muted'}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="Search by name, city, or country…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-surface-main border border-theme-border text-theme-text text-sm rounded-xl pl-9 pr-10 py-2.5 outline-none transition-all shadow-sm placeholder-theme-muted"
              onFocus={(e) => (e.currentTarget.style.borderColor = 'var(--accent-primary)')}
              onBlur={(e) => (e.currentTarget.style.borderColor = '')}
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-theme-muted hover:text-theme-text bg-surface-hover rounded-full transition-colors"
                title="Clear search"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        )}
      </header>

      {/* ── Body ── */}
      <div className="flex-1 overflow-y-auto p-4 md:p-6">

        {/* ── MAP TAB ─────────────────────────────────────────────────────────── */}
        {activeTab === 'map' && (
          <div className="space-y-4">
            {/* Location Settings card */}
            <LocationSettings user={localUser} onUserUpdated={handleUserUpdated} />

            {/* Map */}
            <Suspense
              fallback={
                <div
                  className="w-full rounded-2xl flex items-center justify-center text-sm"
                  style={{ height: 380, background: 'var(--bg-surface)', border: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}
                >
                  Loading map…
                </div>
              }
            >
              <PartnerMap
                currentUser={localUser}
                partners={filteredPartners}
                onStartChat={onStartChat}
              />
            </Suspense>

            {/* Nearby partner list */}
            <div>
              <h3 className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: 'var(--text-secondary)' }}>
                📍 Nearby Partners
              </h3>
              {nearbyPartners.length === 0 ? (
                <p className="text-sm text-center py-6" style={{ color: 'var(--text-secondary)' }}>
                  No partners found.
                </p>
              ) : (
                <div className="space-y-2">
                  {nearbyPartners.map((partner) => {
                    const matchBadge = getMatchDescription(localUser, partner);
                    const isBest = matchBadge === 'Best Match';
                    const hasCoords = hasSharedApproxLocation(partner) && hasSharedApproxLocation(localUser);
                    const distKm = hasCoords
                      ? calculateDistanceKm(
                          localUser.approximateLat!,
                          localUser.approximateLng!,
                          partner.approximateLat!,
                          partner.approximateLng!
                        )
                      : null;

                    const nativeLangs = Array.isArray(partner.nativeLanguage)
                      ? partner.nativeLanguage.join(', ')
                      : partner.nativeLanguage ?? '—';
                    const targetLangs = Array.isArray(partner.targetLanguage)
                      ? partner.targetLanguage.join(', ')
                      : partner.targetLanguage ?? '—';

                    return (
                      <div
                        key={partner.id}
                        className="flex items-center justify-between gap-3 rounded-xl px-4 py-3 border transition-all"
                        style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-color)' }}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          {/* Avatar */}
                          <img
                            src={partner.avatar || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(partner.name)}`}
                            alt={partner.name}
                            className="w-10 h-10 rounded-full flex-shrink-0 object-cover"
                          />
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>
                                {partner.name}
                              </span>
                              {matchBadge && (
                                <span
                                  className="text-[10px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0"
                                  style={{
                                    background: isBest ? 'rgba(245,158,11,0.15)' : 'rgba(139,92,246,0.1)',
                                    color: isBest ? '#b45309' : '#8b5cf6',
                                  }}
                                >
                                  {isBest ? '✨ Best Match' : matchBadge}
                                </span>
                              )}
                            </div>
                            <div className="text-xs mt-0.5 space-x-2" style={{ color: 'var(--text-secondary)' }}>
                              <span>🗣 {nativeLangs}</span>
                              <span>📚 {targetLangs}</span>
                              {partner.basedCity && (
                                <span>
                                  🏙 {partner.basedCity}
                                  {partner.basedCountry ? `, ${partner.basedCountry}` : ''}
                                </span>
                              )}
                              {distKm !== null && (
                                <span>📍 ~{formatDistance(distKm)}</span>
                              )}
                            </div>
                          </div>
                        </div>
                        <button
                          onClick={() => {
                            const chatId = [localUser.id, partner.id].sort().join('_');
                            onStartChat(partner, chatId);
                          }}
                          className="flex-shrink-0 text-xs font-semibold px-3 py-1.5 rounded-lg transition-all"
                          style={{ background: 'var(--accent-primary-muted)', color: 'var(--accent-primary)' }}
                        >
                          Chat →
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── LIST TAB ────────────────────────────────────────────────────────── */}
        {activeTab === 'list' && (
          <>
            {filteredPartners.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-12 text-center h-full">
                <div className="w-20 h-20 bg-surface-hover rounded-full flex items-center justify-center mb-4">
                  <svg className="w-10 h-10 text-theme-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                      d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
                <h3 className="text-lg font-bold text-theme-text">No users found</h3>
                <p className="text-sm text-theme-muted mt-1">Try adjusting your search query.</p>
              </div>
            ) : (
              <div className="space-y-8">
                {suggestedPartners.length > 0 && (
                  <section>
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-xs font-bold text-theme-muted uppercase tracking-widest">✦ Perfect Matches</h3>
                      <span
                        className="text-[10px] px-2 py-0.5 rounded-full font-bold"
                        style={{ background: 'var(--accent-primary-muted)', color: 'var(--accent-primary)' }}
                      >
                        Recommended
                      </span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                      {suggestedPartners.map((partner) => (
                        <PartnerCard
                          key={partner.id}
                          partner={partner}
                          matchBadge={getMatchDescription(localUser, partner)}
                          onClick={() => {
                            const chatId = [localUser.id, partner.id].sort().join('_');
                            onStartChat(partner, chatId);
                          }}
                        />
                      ))}
                    </div>
                  </section>
                )}

                {otherPartners.length > 0 && (
                  <section>
                    <h3 className="text-xs font-bold text-theme-muted mb-4 uppercase tracking-widest">🌍 Global Community</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                      {otherPartners.map((partner) => (
                        <PartnerCard
                          key={partner.id}
                          partner={partner}
                          matchBadge={getMatchDescription(localUser, partner)}
                          onClick={() => {
                            const chatId = [localUser.id, partner.id].sort().join('_');
                            onStartChat(partner, chatId);
                          }}
                        />
                      ))}
                    </div>
                  </section>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default FindPartners;