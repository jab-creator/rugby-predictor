'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';

export default function Header() {
  const { user, loading, signInWithGoogle, signOut } = useAuth();
  const router = useRouter();

  const handleSignIn = async () => {
    try {
      await signInWithGoogle();
      router.push('/pools');
    } catch (error) {
      console.error('Sign in failed:', error);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut();
      router.push('/');
    } catch (error) {
      console.error('Sign out failed:', error);
    }
  };

  if (loading) {
    return (
      <header className="w-full p-4 border-b border-gray-200 dark:border-gray-800">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <h2 className="text-xl font-bold">🏉 Six Nations</h2>
          <div className="w-24 h-10 bg-gray-200 dark:bg-gray-700 animate-pulse rounded"></div>
        </div>
      </header>
    );
  }

  return (
    <header className="w-full p-4 border-b border-gray-200 dark:border-gray-800">
      <div className="max-w-7xl mx-auto flex justify-between items-center">
        <button 
          onClick={() => router.push('/')}
          className="text-xl font-bold hover:opacity-80 transition-opacity"
        >
          🏉 Six Nations
        </button>
        
        <div className="flex items-center gap-4">
          {user ? (
            <>
              <button
                onClick={() => router.push('/pools')}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
              >
                My Pools
              </button>
              <div className="flex items-center gap-3">
                {user.photoURL && (
                  <img 
                    src={user.photoURL} 
                    alt={user.displayName || 'User'} 
                    className="w-8 h-8 rounded-full"
                  />
                )}
                <span className="text-sm text-gray-700 dark:text-gray-300">
                  {user.displayName}
                </span>
                <button
                  onClick={handleSignOut}
                  className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors"
                >
                  Sign Out
                </button>
              </div>
            </>
          ) : (
            <button
              onClick={handleSignIn}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
            >
              Sign In with Google
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
