'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter, useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { getPool, getMatchesForRound } from '@/lib/pools';
import { Pool, Match } from '@/lib/types';
import Header from '@/components/Header';
import MatchCard from '@/components/MatchCard';

interface MatchWithId {
  id: string;
  match: Match;
}

export default function RoundPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const poolId = params?.poolId as string;
  const round = parseInt(params?.round as string, 10);

  const [pool, setPool] = useState<Pool | null>(null);
  const [matches, setMatches] = useState<MatchWithId[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!loading && !user) {
      router.push('/');
      return;
    }

    if (user && poolId && round) {
      loadRoundData();
    }
  }, [user, loading, poolId, round, router]);

  const loadRoundData = async () => {
    try {
      setLoadingData(true);
      const poolData = await getPool(poolId);

      if (!poolData) {
        setError('Pool not found');
        setLoadingData(false);
        return;
      }

      setPool(poolData);

      // Load matches for this round
      const matchesData = await getMatchesForRound(poolData.seasonId, round);
      
      // Sort by kickoff time
      matchesData.sort((a, b) => {
        const timeA = a.match.kickoffAt.toDate ? a.match.kickoffAt.toDate() : new Date(a.match.kickoffAt);
        const timeB = b.match.kickoffAt.toDate ? b.match.kickoffAt.toDate() : new Date(b.match.kickoffAt);
        return timeA.getTime() - timeB.getTime();
      });

      setMatches(matchesData);
    } catch (error) {
      console.error('Error loading round:', error);
      setError('Failed to load round data');
    } finally {
      setLoadingData(false);
    }
  };

  if (loading || loadingData) {
    return (
      <>
        <Header />
        <main className="max-w-7xl mx-auto p-8">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-48 mb-8"></div>
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-96 bg-gray-200 dark:bg-gray-700 rounded-lg"></div>
              ))}
            </div>
          </div>
        </main>
      </>
    );
  }

  if (error || !pool) {
    return (
      <>
        <Header />
        <main className="max-w-7xl mx-auto p-8">
          <div className="text-center py-16">
            <p className="text-xl text-red-600 dark:text-red-400 mb-6">
              {error || 'Pool not found'}
            </p>
            <button
              onClick={() => router.push('/pools')}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
            >
              Back to Pools
            </button>
          </div>
        </main>
      </>
    );
  }

  return (
    <>
      <Header />
      <main className="max-w-7xl mx-auto p-8">
        <button
          onClick={() => router.push(`/pools/${poolId}`)}
          className="text-blue-600 dark:text-blue-400 hover:underline mb-6"
        >
          ← Back to {pool.name}
        </button>

        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Round {round}</h1>
          <p className="text-gray-600 dark:text-gray-400">
            {pool.name} • {pool.seasonId}
          </p>
        </div>

        {/* Round Navigation */}
        <div className="flex gap-2 mb-8 overflow-x-auto">
          {[1, 2, 3, 4, 5].map((r) => (
            <button
              key={r}
              onClick={() => router.push(`/pools/${poolId}/round/${r}`)}
              className={`px-4 py-2 rounded-lg font-medium whitespace-nowrap transition-colors ${
                r === round
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600'
              }`}
            >
              Round {r}
            </button>
          ))}
        </div>

        {/* Matches */}
        {matches.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-xl text-gray-500 dark:text-gray-400 mb-6">
              No matches found for Round {round}
            </p>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              Fixtures may not be seeded yet.
            </p>
            <a
              href="/api/seed"
              target="_blank"
              rel="noopener noreferrer"
              className="px-6 py-3 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition-colors inline-block"
            >
              Seed Fixtures
            </a>
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {matches.map(({ id, match }) => (
              <MatchCard key={id} matchId={id} match={match} />
            ))}
          </div>
        )}

        {/* Info Banner */}
        {matches.length > 0 && (
          <div className="mt-8 p-4 bg-yellow-50 dark:bg-yellow-900/30 rounded-lg">
            <p className="text-sm text-yellow-800 dark:text-yellow-200">
              <strong>Note:</strong> Picks are not saved yet. Autosave functionality will be added in Milestone 3.
            </p>
          </div>
        )}
      </main>
    </>
  );
}
