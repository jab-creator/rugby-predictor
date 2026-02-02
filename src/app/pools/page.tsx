'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { getUserPools } from '@/lib/pools';
import { Pool, PoolMember } from '@/lib/types';
import Header from '@/components/Header';

interface UserPool {
  id: string;
  pool: Pool;
  member: PoolMember;
}

export default function PoolsPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [pools, setPools] = useState<UserPool[]>([]);
  const [loadingPools, setLoadingPools] = useState(true);

  useEffect(() => {
    if (!loading && !user) {
      router.push('/');
      return;
    }

    if (user) {
      loadPools();
    }
  }, [user, loading, router]);

  const loadPools = async () => {
    if (!user) return;
    
    try {
      setLoadingPools(true);
      const userPools = await getUserPools(user.uid);
      setPools(userPools);
    } catch (error) {
      console.error('Error loading pools:', error);
    } finally {
      setLoadingPools(false);
    }
  };

  if (loading || loadingPools) {
    return (
      <>
        <Header />
        <main className="max-w-7xl mx-auto p-8">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-48 mb-8"></div>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-40 bg-gray-200 dark:bg-gray-700 rounded-lg"></div>
              ))}
            </div>
          </div>
        </main>
      </>
    );
  }

  return (
    <>
      <Header />
      <main className="max-w-7xl mx-auto p-8">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold">My Pools</h1>
          <div className="flex gap-3">
            <button
              onClick={() => router.push('/pools/create')}
              className="px-4 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition-colors"
            >
              Create Pool
            </button>
            <button
              onClick={() => router.push('/pools/join')}
              className="px-4 py-2 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-700 transition-colors"
            >
              Join Pool
            </button>
          </div>
        </div>

        {pools.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-xl text-gray-500 dark:text-gray-400 mb-6">
              You haven't joined any pools yet
            </p>
            <div className="flex gap-4 justify-center">
              <button
                onClick={() => router.push('/pools/create')}
                className="px-6 py-3 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition-colors"
              >
                Create Your First Pool
              </button>
              <button
                onClick={() => router.push('/pools/join')}
                className="px-6 py-3 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-700 transition-colors"
              >
                Join a Pool
              </button>
            </div>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {pools.map(({ id, pool }) => (
              <button
                key={id}
                onClick={() => router.push(`/pools/${id}`)}
                className="text-left p-6 border-2 border-gray-200 dark:border-gray-700 rounded-lg hover:border-blue-500 dark:hover:border-blue-400 transition-colors"
              >
                <h3 className="text-xl font-bold mb-2">{pool.name}</h3>
                <div className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                  <p>Join Code: <span className="font-mono font-bold text-blue-600 dark:text-blue-400">{pool.joinCode}</span></p>
                  <p>Members: {pool.membersCount}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-500">Season: {pool.seasonId}</p>
                </div>
              </button>
            ))}
          </div>
        )}
      </main>
    </>
  );
}
