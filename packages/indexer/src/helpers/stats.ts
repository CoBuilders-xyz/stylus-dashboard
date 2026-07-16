const SECONDS_PER_DAY = 86400;

export function getDayId(timestamp: number): string {
  const date = new Date(timestamp * 1000);
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getDayStartTimestamp(timestamp: number): number {
  return Math.floor(timestamp / SECONDS_PER_DAY) * SECONDS_PER_DAY;
}

export const EXPIRY_DAYS = 365;
export const EXPIRY_SECONDS = EXPIRY_DAYS * SECONDS_PER_DAY;
