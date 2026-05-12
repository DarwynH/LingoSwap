/**
 * LocationSettings.tsx
 * Opt-in location control card shown inside the Find Partners / Discover section.
 *
 * 2026-05 update:
 *  - Switched from approximate (rounded) coordinates to accurate browser GPS.
 *    Accurate coords are stored as locationLat / locationLng in Firestore.
 *  - Privacy notice updated to reflect accurate location usage.
 *  - Sharing toggle guards: prevents enabling sharing without valid coordinates.
 *  - HTTPS / insecure context detection with user-friendly messaging.
 *  - enableHighAccuracy: true, maximumAge: 60000, timeout: 10000
 */

import React, { useState } from 'react';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { UserProfile } from '../types';
import { getUserLat, getUserLng } from '../utils/locationUtils';

interface LocationSettingsProps {
  user: UserProfile;
  onUserUpdated: (updated: Partial<UserProfile>) => void;
}

const LocationSettings: React.FC<LocationSettingsProps> = ({ user, onUserUpdated }) => {
  const [sharing, setSharing] = useState<boolean>(user.locationSharingEnabled ?? false);
  const [city, setCity] = useState(user.basedCity ?? '');
  const [country, setCountry] = useState(user.basedCountry ?? '');
  const [geoStatus, setGeoStatus] = useState<
    'idle' | 'loading' | 'denied' | 'ok' | 'insecure' | 'unsupported' | 'unavailable' | 'timeout'
  >('idle');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [expanded, setExpanded] = useState(false);

  // Detected GPS coords (not yet persisted until user saves)
  const [pendingLat, setPendingLat] = useState<number | null>(null);
  const [pendingLng, setPendingLng] = useState<number | null>(null);

  // Determine if user already has a valid stored location
  const hasStoredLocation =
    getUserLat(user) !== null && getUserLng(user) !== null;

  // ── Geolocation handler ─────────────────────────────────────────────────────
  const handleUseMyLocation = () => {
    // Check HTTPS requirement
    if (window.isSecureContext === false) {
      setGeoStatus('insecure');
      console.warn('Geolocation requires a secure context (HTTPS or localhost).');
      return;
    }
    if (!navigator.geolocation) {
      setGeoStatus('unsupported');
      console.warn('Geolocation is not supported by this browser.');
      return;
    }
    setGeoStatus('loading');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        // Keep accurate GPS — do NOT round
        setPendingLat(lat);
        setPendingLng(lng);
        setGeoStatus('ok');
        // Optimistically reflect in parent so map can show immediately
        onUserUpdated({ locationLat: lat, locationLng: lng });
      },
      (error) => {
        console.warn('Geolocation error:', error);
        if (error.code === error.PERMISSION_DENIED) {
          setGeoStatus('denied');
        } else if (error.code === error.POSITION_UNAVAILABLE) {
          setGeoStatus('unavailable');
        } else if (error.code === error.TIMEOUT) {
          setGeoStatus('timeout');
        } else {
          setGeoStatus('denied');
        }
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  };

  // ── Toggle: immediately write locationSharingEnabled to Firestore ────────────
  const handleToggleSharing = async () => {
    const newValue = !sharing;

    // Guard: don't enable sharing if there's no valid location
    if (newValue) {
      const effectiveLat = pendingLat ?? getUserLat(user);
      const effectiveLng = pendingLng ?? getUserLng(user);
      if (effectiveLat === null || effectiveLng === null) {
        // Prompt user to get location first
        setGeoStatus('idle');
        setExpanded(true);
        alert('Please use "Use my current location" first before enabling location sharing.');
        return;
      }
    }

    setSharing(newValue);

    try {
      const togglePatch: Record<string, unknown> = {
        locationSharingEnabled: newValue,
        locationUpdatedAt: serverTimestamp(),
      };

      if (!newValue) {
        // Turning off: do NOT clear the coordinates — just hide from map.
        // Coordinates are preserved so the user can re-enable without re-detecting.
        // (The Firestore filter uses locationSharingEnabled to show/hide markers.)
      }

      await updateDoc(doc(db, 'users', user.id), togglePatch);

      onUserUpdated({ locationSharingEnabled: newValue });
    } catch (e) {
      console.error('Location toggle error:', e);
      // Revert local state if Firestore write failed
      setSharing((prev) => !prev);
    }
  };

  // ── Firestore save (city / country + accurate GPS coords) ──────────────────
  const handleSave = async () => {
    setSaving(true);
    try {
      const effectiveLat = pendingLat ?? getUserLat(user);
      const effectiveLng = pendingLng ?? getUserLng(user);

      const patch: Record<string, unknown> = {
        locationSharingEnabled: sharing,
        basedCity: city.trim(),
        basedCountry: country.trim(),
        locationUpdatedAt: serverTimestamp(),
      };

      if (effectiveLat !== null && effectiveLng !== null) {
        // Store accurate GPS coords under the new field names
        patch.locationLat = effectiveLat;
        patch.locationLng = effectiveLng;
      }

      await updateDoc(doc(db, 'users', user.id), patch);

      onUserUpdated({
        locationSharingEnabled: sharing,
        basedCity: city.trim(),
        basedCountry: country.trim(),
        locationLat: effectiveLat,
        locationLng: effectiveLng,
      });

      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (e) {
      console.error('Location save error:', e);
    } finally {
      setSaving(false);
    }
  };

  // ── UI ──────────────────────────────────────────────────────────────────────
  return (
    <div
      className="rounded-2xl border shadow-sm overflow-hidden mb-4"
      style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-color)' }}
    >
      {/* Header row */}
      <button
        onClick={() => setExpanded((x) => !x)}
        className="w-full flex items-center justify-between px-4 py-3 text-left"
      >
        <div className="flex items-center gap-2">
          <span className="text-base">📍</span>
          <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
            My Location &amp; Map Sharing
          </span>
          {user.locationSharingEnabled && (
            <span
              className="text-[10px] font-bold px-2 py-0.5 rounded-full"
              style={{ background: 'rgba(16,185,129,0.12)', color: '#10b981' }}
            >
              Sharing On
            </span>
          )}
        </div>
        <svg
          className={`w-4 h-4 transition-transform ${expanded ? 'rotate-180' : ''}`}
          style={{ color: 'var(--text-secondary)' }}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {expanded && (
        <div className="px-4 pb-4 space-y-3 border-t" style={{ borderColor: 'var(--border-color)' }}>

          {/* Privacy notice — prominent */}
          <div
            className="mt-3 rounded-xl px-3 py-2.5 text-xs space-y-1"
            style={{ background: 'rgba(37,99,235,0.07)', border: '1px solid rgba(37,99,235,0.18)' }}
          >
            <p className="font-semibold" style={{ color: 'var(--text-primary)' }}>
              🔒 Privacy &amp; Location
            </p>
            <p style={{ color: 'var(--text-secondary)' }}>
              • Your location is <strong>only shared</strong> when the sharing switch below is enabled.
            </p>
            <p style={{ color: 'var(--text-secondary)' }}>
              • You can <strong>turn off location sharing anytime</strong>.
            </p>
            <p style={{ color: 'var(--text-secondary)' }}>
              • Your location is used <strong>only</strong> for Find Partners nearby discovery.
            </p>
          </div>

          {/* Current location status */}
          {hasStoredLocation && geoStatus !== 'ok' && (
            <p className="text-xs" style={{ color: '#10b981' }}>
              ✓ Location saved{user.locationSharingEnabled ? ' — sharing ON' : ' — sharing OFF'}.
            </p>
          )}

          {/* Geolocation button */}
          <button
            onClick={handleUseMyLocation}
            disabled={geoStatus === 'loading'}
            className="flex items-center gap-2 text-sm px-3 py-2 rounded-xl font-medium transition-all"
            style={{
              background: 'var(--accent-primary-muted)',
              color: 'var(--accent-primary)',
            }}
          >
            {geoStatus === 'loading' ? (
              <>
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                </svg>
                Detecting location…
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                Use my current location
              </>
            )}
          </button>

          {/* Status messages */}
          {geoStatus === 'ok' && (
            <p className="text-xs" style={{ color: '#10b981' }}>
              ✓ Location detected. Save below to update map sharing.
            </p>
          )}
          {geoStatus === 'denied' && (
            <p className="text-xs text-red-500">
              Location permission was denied. Enable it in your browser settings, or enter your city manually.
            </p>
          )}
          {geoStatus === 'insecure' && (
            <p className="text-xs text-red-500">
              Location access requires HTTPS or localhost. If testing on a phone, deploy the app or use a secure
              tunnel (e.g. ngrok).
            </p>
          )}
          {geoStatus === 'unsupported' && (
            <p className="text-xs text-red-500">
              Your browser does not support location detection. You can still enter your city manually.
            </p>
          )}
          {geoStatus === 'unavailable' && (
            <p className="text-xs text-red-500">
              Could not detect your location. Please try again or enter your city manually.
            </p>
          )}
          {geoStatus === 'timeout' && (
            <p className="text-xs text-red-500">
              Location detection timed out. Please try again or enter your city manually.
            </p>
          )}

          {/* Sharing toggle */}
          <label className="flex items-center gap-3 cursor-pointer">
            <button
              role="switch"
              aria-checked={sharing}
              onClick={handleToggleSharing}
              className="relative w-10 h-5 rounded-full transition-colors flex-shrink-0"
              style={{
                background: sharing ? 'var(--accent-primary)' : 'var(--border-color)',
              }}
            >
              <span
                className="absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform"
                style={{ transform: sharing ? 'translateX(20px)' : 'translateX(0)' }}
              />
            </button>
            <div>
              <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                Share my location on map
              </span>
              <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                {sharing
                  ? 'Other users can see you on the community map.'
                  : 'Your marker is hidden from the map.'}
              </p>
            </div>
          </label>

          {/* Manual city/country */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs font-medium block mb-1" style={{ color: 'var(--text-secondary)' }}>
                City
              </label>
              <input
                type="text"
                placeholder="e.g. Tokyo"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className="w-full text-sm rounded-xl px-3 py-2 border outline-none transition-all"
                style={{
                  background: 'var(--bg-main)',
                  borderColor: 'var(--border-color)',
                  color: 'var(--text-primary)',
                }}
                onFocus={(e) => (e.currentTarget.style.borderColor = 'var(--accent-primary)')}
                onBlur={(e) => (e.currentTarget.style.borderColor = 'var(--border-color)')}
              />
            </div>
            <div>
              <label className="text-xs font-medium block mb-1" style={{ color: 'var(--text-secondary)' }}>
                Country
              </label>
              <input
                type="text"
                placeholder="e.g. Japan"
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                className="w-full text-sm rounded-xl px-3 py-2 border outline-none transition-all"
                style={{
                  background: 'var(--bg-main)',
                  borderColor: 'var(--border-color)',
                  color: 'var(--text-primary)',
                }}
                onFocus={(e) => (e.currentTarget.style.borderColor = 'var(--accent-primary)')}
                onBlur={(e) => (e.currentTarget.style.borderColor = 'var(--border-color)')}
              />
            </div>
          </div>

          {/* Save */}
          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full py-2 rounded-xl text-sm font-semibold transition-all"
            style={{
              background: saved ? 'rgba(16,185,129,0.15)' : 'var(--accent-primary)',
              color: saved ? '#10b981' : '#fff',
            }}
          >
            {saving ? 'Saving…' : saved ? '✓ Saved!' : 'Save Location Settings'}
          </button>
        </div>
      )}
    </div>
  );
};

export default LocationSettings;
