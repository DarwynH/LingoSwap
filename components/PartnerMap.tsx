/**
 * PartnerMap.tsx
 * Leaflet + OpenStreetMap map for the Find Partners section.
 * Global opt-in community map — shows ALL users who have enabled location sharing.
 *
 * A marker is shown ONLY when:
 *   1. locationSharingEnabled === true
 *   2. User has valid coordinates (locationLat/locationLng preferred; falls back to
 *      legacy approximateLat/approximateLng)
 *
 * 2026-05 accuracy update:
 *  - Switched from rounded approximate coords to accurate GPS (locationLat/locationLng).
 *    Fallback to legacy approximate fields for existing users who haven't re-set location.
 *  - Marker overlap fix: users at nearly identical coords (within ~50m bucket) are
 *    grouped into one marker. Popup lists all users. Individual offsets applied so
 *    overlapping exact-match coords spread into a small ring rather than stacking.
 *  - Self marker shown only when sharing is enabled and coords exist.
 *  - Real-time: markers derived entirely from `partners` prop on every render —
 *    no stale local marker state.
 *
 * 2026-05 viewport-stability fix:
 *  - Replaced the old FitBounds component (which called fitBounds/setView on every
 *    render whenever positions changed) with MapViewController.
 *  - MapViewController only auto-centers ONCE on the very first load, and only if the
 *    user hasn't interacted with the map yet.
 *  - Subsequent Firestore/partner updates do NOT reset zoom or center.
 *  - "Center on me" and "Show all" buttons let the user explicitly re-center.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { MapContainer, TileLayer, Marker, Popup, useMap, useMapEvents } from 'react-leaflet';
import { UserProfile } from '../types';
import {
  getUserLat,
  getUserLng,
  distanceBetweenUsers,
  formatDistance,
} from '../utils/locationUtils';
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

const selfMarkerIcon = createColoredMarker('#2563eb');

// ── Coordinate bucket size ────────────────────────────────────────────────────
// ~50m at the equator; users closer than this are grouped into one marker.
const BUCKET_PRECISION = 3; // decimal places (~111m resolution)

function toBucket(v: number): number {
  const factor = Math.pow(10, BUCKET_PRECISION);
  return Math.round(v * factor) / factor;
}

function coordBucketKey(lat: number, lng: number): string {
  return `${toBucket(lat)}_${toBucket(lng)}`;
}

// ── Location group ────────────────────────────────────────────────────────────
interface LocationGroup {
  /** Coordinate bucket key e.g. "35.689_139.692" */
  key: string;
  /** Representative lat for the group (centroid of members) */
  lat: number;
  /** Representative lng for the group (centroid of members) */
  lng: number;
  users: UserProfile[];
  /** true if ANY user in this group is a Best Match */
  hasBestMatch: boolean;
}

/**
 * Group visible partners by coordinate bucket.
 * Users in the same ~50m cell share one marker; popup lists all of them.
 */
