'use client';

import { useState, useEffect, useRef } from 'react';
import { Timestamp } from 'firebase/firestore';
import { Match, TeamId } from '@/lib/types';
import { TEAM_NAMES, TEAM_FLAGS } from '@/lib/fixtures';
import { savePick, getUserPick } from '@/lib/picks';
import { useAuth } from '@/contexts/AuthContext';

interface MatchCardProps {
  match: Match;
  matchId: string;
  poolId: string;
  tournamentId: string;
  lockedAt: Timestamp | null;
  onLock: () => Promise<void>;
}

export default function MatchCard({ match, matchId, poolId, tournamentId, lockedAt, onLock }: MatchCardProps) {
  const { user } = useAuth();
  const [selectedWinner, setSelectedWinner] = useState<TeamId | null>(null);
  const [margin, setMargin] = useState<string>('');
  const [saving, setSaving] = useState(false);
  const [locking, setLocking] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [lockError, setLockError] = useState<string>('');
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const isLocked = lockedAt !== null;

  // Load existing pick on mount
  useEffect(() => {
    if (!user || !poolId || !matchId) return;

    const loadPick = async () => {
      try {
        const pick = await getUserPick(poolId, matchId, user.uid);
        if (pick && pick.pickedWinnerTeamId && pick.pickedMargin) {
          setSelectedWinner(pick.pickedWinnerTeamId);
          setMargin(pick.pickedMargin.toString());
        }
      } catch (error) {
        console.error('Error loading pick:', error);
      }
    };

    loadPick();
  }, [user, poolId, matchId]);

  // Autosave when pick changes (debounced) — disabled when locked
  useEffect(() => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    if (!user || !selectedWinner || !margin || margin === '' || isLocked) {
      return;
    }

    const marginNum = parseInt(margin, 10);
    if (marginNum < 1 || marginNum > 99) {
      return;
    }

    saveTimeoutRef.current = setTimeout(async () => {
      try {
        setSaving(true);
        await savePick(poolId, matchId, user.uid, tournamentId, selectedWinner, marginNum, match.kickoffAt);
        setLastSaved(new Date());
      } catch (error) {
        console.error('Error saving pick:', error);
      } finally {
        setSaving(false);
      }
    }, 500);

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [user, poolId, matchId, tournamentId, selectedWinner, margin, isLocked, match.kickoffAt]);

  const formatKickoffTime = (kickoffAt: Timestamp) => {
    const date = kickoffAt.toDate ? kickoffAt.toDate() : new Date(kickoffAt as any);
    return new Intl.DateTimeFormat('en-GB', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  };

  const handleWinnerClick = (team: TeamId) => {
    if (isLocked) return;
    setSelectedWinner(team === selectedWinner ? null : team);
  };

  const handleMarginChange = (value: string) => {
    if (isLocked) return;
    const num = parseInt(value, 10);
    if (value === '' || (num >= 1 && num <= 99)) {
      setMargin(value);
    }
  };

  const handleLock = async () => {
    if (locking || isLocked) return;
    setLockError('');
    setLocking(true);
    try {
      await onLock();
    } catch (err: any) {
      setLockError(err?.message ?? 'Failed to lock pick');
    } finally {
      setLocking(false);
    }
  };

  const isPickComplete = selectedWinner !== null && margin !== '' && parseInt(margin, 10) >= 1;

  const lockedBorderClass = isLocked
    ? 'border-blue-400 dark:border-blue-500 bg-blue-50/30 dark:bg-blue-900/10'
    : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600';

  return (
    <div className={`border-2 rounded-lg p-6 transition-colors ${lockedBorderClass}`}>
      {/* Kickoff Time */}
      <div className="text-center text-sm text-gray-500 dark:text-gray-400 mb-4">
        {formatKickoffTime(match.kickoffAt)}
      </div>

      {/* Locked banner */}
      {isLocked && (
        <div className="mb-4 px-3 py-2 bg-blue-100 dark:bg-blue-900/40 rounded-lg text-center">
          <span className="text-sm font-semibold text-blue-700 dark:text-blue-300">
            🔒 Pick locked
          </span>
        </div>
      )}

      {/* Teams */}
      <div className="space-y-3 mb-6">
        <button
          onClick={() => handleWinnerClick(match.homeTeamId)}
          disabled={isLocked}
          className={`w-full p-4 rounded-lg border-2 transition-all ${
            selectedWinner === match.homeTeamId
              ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30'
              : 'border-gray-200 dark:border-gray-700'
          } ${isLocked ? 'cursor-default opacity-80' : 'hover:border-gray-300 dark:hover:border-gray-600'}`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-2xl">{TEAM_FLAGS[match.homeTeamId]}</span>
              <span className="font-bold text-lg">{TEAM_NAMES[match.homeTeamId]}</span>
            </div>
            {selectedWinner === match.homeTeamId && (
              <span className="text-blue-600 dark:text-blue-400 font-bold">✓</span>
            )}
          </div>
        </button>

        <button
          onClick={() => handleWinnerClick(match.awayTeamId)}
          disabled={isLocked}
          className={`w-full p-4 rounded-lg border-2 transition-all ${
            selectedWinner === match.awayTeamId
              ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30'
              : 'border-gray-200 dark:border-gray-700'
          } ${isLocked ? 'cursor-default opacity-80' : 'hover:border-gray-300 dark:hover:border-gray-600'}`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-2xl">{TEAM_FLAGS[match.awayTeamId]}</span>
              <span className="font-bold text-lg">{TEAM_NAMES[match.awayTeamId]}</span>
            </div>
            {selectedWinner === match.awayTeamId && (
              <span className="text-blue-600 dark:text-blue-400 font-bold">✓</span>
            )}
          </div>
        </button>
      </div>

      {/* Margin Input */}
      <div>
        <label htmlFor={`margin-${matchId}`} className="block text-sm font-medium mb-2">
          Winning Margin
        </label>
        <input
          type="number"
          id={`margin-${matchId}`}
          value={margin}
          onChange={(e) => handleMarginChange(e.target.value)}
          placeholder="1-99"
          min="1"
          max="99"
          disabled={isLocked}
          className={`w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-800 text-center text-lg font-bold ${
            isLocked ? 'opacity-70 cursor-default' : ''
          }`}
        />
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 text-center">
          Points margin (1-99)
        </p>
      </div>

      {/* Status / Lock area */}
      <div className="mt-4">
        {isLocked ? (
          <div className="text-center text-sm text-blue-600 dark:text-blue-400 font-medium">
            Pick is final and cannot be changed
          </div>
        ) : (
          <>
            {/* Autosave status */}
            <div className="text-center mb-3">
              {saving ? (
                <span className="text-sm text-blue-600 dark:text-blue-400 font-medium">
                  💾 Saving...
                </span>
              ) : isPickComplete && lastSaved ? (
                <span className="text-sm text-green-600 dark:text-green-400 font-medium">
                  ✓ Saved {Date.now() - lastSaved.getTime() < 3000 ? 'just now' : 'automatically'}
                </span>
              ) : isPickComplete ? (
                <span className="text-sm text-green-600 dark:text-green-400 font-medium">
                  ✓ Pick complete
                </span>
              ) : (
                <span className="text-sm text-gray-400 dark:text-gray-500">
                  Select winner and margin
                </span>
              )}
            </div>

            {/* Lock button */}
            {isPickComplete && (
              <button
                onClick={handleLock}
                disabled={locking}
                className="w-full py-2 px-4 rounded-lg font-semibold text-sm transition-colors bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-60 disabled:cursor-wait"
              >
                {locking ? 'Locking...' : '🔒 Lock pick'}
              </button>
            )}

            {lockError && (
              <p className="text-xs text-red-600 dark:text-red-400 mt-2 text-center">
                {lockError}
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
