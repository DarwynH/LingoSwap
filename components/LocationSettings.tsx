/**
 * LocationSettings.tsx
 * Opt-in location control card shown inside the Find Partners / Discover section.
 * Privacy-safe: only stores rounded (city-level) coordinates when user explicitly opts in.
 */

import React, { useState } from 'react';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { UserProfile } from '../types';
import { roundCoordinate } from '../utils/locationUtils';

interface LocationSettingsProps {
  user: UserProfile;
  onUserUpdated: (updated: Partial<UserProfile>) => void;
}

const LocationSettings: React.FC<LocationSettingsProps> = ({ user, onUserUpdated }) => {
  const [sharing, setSharing] = useState<boolean>(user.locationSharingEnabled ?? false);
  const [city, setCity] = useState(user.basedCity ?? '');
  const [country, setCountry] = useState(user.basedCountry ?? '');
  const [geoStatus, setGeoStatus] = useState<'idle' | 'loading' | 'denied' | 'ok' | 'insecure' | 'unsupported' | 'unavailable' | 'timeout'>('idle');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [expanded, setExpanded] = useState(false);

  // ── Geolocation handler ─────────────────────────────────────────────────────
  const handleUseMyLocation = () => {
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
        const approxLat = roundCoordinate(pos.coords.latitude);
        const approxLng = roundCoordinate(pos.coords.longitude);
        // Store rounded coords in local form state only — not yet persisted
        onUserUpdated({ approximateLat: approxLat, approximateLng: approxLng });
        setGeoStatus('ok');
        setSharing(true);
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
      { enableHighAccuracy: false, timeout: 10000 }
    );
  };

  // ── Toggle: immediately write locationSharingEnabled to Firestore ────────────
  const handleToggleSharing = async () => {
    const newValue = !sharing;
    setSharing(newValue);

    try {
      const togglePatch: Record<string, unknown> = {
        locationSharingEnabled: newValue,
        locationUpdatedAt: serverTimestamp(),
      };

      if (!newValue) {
        // Turning off: immediately clear coordinates so the marker disappears
        togglePatch.approximateLat = null;
        togglePatch.approximateLng = null;
      }

      await updateDoc(doc(db, 'users', user.id), togglePatch);

      // Propagate to parent so localUser / map re-renders immediately
      onUserUpdated({
        locationSharingEnabled: newValue,
        approximateLat: newValue ? user.approximateLat : null,
        approximateLng: newValue ? user.approximateLng : null,
      });
    } catch (e) {
      console.error('Location toggle error:', e);
      // Revert local state if Firestore write failed
      setSharing((prev) => !prev);
    }
  };

  // ── Firestore save (city / country + full settings) ──────────────────────────
  const handleSave = async () => {
    setSaving(true);
    try {
      const patch: Record<string, unknown> = {
        locationSharingEnabled: sharing,
        basedCity: city.trim(),
        basedCountry: country.trim(),
        locationUpdatedAt: serverTimestamp(),
      };

      if (sharing && user.approximateLat != null && user.approximateLng != null) {
        patch.approximateLat = user.approximateLat;
        patch.approximateLng = user.approximateLng;
      } else if (!sharing) {
        // When opt-out, clear map coordinates from Firestore
        patch.approximateLat = null;
        patch.approximateLng = null;
      }

      await updateDoc(doc(db, 'users', user.id), patch);
      onUserUpdated({
        locationSharingEnabled: sharing,
        basedCity: city.trim(),
        basedCountry: country.trim(),
        approximateLat: sharing ? user.approximateLat : null,
        approximateLng: sharing ? user.approximateLng : null,
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
            Find nearby partners
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
          {/* Privacy notice */}
          <p className="text-xs mt-3" style={{ color: 'var(--text-secondary)' }}>
            Share approximate location to see nearby language partners. Your exact location is never shown. Only users who opt in appear on the map.
          </p>

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
                Detecting…
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                Use my approximate location
              </>
            )}
          </button>

          {geoStatus === 'ok' && (
            <p className="text-xs" style={{ color: '#10b981' }}>
              ✓ Approximate location detected. Save below to enable map sharing.
            </p>
          )}
          {geoStatus === 'denied' && (
            <p className="text-xs text-red-500">
              Location permission was denied. You can enable it in browser settings or enter your city manually.
            </p>
          )}
          {geoStatus === 'insecure' && (
            <p className="text-xs text-red-500">
              Location access requires HTTPS or localhost. If you are testing from a phone, deploy the app or use a secure tunnel.
            </p>
          )}
          {geoStatus === 'unsupported' && (
            <p className="text-xs text-red-500">
              Your browser does not support location detection. You can still enter your city manually.
            </p>
          )}
          {geoStatus === 'unavailable' && (
            <p className="text-xs text-red-500">
              We could not detect your location. Please try again or enter your city manually.
            </p>
          )}
          {geoStatus === 'timeout' && (
            <p className="text-xs text-red-500">
              Location detection took too long. Please try again or enter your city manually.
            </p>
          )}

          {/* Sharing toggle */}
          <label className="flex items-center gap-3 cursor-pointer">
            <button
              role="switch"
              aria-checked={sharing}
              onClick={handleToggleSharing}
              className={`relative w-10 h-5 rounded-full transition-colors ${sharing ? '' : ''}`}
              style={{
                background: sharing ? 'var(--accent-primary)' : 'var(--border-color)',
              }}
            >
              <span
                className="absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform"
                style={{ transform: sharing ? 'translateX(20px)' : 'translateX(0)' }}
              />
            </button>
            <span className="text-sm" style={{ color: 'var(--text-primary)' }}>
              Show my approximate location to partners
            </span>
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
