export type Hemisphere = 'north' | 'south';

export interface TournamentLeaderboardConfig {
  enableOverall?: boolean;
  enableCountry?: boolean;
  enableHemisphere?: boolean;
  enablePundit?: boolean;
}

export interface TournamentDoc {
  leaderboardConfig?: TournamentLeaderboardConfig | null;
  countryHemisphereOverrides?: Record<string, Hemisphere> | null;
}

export interface TournamentUserAttributeSource {
  countryCode?: string | null;
  isPundit?: boolean | null;
}

export interface ResolvedTournamentUserAttributes {
  countryCode?: string;
  resolvedHemisphere?: Hemisphere;
  isPundit: boolean;
}

const DEFAULT_COUNTRY_HEMISPHERES: Record<string, Hemisphere> = {
  AR: 'south',
  AU: 'south',
  BR: 'south',
  CA: 'north',
  CL: 'south',
  ES: 'north',
  FJ: 'south',
  FR: 'north',
  GB: 'north',
  IE: 'north',
  IT: 'north',
  JP: 'north',
  NZ: 'south',
  PT: 'north',
  US: 'north',
  UY: 'south',
  ZA: 'south',
};

function normalizeCountryCode(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }

  const normalized = value.trim().toUpperCase();
  return /^[A-Z]{2}$/.test(normalized) ? normalized : undefined;
}

function normalizeHemisphere(value: unknown): Hemisphere | undefined {
  return value === 'north' || value === 'south' ? value : undefined;
}

function hemisphereLeaderboardsEnabled(tournament?: TournamentDoc | null): boolean {
  return tournament?.leaderboardConfig?.enableHemisphere ?? true;
}

export function resolveTournamentUserAttributes(
  tournament: TournamentDoc | null | undefined,
  userProfile: TournamentUserAttributeSource | null | undefined,
): ResolvedTournamentUserAttributes {
  const countryCode = normalizeCountryCode(userProfile?.countryCode);
  const isPundit = userProfile?.isPundit === true;

  if (!hemisphereLeaderboardsEnabled(tournament)) {
    return {
      ...(countryCode ? { countryCode } : {}),
      isPundit,
    };
  }

  const overrideHemisphere = countryCode
    ? normalizeHemisphere(tournament?.countryHemisphereOverrides?.[countryCode])
    : undefined;
  const defaultHemisphere = countryCode
    ? DEFAULT_COUNTRY_HEMISPHERES[countryCode]
    : undefined;
  const resolvedHemisphere = overrideHemisphere ?? defaultHemisphere;

  return {
    ...(countryCode ? { countryCode } : {}),
    ...(resolvedHemisphere ? { resolvedHemisphere } : {}),
    isPundit,
  };
}
