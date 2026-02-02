'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter, useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { getPool, getPoolMembers } from '@/lib/pools';
import { Pool, PoolMember } from '@/lib/types';
import Header from '@/components/Header';

interface MemberWithId {
  id: string;
  member: PoolMember;
}

export default function PoolDetailPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const poolId = params?.poolId as string;

  const [pool, setPool] = useState<Pool | null>(null);
  const [members, setMembers] = useState<MemberWithId[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      router.push('/');
      return;
    }

    if (user && poolId) {
      loadPoolData();
    }
  }, [user, loading, poolId, router]);

  const loadPoolData = async () => {
    try {
      setLoadingData(true);
      const [poolData, membersData] = await Promise.all([
        getPool(poolId),
        getPoolMembers(poolId),
      ]);

      if (!poolData) {
        setError('Pool not found');
        setLoadingData(false);
        return;
      }

      setPool(poolData);
      setMembers(membersData);
    } catch (error) {
      console.error('Error loading pool:', error);
      setError('Failed to load pool data');
    } finally {
      setLoadingData(false);
    }
  };

  const copyJoinCode = () => {
    if (pool) {
      navigator.clipboard.writeText(pool.joinCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (loading || loadingData) {
    return (
      <>
        <Header />
        <main className="max-w-7xl mx-auto p-8">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-48 mb-8"></div>
            <div className="h-64 bg-gray-200 dark:bg-gray-700 rounded-lg"></div>
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
          onClick={() => router.push('/pools')}
          className="text-blue-600 dark:text-blue-400 hover:underline mb-6"
        >
          ← Back to Pools
        </button>

        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-4">{pool.name}</h1>
          
          <div className="flex flex-wrap gap-4 items-center">
            <div className="flex items-center gap-2">
              <span className="text-gray-600 dark:text-gray-400">Join Code:</span>
              <span className="font-mono text-xl font-bold text-blue-600 dark:text-blue-400">
                {pool.joinCode}
              </span>
              <button
                onClick={copyJoinCode}
                className="px-3 py-1 text-sm bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 rounded transition-colors"
              >
                {copied ? '✓ Copied' : 'Copy'}
              </button>
            </div>
            
            <div className="text-gray-600 dark:text-gray-400">
              Season: <span className="font-medium">{pool.seasonId}</span>
            </div>
            
            <div className="text-gray-600 dark:text-gray-400">
              Members: <span className="font-medium">{pool.membersCount}</span>
            </div>
          </div>
        </div>

        <div className="border-t border-gray-200 dark:border-gray-700 pt-8">
          <h2 className="text-2xl font-bold mb-6">Members</h2>
          
          {members.length === 0 ? (
            <p className="text-gray-500 dark:text-gray-400">No members yet</p>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {members.map(({ id, member }) => (
                <div
                  key={id}
                  className="flex items-center gap-3 p-4 border border-gray-200 dark:border-gray-700 rounded-lg"
                >
                  {member.photoURL ? (
                    <img
                      src={member.photoURL}
                      alt={member.displayName}
                      className="w-12 h-12 rounded-full"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-gray-300 dark:bg-gray-600 flex items-center justify-center text-xl font-bold">
                      {member.displayName.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div>
                    <p className="font-medium">{member.displayName}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {id === pool.createdBy && '👑 Creator'}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="border-t border-gray-200 dark:border-gray-700 pt-8 mt-8">
          <h2 className="text-2xl font-bold mb-6">Rounds</h2>
          
          <div className="grid gap-4 md:grid-cols-5">
            {[1, 2, 3, 4, 5].map((round) => (
              <button
                key={round}
                onClick={() => router.push(`/pools/${poolId}/round/${round}`)}
                className="p-6 border-2 border-gray-200 dark:border-gray-700 rounded-lg hover:border-blue-500 dark:hover:border-blue-400 transition-colors text-center"
              >
                <div className="text-sm text-gray-500 dark:text-gray-400 mb-1">Round</div>
                <div className="text-3xl font-bold">{round}</div>
              </button>
            ))}
          </div>
        </div>

        <div className="mt-8 p-4 bg-blue-50 dark:bg-blue-900 rounded-lg">
          <p className="text-sm text-blue-800 dark:text-blue-200">
            <strong>Share this pool:</strong> Give your friends the join code <strong className="font-mono">{pool.joinCode}</strong> so they can join and start making predictions!
          </p>
        </div>
      </main>
    </>
  );
}
