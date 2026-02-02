'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import Header from '@/components/Header';

export default function Home() {
  const { user, loading } = useAuth();
  const router = useRouter();

  return (
    <>
      <Header />
      <main className="flex min-h-screen flex-col items-center justify-center p-24">
        <div className="text-center max-w-2xl">
          <h1 className="text-5xl font-bold mb-4">
            🏉 Six Nations Predictor
          </h1>
          <p className="text-xl text-gray-600 dark:text-gray-400 mb-8">
            Create pools, make predictions, compete with friends
          </p>
          
          {!loading && user && (
            <div className="flex gap-4 justify-center mt-8">
              <button
                onClick={() => router.push('/pools')}
                className="px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
              >
                View My Pools
              </button>
              <button
                onClick={() => router.push('/pools/create')}
                className="px-6 py-3 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition-colors"
              >
                Create Pool
              </button>
              <button
                onClick={() => router.push('/pools/join')}
                className="px-6 py-3 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-700 transition-colors"
              >
                Join Pool
              </button>
            </div>
          )}
          
          {!loading && !user && (
            <p className="text-gray-500 dark:text-gray-400 mt-8">
              Sign in to get started
            </p>
          )}
        </div>
      </main>
    </>
  )
}
