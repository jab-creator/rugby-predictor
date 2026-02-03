'use client';

import { useState, useEffect, useRef } from 'react';
import { Match, TeamId } from '@/lib/types';
import { TEAM_NAMES, TEAM_FLAGS } from '@/lib/fixtures';
import { savePick, getUserPick } from '@/lib/picks';
import { useAuth } from '@/contexts/AuthContext';

interface MatchCardProps {
  match: Match;
  matchId: string;
  poolId: string;
}

export default function MatchCard({ match, matchId, poolId }: MatchCardProps) {
  const { user } = useAuth();
  const [selectedWinner, setSelectedWinner] = useState<TeamId | null>(null);
  const [margin, setMargin] = useState<string>('');
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

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

  // Autosave when pick changes (debounced)
  useEffect(() => {
    // Clear existing timeout
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    // Only save if pick is complete
    if (!user || !selectedWinner || !margin || margin === '') {
      return;
    }

    const marginNum = parseInt(margin, 10);
    if (marginNum < 1 || marginNum > 99) {
      return;
    }

    // Debounce save by 500ms
    saveTimeoutRef.current = setTimeout(async () => {
      try {
        setSaving(true);
        await savePick(poolId, matchId, user.uid, selectedWinner, marginNum);
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
  }, [user, poolId, matchId, selectedWinner, margin]);

  const formatKickoffTime = (kickoffAt: any) => {
    // Convert Firestore Timestamp to Date
    const date = kickoffAt.toDate ? kickoffAt.toDate() : new Date(kickoffAt);
    
    // Format as local time
    return new Intl.DateTimeFormat('en-GB', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  };

  const handleWinnerClick = (team: TeamId) => {
    setSelectedWinner(team === selectedWinner ? null : team);
  };

  const handleMarginChange = (value: string) => {
    // Only allow numbers 1-99
    const num = parseInt(value, 10);
    if (value === '' || (num >= 1 && num <= 99)) {
      setMargin(value);
    }
  };

  const isPickComplete = selectedWinner !== null && margin !== '' && parseInt(margin, 10) >= 1;

  return (
    <div className="border-2 border-gray-200 dark:border-gray-700 rounded-lg p-6 hover:border-gray-300 dark:hover:border-gray-600 transition-colors">
      {/* Kickoff Time */}
      <div className="text-center text-sm text-gray-500 dark:text-gray-400 mb-4">
        {formatKickoffTime(match.kickoffAt)}
      </div>

      {/* Teams */}
      <div className="space-y-3 mb-6">
        {/* Home Team */}
        <button
          onClick={() => handleWinnerClick(match.homeTeamId)}
          className={`w-full p-4 rounded-lg border-2 transition-all ${
            selectedWinner === match.homeTeamId
              ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30'
              : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
          }`}
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

        {/* Away Team */}
        <button
          onClick={() => handleWinnerClick(match.awayTeamId)}
          className={`w-full p-4 rounded-lg border-2 transition-all ${
            selectedWinner === match.awayTeamId
              ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30'
              : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
          }`}
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
          className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-800 text-center text-lg font-bold"
        />
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 text-center">
          Points margin (1-99)
        </p>
      </div>

      {/* Status Indicator */}
      <div className="mt-4 text-center">
        {saving ? (
          <div className="text-sm text-blue-600 dark:text-blue-400 font-medium">
            💾 Saving...
          </div>
        ) : isPickComplete && lastSaved ? (
          <div className="text-sm text-green-600 dark:text-green-400 font-medium">
            ✓ Saved {new Date().getTime() - lastSaved.getTime() < 3000 ? 'just now' : 'automatically'}
          </div>
        ) : isPickComplete ? (
          <div className="text-sm text-green-600 dark:text-green-400 font-medium">
            ✓ Pick Complete
          </div>
        ) : (
          <div className="text-sm text-gray-400 dark:text-gray-500">
            Select winner and margin
          </div>
        )}
      </div>
    </div>
  );
}
