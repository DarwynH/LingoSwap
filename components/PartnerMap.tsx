/**
 * PartnerMap.tsx
 * Leaflet + OpenStreetMap map for the Find Partners section.
 * Global opt-in community map — shows ALL users who have enabled location sharing.
 * A partner marker is shown ONLY when:
 *   1. locationSharingEnabled === true
 *   2. approximateLat and approximateLng exist (valid approximate coordinates)
 * Online status is handled by the parent (FindPartners) via the onlineOnly toggle.
 * Language matching is only used for marker colour (Best Match = gold).
 *
 * Bug fixes (2026-05):
 *  - Overlapping markers: users sharing the same rounded coordinate are grouped into a
 *    single marker. The popup lists ALL users in that approximate area.
 *  - Stale markers: markers are derived entirely from the `partners` prop each render;
 *    no separate marker state that could lag behind.
 *  - Stable React keys: composite key includes all visibility-relevant fields so React
 *    removes markers that no longer pass the visibility filter.
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

// ── Custom coloured markers ───────────────────────────────────────────────────
function createColoredMarker(color: string, count = 1): L.DivIcon {
  const showBadge = count > 1;
  return L.divIcon({
    className: '',
    html: `
      <div style="position:relative;display:inline-block;">
        <div style="
          width:18px;height:18px;
          background:${color};
          border:2.5px solid #fff;
          border-radius:50%;
          box-shadow:0 2px 8px rgba(0,0,0,0.35);
        "></div>
        ${showBadge ? `
        <div style="
          position:absolute;
          top:-6px;right:-8px;
          background:#1e40af;
          color:#fff;
          font-size:9px;
          font-weight:700;
          min-width:14px;
          height:14px;
          border-radius:7px;
          display:flex;align-items:center;justify-content:center;
          border:1.5px solid #fff;
          padding:0 2px;
          line-height:1;
        ">${count}</div>` : ''}
      </div>`,
    iconSize: [18, 18],
    iconAnchor: [9, 9],
    popupAnchor: [0, -12],
  });
}

const selfMarker = createColoredMarker('#2563eb');

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

const MapResizer: React.FC = () => {
  const map = useMap();
  useEffect(() => {
    const timer = setTimeout(() => {
      map.invalidateSize();
    }, 100);
    return () => clearTimeout(timer);
  }, [map]);
  return null;
};

// ── Location group ────────────────────────────────────────────────────────────
interface LocationGroup {
  /** Coordinate key e.g. "35.68_139.69" */
  key: string;
  lat: number;
  lng: number;
  users: UserProfile[];
  /** true if ANY user in this group is a Best Match */
  hasBestMatch: boolean;
}

/** Build a stable coordinate key from rounded approximate coordinates. */
function coordKey(lat: number, lng: number): string {
  return `${lat}_${lng}`;
}

/**
 * Group visible partners by their approximate coordinates.
 * Users at the exact same rounded position go into one group.
 */
function groupByCoordinate(partners: UserProfile[], currentUser: UserProfile): LocationGroup[] {
  const map = new Map<string, LocationGroup>();

  for (const p of partners) {
    if (typeof p.approximateLat !== 'number' || typeof p.approximateLng !== 'number') continue;
    const key = coordKey(p.approximateLat, p.approximateLng);
    if (!map.has(key)) {
      map.set(key, {
        key,
        lat: p.approximateLat,
        lng: p.approximateLng,
        users: [],
        hasBestMatch: false,
      });
    }
    const group = map.get(key)!;
    group.users.push(p);
    if (getMatchDescription(currentUser, p) === 'Best Match') {
      group.hasBestMatch = true;
    }
  }

  return Array.from(map.values());
}

// ── Main component ────────────────────────────────────────────────────────────
interface PartnerMapProps {
  currentUser: UserProfile;
  /** Pre-filtered list: already excludes current user, already requires locationSharingEnabled + coords. */
  partners: UserProfile[];
  onStartChat: (partner: UserProfile, chatId: string) => void;
}

