import { Timestamp } from 'firebase-admin/firestore';

function asValidDate(value: unknown): Date | null {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  if (typeof value === 'string' || typeof value === 'number') {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  return null;
}

export function coerceTimestamp(value: unknown): Timestamp | null {
  if (value instanceof Timestamp) {
    return value;
  }

  const dateValue = asValidDate(value);
  if (dateValue) {
    return Timestamp.fromDate(dateValue);
  }

  if (typeof value === 'object' && value !== null) {
    if ('toMillis' in value && typeof (value as { toMillis?: unknown }).toMillis === 'function') {
      const millis = (value as { toMillis: () => number }).toMillis();
      if (Number.isFinite(millis)) {
        return Timestamp.fromMillis(millis);
      }
    }

    const seconds = (value as { seconds?: unknown; _seconds?: unknown }).seconds
      ?? (value as { seconds?: unknown; _seconds?: unknown })._seconds;
    const nanoseconds = (value as { nanoseconds?: unknown; _nanoseconds?: unknown }).nanoseconds
      ?? (value as { nanoseconds?: unknown; _nanoseconds?: unknown })._nanoseconds;

    if (typeof seconds === 'number' && Number.isFinite(seconds)) {
      const nanos = typeof nanoseconds === 'number' && Number.isFinite(nanoseconds) ? nanoseconds : 0;
      return new Timestamp(seconds, nanos);
    }
  }

  return null;
}

function nonEmptyString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value : null;
}

export function resolvePoolSeasonId(poolData: { seasonId?: unknown; tournamentId?: unknown } | null | undefined): string | null {
  return nonEmptyString(poolData?.seasonId) ?? nonEmptyString(poolData?.tournamentId);
}
