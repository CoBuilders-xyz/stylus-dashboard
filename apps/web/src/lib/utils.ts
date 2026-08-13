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