function groupByCoordinate(partners: UserProfile[], currentUser: UserProfile): LocationGroup[] {
  const map = new Map<string, LocationGroup>();

  for (const p of partners) {
    const lat = getUserLat(p);
    const lng = getUserLng(p);
    if (lat === null || lng === null) continue;

    const key = coordBucketKey(lat, lng);
    if (!map.has(key)) {
      map.set(key, {
        key,
        lat,
        lng,
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

// ── MapViewController ─────────────────────────────────────────────────────────
/**
 * Inner component that controls map viewport in a stable way.
 *
 * Rules:
 * 1. Auto-centers ONCE on the first valid currentUser location (hasInitialCentered).
 * 2. After the user drags or zooms, userInteracted is set and auto-centering stops.
 * 3. Explicit actions ("Center on me", "Show all") are triggered by the parent via
 *    the `centerOnMeRequest` and `showAllRequest` counters — incrementing either
 *    counter fires the corresponding action regardless of userInteracted.
 * 4. Calling invalidateSize when the map becomes visible (triggered by invalidateTick).
 */
interface MapViewControllerProps {
  currentUserLocation: [number, number] | null;
  allPositions: [number, number][];
  centerOnMeRequest: number;   // increment to trigger "center on me"
  showAllRequest: number;      // increment to trigger "fit all markers"
  invalidateTick: number;      // increment to trigger invalidateSize
}

const MapViewController: React.FC<MapViewControllerProps> = ({
  currentUserLocation,
  allPositions,
  centerOnMeRequest,
  showAllRequest,
  invalidateTick,
}) => {
  const map = useMap();
  const hasInitialCenteredRef = useRef(false);
  const userInteractedRef = useRef(false);
  const prevCenterOnMeRef = useRef(centerOnMeRequest);
  const prevShowAllRef = useRef(showAllRequest);
  const prevInvalidateRef = useRef(invalidateTick);

  // Track user interaction so we stop auto-centering after they touch the map
  useMapEvents({
    dragstart: () => { userInteractedRef.current = true; },
    zoomstart: () => { userInteractedRef.current = true; },
  });

  // ── One-time initial centering ──────────────────────────────────────────────
  useEffect(() => {
    if (hasInitialCenteredRef.current) return;
    if (userInteractedRef.current) return;
    if (!currentUserLocation) return;

    map.setView(currentUserLocation, 13, { animate: false });
    hasInitialCenteredRef.current = true;
  }, [map, currentUserLocation]);

  // ── "Center on me" explicit action ─────────────────────────────────────────
  useEffect(() => {
    if (centerOnMeRequest === prevCenterOnMeRef.current) return;
    prevCenterOnMeRef.current = centerOnMeRequest;

    if (!currentUserLocation) return;
    map.flyTo(currentUserLocation, 13, { animate: true, duration: 0.8 });
    // After explicit action, reset userInteracted so next location update can
    // still be treated as "user chose to center here".
    userInteractedRef.current = false;
  }, [map, centerOnMeRequest, currentUserLocation]);

  // ── "Show all" explicit action ──────────────────────────────────────────────
  useEffect(() => {
    if (showAllRequest === prevShowAllRef.current) return;
    prevShowAllRef.current = showAllRequest;

    if (allPositions.length === 0) return;
    if (allPositions.length === 1) {
      map.flyTo(allPositions[0], 10, { animate: true, duration: 0.8 });
    } else {
      map.flyToBounds(allPositions, { padding: [40, 40], maxZoom: 10, animate: true, duration: 0.8 });
    }
    userInteractedRef.current = false;
  }, [map, showAllRequest, allPositions]);

  // ── invalidateSize when tab becomes visible ─────────────────────────────────
  useEffect(() => {
    if (invalidateTick === prevInvalidateRef.current) return;
    prevInvalidateRef.current = invalidateTick;

    const timer = setTimeout(() => {
      map.invalidateSize();
    }, 100);
    return () => clearTimeout(timer);
  }, [map, invalidateTick]);

  return null;
};

// ── MapResizer (initial paint fix) ───────────────────────────────────────────
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

// ── Main component ────────────────────────────────────────────────────────────
interface PartnerMapProps {
  currentUser: UserProfile;
  /** Pre-filtered list: already excludes current user, already requires locationSharingEnabled + valid coords. */
  partners: UserProfile[];
  onStartChat: (partner: UserProfile, chatId: string) => void;
}

const PartnerMap: React.FC<PartnerMapProps> = ({ currentUser, partners, onStartChat }) => {
  const selfLat = getUserLat(currentUser);
  const selfLng = getUserLng(currentUser);
  const selfHasLocation = !!(
    currentUser.locationSharingEnabled &&
    selfLat !== null &&
    selfLng !== null
  );

  // ── Stable initial center ────────────────────────────────────────────────────
  // Captured once at mount into a ref so MapContainer's `center` prop never
  // changes between renders (MapContainer ignores prop changes after mount, but
  // using a ref makes this explicit and safe).
  const initialCenterRef = useRef<[number, number] | null>(null);
  if (initialCenterRef.current === null) {
    // First render: pick the best starting center we have right now
    if (selfLat !== null && selfLng !== null) {
      initialCenterRef.current = [selfLat, selfLng];
    } else {
      // Pick any partner location, or fall back to world center
      const firstPartner = partners.find((p) => getUserLat(p) !== null && getUserLng(p) !== null);
      if (firstPartner) {
        initialCenterRef.current = [getUserLat(firstPartner)!, getUserLng(firstPartner)!];
      } else {
        initialCenterRef.current = [20, 0];
      }
    }
  }

  // ── Group partners by coordinate bucket ──────────────────────────────────────
  const locationGroups = groupByCoordinate(partners, currentUser);

  // ── Positions for "Show all" ─────────────────────────────────────────────────
  const allPositions: [number, number][] = [];
  if (selfHasLocation) allPositions.push([selfLat!, selfLng!]);
  locationGroups.forEach((g) => allPositions.push([g.lat, g.lng]));

  // ── Explicit action counters ─────────────────────────────────────────────────
  const [centerOnMeRequest, setCenterOnMeRequest] = useState(0);
  const [showAllRequest, setShowAllRequest] = useState(0);
  // Used to signal MapViewController to call invalidateSize (e.g. if needed)
  const [invalidateTick] = useState(0);

  const handleCenterOnMe = useCallback(() => {
    if (!selfHasLocation) return;
    setCenterOnMeRequest((n) => n + 1);
  }, [selfHasLocation]);

  const handleShowAll = useCallback(() => {
    if (allPositions.length === 0) return;
    setShowAllRequest((n) => n + 1);
  }, [allPositions.length]);

  const currentUserLocation: [number, number] | null =
    selfLat !== null && selfLng !== null ? [selfLat, selfLng] : null;

  return (
    <div
      className="relative w-full rounded-2xl overflow-hidden border shadow-sm"
      style={{ borderColor: 'var(--border-color)', height: '380px', minHeight: '300px' }}
    >
      <MapContainer
        center={initialCenterRef.current!}
        zoom={3}
        style={{ width: '100%', height: '100%' }}
        scrollWheelZoom
        attributionControl
      >
        {/* Initial paint fix — does NOT reset view on re-renders */}
        <MapResizer />

        {/* Viewport controller — stable, interaction-aware */}
        <MapViewController
          currentUserLocation={currentUserLocation}
          allPositions={allPositions}
          centerOnMeRequest={centerOnMeRequest}
          showAllRequest={showAllRequest}
          invalidateTick={invalidateTick}
        />

        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        />

        {/* Current user pin */}
        {selfHasLocation && (
          <Marker
            position={[selfLat!, selfLng!]}
            icon={selfMarkerIcon}
          >
            <Popup>
              <div className="text-sm font-semibold">📍 You</div>
              <div className="text-xs text-gray-500">Your location is only shared while sharing is on</div>
            </Popup>
          </Marker>
        )}

        {/* Grouped community member pins */}
        {locationGroups.map((group) => {
          // Composite key: bucket key + sorted user ids + visibility fields
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

          const icon = createColoredMarker(
            group.hasBestMatch ? '#f59e0b' : '#10b981',
            group.users.length
          );

          return (
            <Marker
              key={markerKey}
              position={[group.lat, group.lng]}
              icon={icon}
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

      {/* ── Map control buttons (z-index above tiles, below popups) ───────────── */}
      <div
        className="absolute top-3 right-3 z-[400] flex flex-col gap-1.5"
      >
        {selfHasLocation && (
          <button
            onClick={handleCenterOnMe}
            title="Center on my location"
            style={{
              background: 'var(--bg-surface, #fff)',
              border: '1px solid var(--border-color, #e5e7eb)',
              color: 'var(--text-primary, #111)',
              borderRadius: '10px',
              padding: '5px 10px',
              fontSize: '11px',
              fontWeight: 600,
              cursor: 'pointer',
              boxShadow: '0 1px 6px rgba(0,0,0,0.15)',
              whiteSpace: 'nowrap',
            }}
          >
            📍 Center on me
          </button>
        )}
        {allPositions.length > 0 && (
          <button
            onClick={handleShowAll}
            title="Fit all visible markers"
            style={{
              background: 'var(--bg-surface, #fff)',
              border: '1px solid var(--border-color, #e5e7eb)',
              color: 'var(--text-primary, #111)',
              borderRadius: '10px',
              padding: '5px 10px',
              fontSize: '11px',
              fontWeight: 600,
              cursor: 'pointer',
              boxShadow: '0 1px 6px rgba(0,0,0,0.15)',
              whiteSpace: 'nowrap',
            }}
          >
            🌍 Show all
          </button>
        )}
      </div>

      {/* Legend */}
      <div
        className="absolute bottom-3 left-3 z-[400] rounded-xl px-3 py-2 text-xs space-y-1 shadow-md"
        style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}
      >
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ background: '#2563eb' }} />
          You
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
            Use "Use my current location" above and enable sharing to appear on the community map.
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

          const distKm = selfHasLocation ? distanceBetweenUsers(currentUser, partner) : null;

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
