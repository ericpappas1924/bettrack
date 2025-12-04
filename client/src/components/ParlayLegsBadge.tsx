/**
 * Component to display parlay/teaser leg status
 * Shows progress and individual leg status
 */

import { Badge } from './ui/badge';

interface ParlayLegsBadgeProps {
  notes: string | null;
  betType: string;
}

export function ParlayLegsBadge({ notes, betType }: ParlayLegsBadgeProps) {
  if (!notes || (betType !== 'Parlay' && betType !== 'Teaser')) {
    return null;
  }

  // Extract legs from notes
  const legs = notes
    .split('\n')
    .filter(line => 
      line.trim() && 
      !line.startsWith('Category:') && 
      !line.startsWith('League:') &&
      !line.startsWith('Game ID:') &&
      !line.startsWith('Auto-settled:')
    );

  if (legs.length === 0) return null;

  // Count leg statuses
  const wonLegs = legs.filter(leg => leg.includes('[Won]')).length;
  const lostLegs = legs.filter(leg => leg.includes('[Lost]')).length;
  const pendingLegs = legs.filter(leg => leg.includes('[Pending]')).length;
  const totalLegs = legs.length;

  const completeLegs = wonLegs + lostLegs;
  const allComplete = completeLegs === totalLegs;

  // Determine overall status
  let statusColor = 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200';
  let statusText = `${completeLegs}/${totalLegs} Complete`;

  if (lostLegs > 0) {
    statusColor = 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
    statusText = `Lost (${lostLegs}/${totalLegs} legs lost)`;
  } else if (allComplete && wonLegs === totalLegs) {
    statusColor = 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
    statusText = `All ${totalLegs} legs won!`;
  } else if (wonLegs > 0) {
    statusColor = 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
    statusText = `${wonLegs}/${totalLegs} legs won`;
  }

  return (
    <div className="space-y-2">
      {/* Summary Badge */}
      <Badge className={statusColor}>
        {statusText}
      </Badge>

      {/* Leg Details */}
      <div className="space-y-1 text-sm">
        {legs.map((leg, i) => {
          const hasWon = leg.includes('[Won]');
          const hasLost = leg.includes('[Lost]');
          const hasPending = leg.includes('[Pending]');
          
          let statusIcon = '⏳';
          let statusClass = 'text-gray-600 dark:text-gray-400';
          
          if (hasWon) {
            statusIcon = '✅';
            statusClass = 'text-green-600 dark:text-green-400';
          } else if (hasLost) {
            statusIcon = '❌';
            statusClass = 'text-red-600 dark:text-red-400';
          }

          // Extract just the bet details (remove date/sport prefix for display)
          const betDetailsMatch = leg.match(/\[NFL\]\s*(.+)/);
          const betDetails = betDetailsMatch ? betDetailsMatch[1] : leg;
          
          // Remove status tags from display (already shown with icon)
          const cleanDetails = betDetails
            .replace(/\[Won\]/g, '')
            .replace(/\[Lost\]/g, '')
            .replace(/\[Pending\]/g, '')
            .replace(/\(Score:\s*[\d-]+\)/g, '')
            .trim();

          return (
            <div 
              key={i} 
              className={`flex items-start gap-2 ${statusClass}`}
            >
              <span className="text-base">{statusIcon}</span>
              <span className="flex-1 font-mono text-xs">
                {cleanDetails}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

