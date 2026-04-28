'use client';

import Header from '@/components/Header';
import { useAuth } from '@/contexts/AuthContext';
import {
  backfillUserTournamentStatsProfiles,
  type BackfillUserTournamentStatsProfilesResult,
  setUserPunditStatus,
  type SetUserPunditStatusResult,
} from '@/lib/users';
import { useRouter } from 'next/navigation';
import { type FormEvent, useEffect, useState } from 'react';

export default function PunditAdminPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [isPundit, setIsPundit] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isBackfilling, setIsBackfilling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<SetUserPunditStatusResult | null>(null);
  const [backfillResult, setBackfillResult] = useState<BackfillUserTournamentStatsProfilesResult | null>(null);

  useEffect(() => {
    if (!loading && !user) {
      router.push('/');
    }
  }, [loading, router, user]);

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    try {
      setIsSaving(true);
      setError(null);
      setBackfillResult(null);
      const result = await setUserPunditStatus({
        email: email.trim(),
        isPundit,
      });
      setSuccess(result);
    } catch (saveError) {
      console.error('Error updating pundit status:', saveError);
      setSuccess(null);
      setError(saveError instanceof Error ? saveError.message : 'Could not update pundit status.');
    } finally {
      setIsSaving(false);
    }
  }

  async function handleBackfillAll() {
    try {
      setIsBackfilling(true);
      setError(null);
      setSuccess(null);
      const result = await backfillUserTournamentStatsProfiles();
      setBackfillResult(result);
    } catch (backfillError) {
      console.error('Error backfilling stats:', backfillError);
      setBackfillResult(null);
      setError(backfillError instanceof Error ? backfillError.message : 'Could not backfill stats.');
    } finally {
      setIsBackfilling(false);
    }
  }

  if (loading) {
    return (
      <>
        <Header />
        <main className="max-w-3xl mx-auto p-8">
          <div className="animate-pulse h-48 rounded-xl bg-gray-200 dark:bg-gray-700"></div>
        </main>
      </>
    );
  }

  return (
    <>
      <Header />
      <main className="max-w-3xl mx-auto p-8 space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Pundit admin</h1>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
            Hidden admin-only tooling for managing pundit flags and syncing denormalized tournament stats.
          </p>
        </div>

        <section className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
          This route is intentionally not linked in normal user navigation. Access is enforced in Cloud Functions.
        </section>

        <form onSubmit={handleSave} className="rounded-xl border border-gray-200 dark:border-gray-800 p-6 space-y-5 bg-white dark:bg-gray-900">
          <div>
            <label htmlFor="targetEmail" className="block text-sm font-medium mb-2">
              Target user email
            </label>
            <input
              id="targetEmail"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="analyst@example.com"
              required
              className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-transparent px-3 py-2 outline-none focus:border-blue-500"
            />
          </div>

          <label className="flex items-center gap-3 text-sm font-medium">
            <input
              type="checkbox"
              checked={isPundit}
              onChange={(event) => setIsPundit(event.target.checked)}
              className="h-4 w-4 rounded border-gray-300"
            />
            Flag this user as a pundit
          </label>

          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
              {error}
            </div>
          )}

          {success && (
            <div className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700 dark:border-green-900 dark:bg-green-950 dark:text-green-300">
              Updated <strong>{success.displayName}</strong> ({success.email ?? success.userId}) — pundit status is now{' '}
              <strong>{success.isPundit ? 'enabled' : 'disabled'}</strong>. Synced {success.syncedStats} stats doc(s).
            </div>
          )}

          <button
            type="submit"
            disabled={isSaving}
            className="rounded-lg bg-blue-600 px-5 py-2 font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSaving ? 'Saving…' : 'Save pundit status'}
          </button>
        </form>

        <section className="rounded-xl border border-gray-200 dark:border-gray-800 p-6 space-y-4 bg-white dark:bg-gray-900">
          <div>
            <h2 className="text-xl font-semibold">Backfill denormalized stats</h2>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
              Re-sync all existing <code>user_tournament_stats</code> documents from current user profiles. Useful after Milestone 7 rollout.
            </p>
          </div>

          {backfillResult && (
            <div className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700 dark:border-green-900 dark:bg-green-950 dark:text-green-300">
              Synced {backfillResult.syncedStats} stats doc(s) across {backfillResult.syncedUsers} user(s).
            </div>
          )}

          <button
            type="button"
            onClick={handleBackfillAll}
            disabled={isBackfilling}
            className="rounded-lg border border-gray-300 px-5 py-2 font-medium transition-colors hover:border-blue-500 hover:text-blue-600 disabled:cursor-not-allowed disabled:opacity-60 dark:border-gray-700 dark:hover:border-blue-400 dark:hover:text-blue-300"
          >
            {isBackfilling ? 'Backfilling…' : 'Backfill all user tournament stats'}
          </button>
        </section>
      </main>
    </>
  );
}
