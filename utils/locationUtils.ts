/**
 * locationUtils.ts
 * Privacy-safe location helpers for LingoSwap Find Partners feature.
 * Uses approximate (city-level) coordinates only — no exact GPS stored.
 */

import { UserProfile } from '../types';

/** Round coordinate to 2 decimal places (~1.1 km precision at equator) */
export function roundCoordinate(value: number): number {
  return Math.round(value * 100) / 100;
}

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

/** Returns true if the user has opted in AND has approximate coordinates. */
export function hasSharedApproxLocation(user: UserProfile): boolean {
  return !!(
    user.locationSharingEnabled &&
    user.approximateLat != null &&
    user.approximateLng != null
  );
}

/**
 * Returns a location proximity bonus score (0–20).
 * Only applied if BOTH users have shared approximate coordinates.
 * Closer = higher bonus, never overrides language compatibility score.
 */
export function getLocationScore(currentUser: UserProfile, partner: UserProfile): number {
  if (!hasSharedApproxLocation(currentUser) || !hasSharedApproxLocation(partner)) {
    return 0;
  }
  const dist = calculateDistanceKm(
    currentUser.approximateLat!,
    currentUser.approximateLng!,
    partner.approximateLat!,
    partner.approximateLng!
  );
  // 0-20 scale: 0 km → 20 pts, 2000+ km → 0 pts
  return Math.max(0, Math.round(20 - (dist / 100)));
}

/** Human-readable distance string. */
export function formatDistance(km: number): string {
  if (km < 1) return '< 1 km';
  if (km < 1000) return `${Math.round(km)} km`;
  return `${(km / 1000).toFixed(1)} k km`;
}
