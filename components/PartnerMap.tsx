/**
 * PartnerMap.tsx
 * Leaflet + OpenStreetMap map for the Find Partners section.
 * Shows approximate locations of opted-in users only.
 * Fixes the common Vite Leaflet default-marker icon issue.
 */

import React, { useEffect } from 'react';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import { UserProfile } from '../types';
import { hasSharedApproxLocation, calculateDistanceKm, formatDistance } from '../utils/locationUtils';
import { getMatchDescription } from '../utils/matching';

// ── Fix default marker icons broken by Vite's asset pipeline ─────────────────
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

// @ts-ignore — delete prototype property to allow reassignment
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl: markerIcon,
  iconRetinaUrl: markerIcon2x,
  shadowUrl: markerShadow,
});

// Custom coloured markers
function createColoredMarker(color: string): L.DivIcon {
  return L.divIcon({
    className: '',
    html: `<div style="
      width:14px;height:14px;
      background:${color};
      border:2px solid #fff;
      border-radius:50%;
      box-shadow:0 2px 6px rgba(0,0,0,0.35);
    "></div>`,
    iconSize: [14, 14],
    iconAnchor: [7, 7],
    popupAnchor: [0, -10],
  });
}

const selfMarker = createColoredMarker('#2563eb');
const partnerMarker = createColoredMarker('#10b981');
const bestMatchMarker = createColoredMarker('#f59e0b');

// ── Auto-fit map bounds ───────────────────────────────────────────────────────
interface FitBoundsProps {
  positions: [number, number][];
}
const FitBounds: React.FC<FitBoundsProps> = ({ positions }) => {
  const map = useMap();
  useEffect(() => {
    if (positions.length > 1) {
      map.fitBounds(positions, { padding: [40, 40], maxZoom: 10 });
    } else if (positions.length === 1) {
      map.setView(positions[0], 7);
    }
  }, [map, positions]);
  return null;
};

// ── Main component ────────────────────────────────────────────────────────────
interface PartnerMapProps {
  currentUser: UserProfile;
  partners: UserProfile[];
  onStartChat: (partner: UserProfile, chatId: string) => void;
}

const PartnerMap: React.FC<PartnerMapProps> = ({ currentUser, partners, onStartChat }) => {
  const selfHasLocation = hasSharedApproxLocation(currentUser);
  const mappablePartners = partners.filter(hasSharedApproxLocation);

  const positions: [number, number][] = [];
  if (selfHasLocation) {
    positions.push([currentUser.approximateLat!, currentUser.approximateLng!]);
  }
  mappablePartners.forEach((p) => positions.push([p.approximateLat!, p.approximateLng!]));

  const defaultCenter: [number, number] = positions[0] ?? [20, 0];

  return (
    <div className="relative w-full rounded-2xl overflow-hidden border shadow-sm" style={{ borderColor: 'var(--border-color)', height: '380px' }}>
      <MapContainer
        center={defaultCenter}
        zoom={3}
        style={{ width: '100%', height: '100%' }}
        scrollWheelZoom
        attributionControl
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        />

        {positions.length > 0 && <FitBounds positions={positions} />}

        {/* Current user pin */}
        {selfHasLocation && (
          <Marker
            position={[currentUser.approximateLat!, currentUser.approximateLng!]}
            icon={selfMarker}
          >
            <Popup>
              <div className="text-sm font-semibold">📍 You (approximate)</div>
              <div className="text-xs text-gray-500">Your exact location is not shown</div>
            </Popup>
          </Marker>
        )}

        {/* Partner pins */}
        {mappablePartners.map((partner) => {
          const matchBadge = getMatchDescription(currentUser, partner);
          const isBest = matchBadge === 'Best Match';
          const distKm = selfHasLocation
            ? calculateDistanceKm(
                currentUser.approximateLat!,
                currentUser.approximateLng!,
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
            <Marker
              key={partner.id}
              position={[partner.approximateLat!, partner.approximateLng!]}
              icon={isBest ? bestMatchMarker : partnerMarker}
            >
              <Popup>
                <div style={{ minWidth: '160px' }}>
                  <div style={{ fontWeight: 700, fontSize: '0.875rem', marginBottom: '2px' }}>
                    {partner.name}
                    {isBest && <span style={{ marginLeft: '4px', color: '#f59e0b' }}>✨</span>}
                  </div>
                  {matchBadge && (
                    <div
                      style={{
                        display: 'inline-block',
                        fontSize: '0.65rem',
                        fontWeight: 700,
                        padding: '1px 6px',
                        borderRadius: '99px',
                        background: isBest ? 'rgba(245,158,11,0.15)' : 'rgba(16,185,129,0.12)',
                        color: isBest ? '#b45309' : '#059669',
                        marginBottom: '6px',
                      }}
                    >
                      {matchBadge}
                    </div>
                  )}
                  <div style={{ fontSize: '0.75rem', color: '#6b7280', lineHeight: 1.5 }}>
                    <div>🗣 Native: {nativeLangs}</div>
                    <div>📚 Learning: {targetLangs}</div>
                    {distKm !== null && (
                      <div>📍 ~{formatDistance(distKm)} away</div>
                    )}
                    {partner.basedCity && (
                      <div>🏙 {partner.basedCity}{partner.basedCountry ? `, ${partner.basedCountry}` : ''}</div>
                    )}
                  </div>
                  <button
                    onClick={() => {
                      const chatId = [currentUser.id, partner.id].sort().join('_');
                      onStartChat(partner, chatId);
                    }}
                    style={{
                      marginTop: '8px',
                      width: '100%',
                      padding: '5px 10px',
                      borderRadius: '8px',
                      background: '#2563eb',
                      color: '#fff',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      border: 'none',
                      cursor: 'pointer',
                    }}
                  >
                    Start Chat →
                  </button>
                </div>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>

      {/* Legend */}
      <div
        className="absolute bottom-3 left-3 z-[400] rounded-xl px-3 py-2 text-xs space-y-1 shadow-md"
        style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}
      >
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ background: '#2563eb' }} />
          You (approximate)
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ background: '#f59e0b' }} />
          Best Match
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ background: '#10b981' }} />
          Partner
        </div>
      </div>

      {/* Empty state overlay */}
      {mappablePartners.length === 0 && !selfHasLocation && (
        <div
          className="absolute inset-0 z-[400] flex flex-col items-center justify-center gap-2 text-center px-6"
          style={{ background: 'rgba(var(--bg-main-rgb, 240,244,248), 0.85)', pointerEvents: 'none' }}
        >
          <span className="text-3xl">🗺️</span>
          <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
            No location data yet
          </p>
          <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
            Enable location sharing above to see yourself and nearby partners on the map.
            <br />
            Only users who opt in appear here.
          </p>
        </div>
      )}
      {mappablePartners.length === 0 && selfHasLocation && (
        <div
          className="absolute bottom-14 left-1/2 -translate-x-1/2 z-[400] rounded-xl px-4 py-2 text-xs text-center shadow"
          style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}
        >
          No nearby partners sharing location yet.
        </div>
      )}
    </div>
  );
};

export default PartnerMap;
