import { resolveTournamentUserAttributes } from './tournament-user-attributes';

describe('resolveTournamentUserAttributes', () => {
  it('applies tournament country overrides ahead of default country mapping', () => {
    expect(
      resolveTournamentUserAttributes(
        {
          leaderboardConfig: { enableHemisphere: true },
          countryHemisphereOverrides: { JP: 'south' },
        },
        { countryCode: 'jp', isPundit: false },
      ),
    ).toEqual({
      countryCode: 'JP',
      resolvedHemisphere: 'south',
      isPundit: false,
    });
  });

  it('falls back to default country hemisphere mapping when no override exists', () => {
    expect(
      resolveTournamentUserAttributes(
        {
          leaderboardConfig: { enableHemisphere: true },
        },
        { countryCode: 'za', isPundit: true },
      ),
    ).toEqual({
      countryCode: 'ZA',
      resolvedHemisphere: 'south',
      isPundit: true,
    });
  });

  it('omits resolvedHemisphere when hemisphere leaderboards are disabled', () => {
    expect(
      resolveTournamentUserAttributes(
        {
          leaderboardConfig: { enableHemisphere: false },
          countryHemisphereOverrides: { JP: 'south' },
        },
        { countryCode: 'JP', isPundit: false },
      ),
    ).toEqual({
      countryCode: 'JP',
      isPundit: false,
    });
  });

  it('omits resolvedHemisphere when no mapping exists for the country', () => {
    expect(
      resolveTournamentUserAttributes(
        {
          leaderboardConfig: { enableHemisphere: true },
        },
        { countryCode: 'DE', isPundit: false },
      ),
    ).toEqual({
      countryCode: 'DE',
      isPundit: false,
    });
  });
});
