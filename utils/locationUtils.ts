/**
 * locationUtils.ts
 * Location helpers for LingoSwap Find Partners feature.
 *
 * Strategy (2026-05 update):
 *  - Prefer accurate GPS fields: locationLat / locationLng
 *  - Fall back to legacy approximate fields: approximateLat / approximateLng
 *    (kept for backward compat with existing Firestore data)
 *  - roundCoordinate is kept for any legacy code paths but is no longer used
 *    when writing new location data.
 */

import { UserProfile } from '../types';

// ── Coordinate helpers ────────────────────────────────────────────────────────

/** @deprecated Use accurate locationLat/locationLng instead of rounding. */
export function roundCoordinate(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Safely parse a value that may be a number or a numeric string.
 * Returns the number or null if invalid.
 */
function safeNum(v: unknown): number | null {
  if (typeof v === 'number' && isFinite(v)) return v;
  if (typeof v === 'string') {
    const n = parseFloat(v);
    if (isFinite(n)) return n;
  }
  return null;
}

/**
 * Get the best available latitude for a user.
 * Prefers accurate locationLat; falls back to legacy approximateLat.
 */
export function getUserLat(user: UserProfile): number | null {
  return safeNum(user.locationLat) ?? safeNum(user.approximateLat);
}

/**
 * Get the best available longitude for a user.
 * Prefers accurate locationLng; falls back to legacy approximateLng.
 */
export function getUserLng(user: UserProfile): number | null {
  return safeNum(user.locationLng) ?? safeNum(user.approximateLng);
}

/**
 * Returns true if the user has opted in AND has valid coordinates
 * (either accurate or legacy approximate).
 */
export function hasValidLocation(user: UserProfile): boolean {
  return !!(
    user.locationSharingEnabled &&
    getUserLat(user) !== null &&
    getUserLng(user) !== null
  );
}

/**
 * @deprecated Prefer hasValidLocation which supports both field sets.
 * Kept for any remaining callers that import this name.
 */
export function hasSharedApproxLocation(user: UserProfile): boolean {
  return hasValidLocation(user);
}

// ── Distance calculation ──────────────────────────────────────────────────────

/**
 * Haversine formula — returns distance in kilometres between two lat/lng points.
 * Implemented inline so no extra dependency is needed.
 */
export function calculateDistanceKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371; // Earth radius km
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

/**
 * Returns distance in km between two users using the best available coordinates.
 * Returns null if either user lacks valid coordinates.
 */
export function distanceBetweenUsers(a: UserProfile, b: UserProfile): number | null {
  const aLat = getUserLat(a);
  const aLng = getUserLng(a);
  const bLat = getUserLat(b);
  const bLng = getUserLng(b);
  if (aLat === null || aLng === null || bLat === null || bLng === null) return null;
  return calculateDistanceKm(aLat, aLng, bLat, bLng);
}

/**
 * Returns a location proximity bonus score (0–20).
 * Only applied if BOTH users have valid coordinates.
 * Closer = higher bonus, never overrides language compatibility score.
 */
export function getLocationScore(currentUser: UserProfile, partner: UserProfile): number {
  const dist = distanceBetweenUsers(currentUser, partner);
  if (dist === null) return 0;
  // 0-20 scale: 0 km → 20 pts, 2000+ km → 0 pts
  return Math.max(0, Math.round(20 - (dist / 100)));
}

/** Human-readable distance string. */
export function formatDistance(km: number): string {
  if (km < 1) return '< 1 km';
  if (km < 1000) return `${Math.round(km)} km`;
  return `${(km / 1000).toFixed(1)} k km`;
}

/**
 * Small deterministic offset to separate markers at identical coordinates.
 * Prevents markers from stacking on top of each other when two users share
 * the same exact GPS point (e.g. same building / same device).
 * Offset is tiny (<~50m) so it doesn't affect distance readouts meaningfully.
 */
export function applyMarkerOffset(
  lat: number,
  lng: number,
  index: number,
  total: number
): [number, number] {
  if (total <= 1 || index === 0) return [lat, lng];
  const angle = (2 * Math.PI * index) / total;
  const delta = 0.0003; // ~33m
  return [lat + delta * Math.sin(angle), lng + delta * Math.cos(angle)];
}
