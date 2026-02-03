import { PickStatus } from '@/lib/types';

interface PickStatusIndicatorProps {
  status?: PickStatus | null;
  size?: 'sm' | 'md' | 'lg';
}

/**
 * Status indicator dot for pick completeness
 * 
 * States:
 * - No pick (gray): isComplete = false or status = null
 * - Picked (green): isComplete = true, lockedAt = null
 * - Locked (blue): lockedAt !== null (Milestone 4)
 */
export default function PickStatusIndicator({ status, size = 'md' }: PickStatusIndicatorProps) {
  const sizeClasses = {
    sm: 'w-2 h-2',
    md: 'w-3 h-3',
    lg: 'w-4 h-4',
  };

  // Determine status color and label
  let colorClass = 'bg-gray-300 dark:bg-gray-600'; // No pick (default)
  let label = 'No pick';
  let tooltip = 'No pick made yet';

  if (status?.lockedAt) {
    // Locked (Milestone 4)
    colorClass = 'bg-blue-500 dark:bg-blue-400';
    label = 'Locked';
    tooltip = 'Pick is locked';
  } else if (status?.isComplete) {
    // Picked
    colorClass = 'bg-green-500 dark:bg-green-400';
    label = 'Picked';
    tooltip = 'Pick complete';
  }

  return (
    <div className="inline-flex items-center gap-1.5" title={tooltip}>
      <span className={`rounded-full ${sizeClasses[size]} ${colorClass}`} />
      <span className="sr-only">{label}</span>
    </div>
  );
}

/**
 * Status legend component to explain the dots
 */
export function PickStatusLegend() {
  return (
    <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400">
      <div className="flex items-center gap-1.5">
        <span className="w-3 h-3 rounded-full bg-gray-300 dark:bg-gray-600" />
        <span>No pick</span>
      </div>
      <div className="flex items-center gap-1.5">
        <span className="w-3 h-3 rounded-full bg-green-500 dark:bg-green-400" />
        <span>Picked</span>
      </div>
      <div className="flex items-center gap-1.5">
        <span className="w-3 h-3 rounded-full bg-blue-500 dark:bg-blue-400" />
        <span>Locked</span>
      </div>
    </div>
  );
}
