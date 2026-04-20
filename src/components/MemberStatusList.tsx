'use client';

import { PoolMember, PickStatus } from '@/lib/types';
import PickStatusIndicator from './PickStatusIndicator';

interface MemberStatusListProps {
  members: Array<{ id: string; member: PoolMember }>;
  statuses: Map<string, PickStatus>;
  createdBy?: string; // Optional pool creator userId
}

/**
 * Display list of pool members with their pick status for a match
 * Shows who has picked, locked, or not picked yet
 * Does NOT reveal pick details (winner/margin)
 */
export default function MemberStatusList({ members, statuses, createdBy }: MemberStatusListProps) {
  // Sort members: creator first, then alphabetically
  const sortedMembers = [...members].sort((a, b) => {
    const isCreatorA = createdBy && a.id === createdBy;
    const isCreatorB = createdBy && b.id === createdBy;
    if (isCreatorA && !isCreatorB) return -1;
    if (!isCreatorA && isCreatorB) return 1;
    return a.member.displayName.localeCompare(b.member.displayName);
  });

  return (
    <div className="space-y-2">
      {sortedMembers.map(({ id, member }) => {
        const status = statuses.get(id);
        const isCreator = createdBy && id === createdBy;

        return (
          <div
            key={id}
            className="flex items-center justify-between p-2 rounded bg-gray-50 dark:bg-gray-800"
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

            {/* Status Indicator */}
            <PickStatusIndicator status={status} size="sm" />
          </div>
        );
      })}
    </div>
  );
}