const PartnerMap: React.FC<PartnerMapProps> = ({ currentUser, partners, onStartChat }) => {
  const selfHasLocation = hasSharedApproxLocation(currentUser);

  // Group partners by approximate coordinate — solves the overlapping-marker bug.
  const locationGroups = groupByCoordinate(partners, currentUser);

  // All map positions for auto-fitting bounds
  const positions: [number, number][] = [];
  if (selfHasLocation) {
    positions.push([currentUser.approximateLat!, currentUser.approximateLng!]);
  }
  locationGroups.forEach((g) => positions.push([g.lat, g.lng]));

  const defaultCenter: [number, number] = positions[0] ?? [20, 0];

  return (
    <div
      className="relative w-full rounded-2xl overflow-hidden border shadow-sm"
      style={{ borderColor: 'var(--border-color)', height: '380px', minHeight: '300px' }}
    >
      <MapContainer
        center={defaultCenter}
        zoom={3}
        style={{ width: '100%', height: '100%' }}
        scrollWheelZoom
        attributionControl
      >
        <MapResizer />
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

        {/* Grouped community member pins */}
        {locationGroups.map((group) => {
          // Composite key: coord key + sorted user ids + their visibility-relevant fields.
          // This ensures React replaces the marker element when membership changes.
          const memberKeys = group.users
            .map(
              (u) =>
                `${u.id}:${u.locationSharingEnabled}:${u.isOnline}:${
                  u.lastSeen?.seconds ?? (typeof u.lastSeen === 'number' ? u.lastSeen : 0)
                }`
            )
            .sort()
            .join('|');
          const markerKey = `group-${group.key}-${memberKeys}`;

          const markerIcon = createColoredMarker(
            group.hasBestMatch ? '#f59e0b' : '#10b981',
            group.users.length
          );

          return (
            <Marker
              key={markerKey}
              position={[group.lat, group.lng]}
              icon={markerIcon}
            >
              <Popup>
                <GroupPopup
                  group={group}
                  currentUser={currentUser}
                  selfHasLocation={selfHasLocation}
                  onStartChat={onStartChat}
                />
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
          Best Match nearby
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ background: '#10b981' }} />
          Community member
        </div>
        <div className="flex items-center gap-1.5 opacity-70">
          <span
            className="inline-flex items-center justify-center font-bold rounded-full text-white"
            style={{ background: '#1e40af', fontSize: '8px', width: '14px', height: '14px' }}
          >
            N
          </span>
          Badge = N users at location
        </div>
      </div>

      {/* Empty state overlay */}
      {locationGroups.length === 0 && !selfHasLocation && (
        <div
          className="absolute inset-0 z-[400] flex flex-col items-center justify-center gap-2 text-center px-6"
          style={{ background: 'rgba(var(--bg-main-rgb, 240,244,248), 0.85)', pointerEvents: 'none' }}
        >
          <span className="text-3xl">🗺️</span>
          <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
            No location data yet
          </p>
          <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
            Enable location sharing above to appear on the community map and see other members.
            <br />
            Only users who opt in are visible — any language, anywhere in the world.
          </p>
        </div>
      )}
      {locationGroups.length === 0 && selfHasLocation && (
        <div
          className="absolute bottom-14 left-1/2 -translate-x-1/2 z-[400] rounded-xl px-4 py-2 text-xs text-center shadow"
          style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}
        >
          No other community members have enabled location sharing yet.
        </div>
      )}
    </div>
  );
};

// ── GroupPopup ────────────────────────────────────────────────────────────────
/**
 * Renders the popup for a location group.
 * When multiple users share the same approximate coordinates, they all appear here.
 */
interface GroupPopupProps {
  group: LocationGroup;
  currentUser: UserProfile;
  selfHasLocation: boolean;
  onStartChat: (partner: UserProfile, chatId: string) => void;
}

const GroupPopup: React.FC<GroupPopupProps> = ({ group, currentUser, selfHasLocation, onStartChat }) => {
  const count = group.users.length;

  return (
    <div style={{ minWidth: '190px', maxWidth: '260px' }}>
      {/* Group header */}
      {count > 1 && (
        <div
          style={{
            fontWeight: 700,
            fontSize: '0.75rem',
            marginBottom: '8px',
            paddingBottom: '6px',
            borderBottom: '1px solid #e5e7eb',
            color: '#374151',
          }}
        >
          📍 {count} members in this area
        </div>
      )}

      {/* User list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {group.users.map((partner) => {
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
            <div
              key={partner.id}
              style={{
                paddingBottom: count > 1 ? '10px' : '0',
                borderBottom: count > 1 ? '1px solid #f3f4f6' : 'none',
              }}
            >
              {/* Name row */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '3px' }}>
                <span style={{ fontWeight: 700, fontSize: '0.875rem', color: '#111827' }}>
                  {partner.name}
                </span>
                {isBest && <span style={{ color: '#f59e0b' }}>✨</span>}
              </div>

              {/* Match badge */}
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
                    marginBottom: '5px',
                  }}
                >
                  {matchBadge}
                </div>
              )}

              {/* Details */}
              <div style={{ fontSize: '0.72rem', color: '#6b7280', lineHeight: 1.55 }}>
                <div>🗣 Native: {nativeLangs}</div>
                <div>📚 Learning: {targetLangs}</div>
                {distKm !== null ? (
                  <div>📍 ~{formatDistance(distKm)} away</div>
                ) : (
                  <div>📍 Distance unavailable</div>
                )}
                {partner.basedCity && (
                  <div>
                    🏙 {partner.basedCity}
                    {partner.basedCountry ? `, ${partner.basedCountry}` : ''}
                  </div>
                )}
              </div>

              {/* Chat button */}
              <button
                onClick={() => {
                  const chatId = [currentUser.id, partner.id].sort().join('_');
                  onStartChat(partner, chatId);
                }}
                style={{
                  marginTop: '6px',
                  width: '100%',
                  padding: '5px 10px',
                  borderRadius: '8px',
                  background: '#2563eb',
                  color: '#fff',
                  fontSize: '0.72rem',
                  fontWeight: 600,
                  border: 'none',
                  cursor: 'pointer',
                }}
              >
                Start Chat →
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default PartnerMap;
