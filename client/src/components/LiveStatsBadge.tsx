import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Activity, CheckCircle2, XCircle, Clock } from "lucide-react";

export interface LiveStat {
  betId: string;
  gameId: string;
  sport: string;
  betType: string; // 'Straight' | 'Spread' | 'Total' | 'Player Prop'
  
  // Game info (all bets)
  awayTeam: string;
  homeTeam: string;
  awayScore: number;
  homeScore: number;
  gameStatus: string;
  isLive: boolean;
  isComplete: boolean;
  status: 'winning' | 'losing' | 'pending';
  currentScore?: string;
  
  // Team bet specific
  betTeam?: string;
  betLine?: number;
  totalLine?: number;
  isOver?: boolean;
  
  // Player prop specific
  playerName?: string;
  statType?: string;
  targetValue?: number;
  currentValue?: number;
  progress?: number;
  
  lastUpdated: string | Date;
}

interface LiveStatsBadgeProps {
  liveStat?: LiveStat | null;
  compact?: boolean;
}

/**
 * Parse game status to extract time remaining
 * Examples: "Q3 6:07" → "Q3 6:07 left", "Final" → "Final"
 */
function parseTimeRemaining(gameStatus: string, sport: string): string {
  // Handle completed games
  if (gameStatus === 'Final' || gameStatus.includes('Final')) {
    return 'Final';
  }
  
  // NBA/NCAAB format: "Q3 6:07" or "OT 2:30"
  const nbaMatch = gameStatus.match(/(Q[1-4]|OT\d?)\s+(\d+):(\d+)/);
  if (nbaMatch) {
    const [, quarter, mins, secs] = nbaMatch;
    return `${quarter} ${mins}:${secs} left`;
  }
  
  // NFL/NCAAF format: "3rd Quarter 8:23"
  const nflMatch = gameStatus.match(/(\d+)(?:st|nd|rd|th)\s+Quarter\s+(\d+):(\d+)/i);
  if (nflMatch) {
    const [, quarter, mins, secs] = nflMatch;
    return `Q${quarter} ${mins}:${secs} left`;
  }
  
  // Halftime
  if (gameStatus.toLowerCase().includes('halftime')) {
    return 'Halftime';
  }
  
  // Default: return as-is
  return gameStatus;
}

