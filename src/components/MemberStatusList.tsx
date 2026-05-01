'use client';

import { TEAM_NAMES } from '@/lib/fixtures';
import { Match, PoolMember, PickStatus, PoolMemberPredictionView } from '@/lib/types';
import PickStatusIndicator from './PickStatusIndicator';

interface MemberStatusListProps {
  members: Array<{ id: string; member: PoolMember }>;
  statuses: Map<string, PickStatus>;
  createdBy?: string; // Optional pool creator userId
  match?: Match;
  predictions?: PoolMemberPredictionView[];
}

/**
 * Display list of pool members with their pick status for a match
 * Shows who has picked, locked, or not picked yet
 * Reveals pick details only when the server-side visibility response says they are visible.
 */
export default function MemberStatusList({
  members,
  statuses,
  createdBy,
  match,
  predictions = [],
}: MemberStatusListProps) {
  const predictionsByUser = new Map(predictions.map((prediction) => [prediction.userId, prediction]));

  // Sort members: creator first, then alphabetically
  const sortedMembers = [...members].sort((a, b) => {
    const isCreatorA = createdBy && a.id === createdBy;
    const isCreatorB = createdBy && b.id === createdBy;
    if (isCreatorA && !isCreatorB) return -1;
    if (!isCreatorA && isCreatorB) return 1;
    return a.member.displayName.localeCompare(b.member.displayName);
  });

  const statusLabel = (status?: PickStatus | null): string => {
    if (status?.lockedAt) return 'Locked';
    if (status?.isComplete) return 'Picked';
    return 'No pick';
  };

  const formatPrediction = (predictionView?: PoolMemberPredictionView): string => {
    if (!predictionView || predictionView.visibility === 'no-pick') {
      return 'No prediction';
    }

    if (predictionView.visibility === 'hidden' || !predictionView.prediction) {
      return 'Prediction hidden';
    }

    const { pickedWinnerTeamId, pickedMargin } = predictionView.prediction;
    if (!pickedWinnerTeamId || pickedMargin == null) {
      return 'Prediction unavailable';
    }

    return `Prediction: ${TEAM_NAMES[pickedWinnerTeamId]} by ${pickedMargin}`;
  };

  const formatFinalScore = (predictionView?: PoolMemberPredictionView): string | null => {
    const prediction = predictionView?.prediction;
    if (match?.status !== 'final' || !prediction) {
      return null;
    }

    const points = prediction.totalPoints ?? 'Pending';
    const err = prediction.err ?? 'Pending';
    const winner = prediction.winnerCorrect == null
      ? 'Pending'
      : prediction.winnerCorrect
        ? 'Yes'
        : 'No';

    return `Points ${points} · Margin error ${err} · Winner correct ${winner}`;
  };

  return (
    <div className="space-y-2">
      {match?.status === 'final' && match.homeScore != null && match.awayScore != null && (
        <div
          data-testid="member-status-final-result"
          className="rounded bg-emerald-50 dark:bg-emerald-950/20 px-3 py-2 text-sm text-emerald-800 dark:text-emerald-200"
        >
          Actual result: {TEAM_NAMES[match.homeTeamId]} {match.homeScore}–{match.awayScore} {TEAM_NAMES[match.awayTeamId]}
        </div>
      )}

      {sortedMembers.map(({ id, member }) => {
        const status = statuses.get(id);
        const isCreator = createdBy && id === createdBy;
        const predictionView = predictionsByUser.get(id);
        const finalScore = formatFinalScore(predictionView);

        return (
          <div
            key={id}
            data-testid={`member-prediction-${id}`}
            className="flex flex-col gap-2 p-2 rounded bg-gray-50 dark:bg-gray-800 sm:flex-row sm:items-start sm:justify-between"
          >
            <div className="flex items-center gap-2">
              {/* Avatar */}
              {member.photoURL ? (
                <img
                  src={member.photoURL}
                  alt={member.displayName}
                  className="w-6 h-6 rounded-full"
                />
              ) : (
                <div className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-bold">
                  {member.displayName[0].toUpperCase()}
                </div>
              )}

              {/* Name */}
              <span className="text-sm font-medium">
                {member.displayName}
                {isCreator && ' 👑'}
              </span>
            </div>

            <div className="flex flex-col items-start gap-1 text-sm sm:items-end">
              <div className="flex items-center gap-2">
                <span className="text-gray-600 dark:text-gray-300">{statusLabel(status)}</span>
                <PickStatusIndicator status={status} size="sm" />
              </div>

              <div
                data-testid={`prediction-detail-${id}`}
                className={predictionView?.visibility === 'hidden'
                  ? 'text-gray-500 dark:text-gray-400'
                  : 'font-medium text-gray-900 dark:text-gray-100'}
              >
                {formatPrediction(predictionView)}
              </div>

              {finalScore && (
                <div
                  data-testid={`prediction-score-${id}`}
                  className="text-xs text-gray-600 dark:text-gray-300"
                >
                  {finalScore}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
