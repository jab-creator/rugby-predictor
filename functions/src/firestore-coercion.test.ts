import * as admin from 'firebase-admin';
import { coerceTimestamp, resolvePoolSeasonId } from './firestore-coercion';

describe('coerceTimestamp', () => {
  test('returns Timestamp instances unchanged', () => {
    const value = admin.firestore.Timestamp.fromDate(new Date('2099-07-05T07:10:00Z'));

    expect(coerceTimestamp(value)).toBe(value);
  });

  test('parses ISO timestamp strings', () => {
    const result = coerceTimestamp('2099-07-05T07:10:00Z');

    expect(result?.toDate().toISOString()).toBe('2099-07-05T07:10:00.000Z');
  });

  test('parses seconds and nanoseconds objects', () => {
    const result = coerceTimestamp({ seconds: 4076262600, nanoseconds: 123000000 });

    expect(result?.seconds).toBe(4076262600);
    expect(result?.nanoseconds).toBe(123000000);
  });

  test('returns null for invalid values', () => {
    expect(coerceTimestamp('not-a-date')).toBeNull();
    expect(coerceTimestamp({ nope: true })).toBeNull();
    expect(coerceTimestamp(null)).toBeNull();
  });
});

describe('resolvePoolSeasonId', () => {
  test('prefers seasonId when present', () => {
    expect(resolvePoolSeasonId({ seasonId: 'season-1', tournamentId: 'legacy-1' })).toBe('season-1');
  });

  test('falls back to legacy tournamentId', () => {
    expect(resolvePoolSeasonId({ tournamentId: 'legacy-1' })).toBe('legacy-1');
  });

  test('returns null when neither field is usable', () => {
    expect(resolvePoolSeasonId({ seasonId: '   ', tournamentId: '' })).toBeNull();
    expect(resolvePoolSeasonId(null)).toBeNull();
  });
});
