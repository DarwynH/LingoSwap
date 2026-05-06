export const getPresenceMillis = (lastSeen: any): number => {
  if (!lastSeen) return 0;
  if (typeof lastSeen.toMillis === 'function') return lastSeen.toMillis();
  if (typeof lastSeen === 'number') return lastSeen;
  if (lastSeen.seconds) return lastSeen.seconds * 1000;
  return 0;
};

export const isRecentlyOnline = (isOnline: boolean | undefined, lastSeen: any): boolean => {
  if (!isOnline) return false;
  const lastSeenMs = getPresenceMillis(lastSeen);
  // 5 minutes threshold
  return Date.now() - lastSeenMs < 5 * 60 * 1000;
};

export const formatLastSeen = (lastSeen: any, isOnline?: boolean, showActiveStatus?: boolean): string => {
  if (showActiveStatus === false) return 'Offline';
  
  if (isRecentlyOnline(isOnline, lastSeen)) return 'Online';
  const lastSeenMs = getPresenceMillis(lastSeen);
  if (!lastSeenMs) return 'Offline';

  const diff = Date.now() - lastSeenMs;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return 'Last seen just now';
  if (minutes < 60) return `Last seen ${minutes} minute${minutes > 1 ? 's' : ''} ago`;
  if (hours < 24) return `Last seen ${hours} hour${hours > 1 ? 's' : ''} ago`;
  if (days < 7) return `Last seen ${days} day${days > 1 ? 's' : ''} ago`;

  return `Last seen ${new Date(lastSeenMs).toLocaleDateString()}`;
};

export const getPresenceDotColor = (isOnline: boolean | undefined, lastSeen: any): string => {
  return isRecentlyOnline(isOnline, lastSeen) ? 'bg-[#25d366]' : 'bg-gray-400';
};