export function LiveStatsBadge({ liveStat, compact = false }: LiveStatsBadgeProps) {
  if (!liveStat) {
    return null;
  }

  const { betType, currentValue, targetValue, isOver, progress, gameStatus, isLive, isComplete, playerName, statType, status, currentScore, awayTeam, homeTeam, awayScore, homeScore, sport } = liveStat;
  
  const timeRemaining = parseTimeRemaining(gameStatus, sport || 'NBA');
  
  // Determine if bet is hitting based on status
  const isHitting = status === 'winning';

  // Determine badge color and icon
  let icon;
  let variant: "default" | "secondary" | "destructive" | "outline" = "secondary";
  let bgColor = "";

  if (isComplete) {
    if (isHitting) {
      icon = <CheckCircle2 className="h-3 w-3" />;
      variant = "default";
      bgColor = "bg-green-600 hover:bg-green-700";
    } else {
      icon = <XCircle className="h-3 w-3" />;
      variant = "destructive";
    }
  } else if (isLive) {
    icon = <Activity className="h-3 w-3 animate-pulse" />;
    if (isHitting) {
      bgColor = "bg-green-600 hover:bg-green-700";
    } else {
      bgColor = "bg-amber-600 hover:bg-amber-700";
    }
  } else {
    icon = <Clock className="h-3 w-3" />;
    variant = "outline";
  }

  const formatStatValue = (value: number) => {
    return Number.isInteger(value) ? value.toString() : value.toFixed(1);
  };

  // Build tooltip content based on bet type
  const tooltipContent = (
    <div className="space-y-1 text-xs">
      {betType === 'Player Prop' ? (
        // Player Prop tooltip
        <>
          <p className="font-semibold">{playerName}</p>
          <p className="text-muted-foreground">{statType}</p>
          <div className="flex items-center justify-between gap-4">
            <span>Current:</span>
            <span className="font-medium">{currentValue !== undefined ? formatStatValue(currentValue) : '--'}</span>
          </div>
          <div className="flex items-center justify-between gap-4">
            <span>Target:</span>
            <span className="font-medium">{isOver ? 'Over' : 'Under'} {targetValue !== undefined ? formatStatValue(targetValue) : '--'}</span>
          </div>
          {isLive && progress !== undefined && (
            <>
              <div className="flex items-center justify-between gap-4">
                <span>Progress:</span>
                <span className="font-medium">{progress}%</span>
              </div>
              <div className="w-full bg-secondary rounded-full h-1.5 mt-1">
                <div 
                  className={`h-1.5 rounded-full transition-all ${isHitting ? 'bg-green-500' : 'bg-amber-500'}`}
                  style={{ width: `${Math.min(100, progress || 0)}%` }}
                />
              </div>
            </>
          )}
        </>
      ) : (
        // Team Bet tooltip (Moneyline, Spread, Total)
        <>
          <p className="font-semibold">{betType === 'Spread' ? 'Spread Bet' : betType === 'Total' ? 'Total Bet' : 'Moneyline'}</p>
          {currentScore && (
            <div className="flex items-center justify-between gap-4">
              <span>Score:</span>
              <span className="font-medium">{currentScore}</span>
            </div>
          )}
          {awayTeam && homeTeam && (
            <div className="flex items-center justify-between gap-4">
              <span>{awayTeam}:</span>
              <span className="font-medium">{awayScore}</span>
            </div>
          )}
          {awayTeam && homeTeam && (
            <div className="flex items-center justify-between gap-4">
              <span>{homeTeam}:</span>
              <span className="font-medium">{homeScore}</span>
            </div>
          )}
          <div className="flex items-center justify-between gap-4">
            <span>Status:</span>
            <span className={`font-medium ${isHitting ? 'text-green-500' : 'text-amber-500'}`}>
              {isHitting ? 'WINNING' : 'LOSING'}
            </span>
          </div>
        </>
      )}
      <p className="text-muted-foreground mt-2">{timeRemaining}</p>
    </div>
  );

  // Badge text based on bet type
  const getBadgeText = () => {
    if (isComplete) {
      return isHitting ? 'WON' : 'LOST';
    }
    
    if (isLive) {
      if (betType === 'Player Prop' && currentValue !== undefined && targetValue !== undefined) {
        return `${formatStatValue(currentValue)}/${formatStatValue(targetValue)}`;
      }
      return `${awayScore}-${homeScore}`;
    }
    
    return timeRemaining;
  };

  if (compact) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex items-center gap-2">
              <Badge 
                variant={variant}
                className={`gap-1 ${bgColor}`}
              >
                {icon}
                {getBadgeText()}
              </Badge>
              {(isLive || isComplete) && (
                <span className="text-xs text-muted-foreground whitespace-nowrap">
                  {timeRemaining}
                </span>
              )}
            </div>
          </TooltipTrigger>
          <TooltipContent>
            {tooltipContent}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <Badge 
          variant={variant}
          className={`gap-1 ${bgColor}`}
        >
          {icon}
          {isLive && 'LIVE'}
          {isComplete && (isHitting ? 'WON' : 'LOST')}
          {!isLive && !isComplete && 'SCHEDULED'}
        </Badge>
        <span className="text-sm text-muted-foreground">{timeRemaining}</span>
      </div>

      <div className="space-y-1">
        {betType === 'Player Prop' ? (
          // Player Prop full view
          <>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">{statType}:</span>
              <span className="font-medium tabular-nums">
                {currentValue !== undefined ? formatStatValue(currentValue) : '--'} / {targetValue !== undefined ? formatStatValue(targetValue) : '--'}
              </span>
            </div>
            
            {(isLive || isComplete) && progress !== undefined && (
              <div className="w-full bg-secondary rounded-full h-2">
                <div 
                  className={`h-2 rounded-full transition-all ${
                    isComplete 
                      ? (isHitting ? 'bg-green-500' : 'bg-red-500')
                      : (isHitting ? 'bg-green-500' : 'bg-amber-500')
                  }`}
                  style={{ width: `${Math.min(100, progress)}%` }}
                />
              </div>
            )}
            
            {isLive && currentValue !== undefined && targetValue !== undefined && (
              <p className="text-xs text-muted-foreground">
                {isHitting ? '✓ Currently hitting' : `Need ${isOver ? formatStatValue(targetValue - currentValue) : formatStatValue(currentValue - targetValue)} more`}
              </p>
            )}
          </>
        ) : (
          // Team Bet full view
          <>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Score:</span>
              <span className="font-medium tabular-nums">
                {currentScore || `${awayScore}-${homeScore}`}
              </span>
            </div>
            
            {(isLive || isComplete) && (
              <p className="text-xs text-muted-foreground">
                {isHitting ? '✓ Currently winning' : '✗ Currently losing'}
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}



