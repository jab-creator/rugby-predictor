'use client';

import Header from '@/components/Header';
import { useAuth } from '@/contexts/AuthContext';
import {
  LeaderboardTab,
  getLeaderboardEntries,
  getLeaderboardTabs,
  getManualPoolLeaderboardEntries,
  getTournamentLeaderboardConfig,
} from '@/lib/leaderboard';
import { getPool } from '@/lib/pools';
import { LeaderboardEntry } from '@/lib/types';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';

export default function PoolLeaderboardPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const poolId = params?.poolId as string;

  const [poolName, setPoolName] = useState('');
  const [tournamentId, setTournamentId] = useState('');
  const [tabs, setTabs] = useState<Array<{ id: LeaderboardTab; label: string }>>([]);
  const [activeTab, setActiveTab] = useState<LeaderboardTab>('pool');
  const [selectedCountryCode, setSelectedCountryCode] = useState('');
  const [selectedHemisphere, setSelectedHemisphere] = useState<'north' | 'south'>('north');
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!loading && !user) {
      router.push('/');
      return;
    }

    if (!user || !poolId) return;

    const load = async () => {
      try {
        setLoadingData(true);
        const pool = await getPool(poolId);
        if (!pool) {
          setError('Pool not found');
          return;
        }

        setPoolName(pool.name);
        setTournamentId(pool.seasonId);

        const config = await getTournamentLeaderboardConfig(pool.seasonId);
        const availableTabs = getLeaderboardTabs(config);
        setTabs(availableTabs);

        if (availableTabs.length === 0) {
          setError('No leaderboard views are enabled for this tournament.');
          return;
        }

        setActiveTab((current) =>
          availableTabs.some((tab) => tab.id === current) ? current : availableTabs[0].id,
        );
      } catch (err) {
        console.error('Failed to load leaderboard config', err);
        setError('Failed to load leaderboard');
      } finally {
        setLoadingData(false);
      }
    };

    void load();
  }, [user, loading, poolId, router]);

  useEffect(() => {
    if (!tournamentId || tabs.length === 0) return;

    const loadEntries = async () => {
      try {
        setLoadingData(true);
        const nextEntries = activeTab === 'pool'
          ? await getManualPoolLeaderboardEntries({ poolId, tournamentId })
          : await getLeaderboardEntries({
              tournamentId,
              tab: activeTab,
              countryCode: selectedCountryCode,
              hemisphere: selectedHemisphere,
            });
        setEntries(nextEntries);
      } catch (err) {
        console.error('Failed to load leaderboard entries', err);
        setError('Failed to load leaderboard rows');
      } finally {
        setLoadingData(false);
      }
    };

    void loadEntries();
  }, [poolId, tournamentId, tabs, activeTab, selectedCountryCode, selectedHemisphere]);

  const emptyMessage = useMemo(() => {
    if (activeTab === 'country') {
      if (!selectedCountryCode) {
        return 'Select a country code to view this filtered leaderboard.';
      }
      return `No leaderboard rows for country ${selectedCountryCode}.`;
    }

    if (activeTab === 'hemisphere') {
      return `No leaderboard rows for the ${selectedHemisphere} hemisphere.`;
    }

    if (activeTab === 'pundit') {
      return 'No pundits found for this tournament yet.';
    }

    if (activeTab === 'pool') {
      return 'No pool members have leaderboard rows yet.';
    }

    return 'No leaderboard rows available yet.';
  }, [activeTab, selectedCountryCode, selectedHemisphere]);

  return (
    <>
      <Header />
      <main className="max-w-7xl mx-auto p-8">
        <div className="mb-4">
          <Link href={`/pools/${poolId}`} className="text-blue-600 dark:text-blue-400 hover:underline">
            ← Back to {poolName || 'Pool'}
          </Link>
        </div>

        <h1 className="text-3xl font-bold mb-2">Leaderboard</h1>
        {tournamentId && <p className="text-gray-600 dark:text-gray-400 mb-6">Tournament: {tournamentId}</p>}

        {tabs.length > 0 && (
          <div className="flex gap-2 mb-6 flex-wrap" role="tablist" aria-label="Leaderboard filters">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                role="tab"
                aria-selected={activeTab === tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-2 rounded-lg border transition-colors ${
                  activeTab === tab.id
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-700'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        )}

        {activeTab === 'country' && (
          <div className="mb-4">
            <label htmlFor="country-filter" className="block text-sm font-medium mb-2">
              Country code
            </label>
            <input
              id="country-filter"
              value={selectedCountryCode}
              onChange={(e) => setSelectedCountryCode(e.target.value.trim().toUpperCase())}
              placeholder="e.g. JP"
              maxLength={2}
              className="w-24 px-3 py-2 border rounded-lg bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-700"
            />
          </div>
        )}

        {activeTab === 'hemisphere' && (
          <div className="mb-4">
            <label htmlFor="hemisphere-filter" className="block text-sm font-medium mb-2">
              Hemisphere
            </label>
            <select
              id="hemisphere-filter"
              value={selectedHemisphere}
              onChange={(e) => setSelectedHemisphere(e.target.value as 'north' | 'south')}
              className="px-3 py-2 border rounded-lg bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-700"
            >
              <option value="north">North</option>
              <option value="south">South</option>
            </select>
          </div>
        )}

        {loadingData ? (
          <p>Loading leaderboard…</p>
        ) : error ? (
          <p className="text-red-600 dark:text-red-400">{error}</p>
        ) : entries.length === 0 ? (
          <div
            data-testid="leaderboard-empty"
            className="border border-dashed border-gray-300 dark:border-gray-700 rounded-lg p-8 text-center text-gray-600 dark:text-gray-300"
          >
            {emptyMessage}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-gray-300 dark:border-gray-700">
                  <th className="text-left py-2">Rank</th>
                  <th className="text-left py-2">Player</th>
                  <th className="text-right py-2">Points</th>
                  <th className="text-right py-2">Winners</th>
                  <th className="text-right py-2">Err (correct)</th>
                  <th className="text-right py-2">Exact</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry) => (
                  <tr
                    key={entry.userId}
                    data-testid={`leaderboard-row-${entry.userId}`}
                    className="border-b border-gray-200 dark:border-gray-800"
                  >
                    <td className="py-2">{entry.rank}</td>
                    <td className="py-2">{entry.displayName}</td>
                    <td className="py-2 text-right">{entry.totalPoints}</td>
                    <td className="py-2 text-right">{entry.correctWinners}</td>
                    <td className="py-2 text-right">{entry.sumErrOnCorrectWinners}</td>
                    <td className="py-2 text-right">{entry.exactScores}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </>
  );
}
