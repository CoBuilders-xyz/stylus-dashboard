import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatNumber(num: number): string {
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(1)}K`;
  return num.toString();
}

export function formatPercent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

export type ExpiryStatus = 'active' | 'expiring-soon' | 'expired';

export function getExpiryStatus(
  expiresAt: number | null,
  now: number,
  windowSeconds: number,
): ExpiryStatus {
  if (expiresAt === null) return 'active';
  if (expiresAt < now) return 'expired';
  if (expiresAt <= now + windowSeconds) return 'expiring-soon';
  return 'active';
}

export type ExpiryBucket = 'Expired' | '<7d' | '7-30d' | '30-90d' | '90-180d' | '180d+';

export const EXPIRY_BUCKET_ORDER: ExpiryBucket[] = [
  'Expired',
  '<7d',
  '7-30d',
  '30-90d',
  '90-180d',
  '180d+',
];

const DAY_SECONDS = 24 * 60 * 60;

export function getExpiryBucket(expiresAt: number | null, now: number): ExpiryBucket {
  // A null expiresAt means no expiry has been set yet; bucket it with the
  // farthest-out contracts, matching getExpiryStatus treating it as active.
  if (expiresAt === null) return '180d+';

  const secondsRemaining = expiresAt - now;
  if (secondsRemaining < 0) return 'Expired';
  if (secondsRemaining < 7 * DAY_SECONDS) return '<7d';
  if (secondsRemaining < 30 * DAY_SECONDS) return '7-30d';
  if (secondsRemaining < 90 * DAY_SECONDS) return '30-90d';
  if (secondsRemaining < 180 * DAY_SECONDS) return '90-180d';
  return '180d+';
}
