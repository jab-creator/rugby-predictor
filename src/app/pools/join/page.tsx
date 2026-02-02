'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect, useState, FormEvent } from 'react';
import { findPoolByJoinCode, joinPool } from '@/lib/pools';
import Header from '@/components/Header';

export default function JoinPoolPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [joinCode, setJoinCode] = useState('');
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!loading && !user) {
      router.push('/');
    }
  }, [user, loading, router]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    
    if (!user) return;
    if (!joinCode.trim()) {
      setError('Join code is required');
      return;
    }

    try {
      setJoining(true);
      setError('');
      
      const poolData = await findPoolByJoinCode(joinCode.trim());
      
      if (!poolData) {
        setError('Pool not found. Please check the join code and try again.');
        setJoining(false);
        return;
      }
      
      await joinPool(
        poolData.id,
        user.uid,
        user.displayName || 'Anonymous',
        user.photoURL || undefined
      );
      
      router.push(`/pools/${poolData.id}`);
    } catch (error: any) {
      console.error('Error joining pool:', error);
      setError(error.message || 'Failed to join pool. Please try again.');
      setJoining(false);
    }
  };

  if (loading) {
    return (
      <>
        <Header />
        <main className="max-w-2xl mx-auto p-8">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-48 mb-8"></div>
            <div className="h-64 bg-gray-200 dark:bg-gray-700 rounded-lg"></div>
          </div>
        </main>
      </>
    );
  }

  return (
    <>
      <Header />
      <main className="max-w-2xl mx-auto p-8">
        <button
          onClick={() => router.back()}
          className="text-blue-600 dark:text-blue-400 hover:underline mb-6"
        >
          ← Back
        </button>
        
        <h1 className="text-3xl font-bold mb-8">Join a Pool</h1>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="joinCode" className="block text-sm font-medium mb-2">
              Join Code *
            </label>
            <input
              type="text"
              id="joinCode"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              placeholder="e.g., ABC123"
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-800 font-mono text-lg tracking-wider"
              disabled={joining}
              maxLength={6}
              required
            />
            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
              Enter the 6-character code shared by the pool creator
            </p>
          </div>

          {error && (
            <div className="p-4 bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-200 rounded-lg">
              {error}
            </div>
          )}

          <div className="flex gap-4">
            <button
              type="submit"
              disabled={joining}
              className="flex-1 px-6 py-3 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
            >
              {joining ? 'Joining...' : 'Join Pool'}
            </button>
            <button
              type="button"
              onClick={() => router.back()}
              disabled={joining}
              className="px-6 py-3 border-2 border-gray-300 dark:border-gray-600 rounded-lg font-medium hover:border-gray-400 dark:hover:border-gray-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>

        <div className="mt-8 p-4 bg-blue-50 dark:bg-blue-900 rounded-lg">
          <p className="text-sm text-blue-800 dark:text-blue-200">
            <strong>Don't have a code?</strong> Ask a friend who created a pool to share their join code, or{' '}
            <button
              onClick={() => router.push('/pools/create')}
              className="underline hover:no-underline"
            >
              create your own pool
            </button>
            .
          </p>
        </div>
      </main>
    </>
  );
}
