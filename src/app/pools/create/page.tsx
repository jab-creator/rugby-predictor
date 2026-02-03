'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect, useState, FormEvent } from 'react';
import { createPool } from '@/lib/pools';
import Header from '@/components/Header';

// Hardcoded season options for Milestone 1
const SEASONS = [
  { id: 'six-nations-2025', name: 'Six Nations 2025' },
  { id: 'six-nations-2026', name: 'Six Nations 2026' },
];

export default function CreatePoolPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [poolName, setPoolName] = useState('');
  const [seasonId, setSeasonId] = useState(SEASONS[0].id);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!loading && !user) {
      router.push('/');
    }
  }, [user, loading, router]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    
    if (!user) return;
    if (!poolName.trim()) {
      setError('Pool name is required');
      return;
    }

    try {
      setCreating(true);
      setError('');
      
      const poolId = await createPool(
        user.uid,
        user.displayName || 'Anonymous',
        poolName.trim(),
        seasonId,
        user.photoURL || undefined
      );
      
      router.push(`/pools/${poolId}`);
    } catch (error: any) {
      console.error('Error creating pool:', error);
      const errorMessage = error?.message || error?.toString() || 'Unknown error';
      setError(`Failed to create pool: ${errorMessage}`);
      setCreating(false);
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
        
        <h1 className="text-3xl font-bold mb-8">Create a New Pool</h1>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="poolName" className="block text-sm font-medium mb-2">
              Pool Name *
            </label>
            <input
              type="text"
              id="poolName"
              value={poolName}
              onChange={(e) => setPoolName(e.target.value)}
              placeholder="e.g., Friends & Family Pool"
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-800"
              disabled={creating}
              required
            />
          </div>

          <div>
            <label htmlFor="seasonId" className="block text-sm font-medium mb-2">
              Season *
            </label>
            <select
              id="seasonId"
              value={seasonId}
              onChange={(e) => setSeasonId(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-800"
              disabled={creating}
            >
              {SEASONS.map(season => (
                <option key={season.id} value={season.id}>
                  {season.name}
                </option>
              ))}
            </select>
          </div>

          {error && (
            <div className="p-4 bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-200 rounded-lg">
              {error}
            </div>
          )}

          <div className="flex gap-4">
            <button
              type="submit"
              disabled={creating}
              className="flex-1 px-6 py-3 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
            >
              {creating ? 'Creating...' : 'Create Pool'}
            </button>
            <button
              type="button"
              onClick={() => router.back()}
              disabled={creating}
              className="px-6 py-3 border-2 border-gray-300 dark:border-gray-600 rounded-lg font-medium hover:border-gray-400 dark:hover:border-gray-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>

        <div className="mt-8 p-4 bg-blue-50 dark:bg-blue-900 rounded-lg">
          <p className="text-sm text-blue-800 dark:text-blue-200">
            <strong>Note:</strong> After creating your pool, you'll receive a unique join code that you can share with others to invite them.
          </p>
        </div>
      </main>
    </>
  );
}
