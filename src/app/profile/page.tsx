'use client';

import Header from '@/components/Header';
import { useAuth } from '@/contexts/AuthContext';
import { getUserProfile, isValidCountryCode, normalizeCountryCode, saveUserProfileAttributes } from '@/lib/users';
import { useRouter } from 'next/navigation';
import { type FormEvent, useEffect, useMemo, useState } from 'react';

export default function ProfilePage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [countryCode, setCountryCode] = useState('');
  const [isPundit, setIsPundit] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      router.push('/');
      return;
    }

    if (!user) {
      return;
    }

    void loadProfile(user.uid);
  }, [loading, router, user]);

  const normalizedCountryCode = useMemo(() => normalizeCountryCode(countryCode), [countryCode]);
  const countryCodeError = countryCode.trim() !== '' && !isValidCountryCode(normalizedCountryCode)
    ? 'Use a two-letter country code like CA, GB, or NZ.'
    : null;

  async function loadProfile(userId: string) {
    try {
      setLoadingProfile(true);
      const profile = await getUserProfile(userId);
      setCountryCode(profile?.countryCode ?? '');
      setIsPundit(profile?.isPundit ?? false);
    } catch (loadError) {
      console.error('Error loading profile:', loadError);
      setError('Unable to load your profile right now.');
    } finally {
      setLoadingProfile(false);
    }
  }

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!user) {
      return;
    }

    if (countryCodeError) {
      setError(countryCodeError);
      setSuccess(null);
      return;
    }

    try {
      setIsSaving(true);
      setError(null);
      setSuccess(null);

      await saveUserProfileAttributes(user.uid, {
        countryCode: normalizedCountryCode === '' ? null : normalizedCountryCode,
      });

      setCountryCode(normalizedCountryCode);
      setSuccess('Profile saved. Tournament leaderboards will resolve region groupings from your country code and tournament rules.');
    } catch (saveError) {
      console.error('Error saving profile:', saveError);
      setError(saveError instanceof Error ? saveError.message : 'Could not save profile.');
    } finally {
      setIsSaving(false);
    }
  }

  if (loading || loadingProfile) {
    return (
      <>
        <Header />
        <main className="max-w-3xl mx-auto p-8">
          <div className="animate-pulse space-y-4">
            <div className="h-8 w-40 rounded bg-gray-200 dark:bg-gray-700"></div>
            <div className="h-48 rounded-xl bg-gray-200 dark:bg-gray-700"></div>
          </div>
        </main>
      </>
    );
  }

  return (
    <>
      <Header />
      <main className="max-w-3xl mx-auto p-8 space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Profile</h1>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
            Your country powers tournament-wide leaderboard filters. Hemisphere grouping is resolved per tournament so competitions can classify invite teams differently.
          </p>
        </div>

        <section className="rounded-xl border border-gray-200 dark:border-gray-800 p-6 space-y-3 bg-white dark:bg-gray-900">
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400">Signed in as</p>
            <p className="text-lg font-semibold">{user?.displayName ?? user?.email ?? user?.uid}</p>
            {user?.email && (
              <p className="text-sm text-gray-600 dark:text-gray-400">{user.email}</p>
            )}
          </div>
          <div className="inline-flex items-center rounded-full bg-gray-100 px-3 py-1 text-sm font-medium text-gray-700 dark:bg-gray-800 dark:text-gray-200">
            {isPundit ? 'Pundit account' : 'Standard account'}
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Pundit status is managed separately and cannot be changed from your profile.
          </p>
        </section>

        <form onSubmit={handleSave} className="rounded-xl border border-gray-200 dark:border-gray-800 p-6 space-y-5 bg-white dark:bg-gray-900">
          <div>
            <label htmlFor="countryCode" className="block text-sm font-medium mb-2">
              Country code
            </label>
            <input
              id="countryCode"
              type="text"
              value={countryCode}
              onChange={(event) => setCountryCode(normalizeCountryCode(event.target.value).slice(0, 2))}
              placeholder="CA"
              maxLength={2}
              className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-transparent px-3 py-2 outline-none focus:border-blue-500"
            />
            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
              Optional. Use a two-letter code like CA, GB, JP, or NZ.
            </p>
            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
              Hemisphere leaderboard placement is derived from this country code plus tournament-specific overrides.
            </p>
            {countryCodeError && (
              <p className="mt-2 text-sm text-red-600 dark:text-red-400">{countryCodeError}</p>
            )}
          </div>

          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
              {error}
            </div>
          )}

          {success && (
            <div className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700 dark:border-green-900 dark:bg-green-950 dark:text-green-300">
              {success}
            </div>
          )}

          <div className="flex items-center justify-between gap-4">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Leaving the field blank removes the stored country for future leaderboard grouping.
            </p>
            <button
              type="submit"
              disabled={isSaving}
              className="rounded-lg bg-blue-600 px-5 py-2 font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSaving ? 'Saving…' : 'Save profile'}
            </button>
          </div>
        </form>
      </main>
    </>
  );
}
