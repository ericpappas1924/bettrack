import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Activity, CheckCircle2, XCircle, Clock } from "lucide-react";

export interface LiveStat {
  betId: string;
  gameId: string;
  sport: string;
  playerName: string;
  statType: string;
  targetValue: number;
  currentValue: number;
  isOver: boolean;
  isHitting: boolean;
  progress: number;
  gameStatus: string;
  isLive: boolean;
  isComplete: boolean;
  lastUpdated: string;
}

interface LiveStatsBadgeProps {
  liveStat?: LiveStat | null;
  compact?: boolean;
}

export function LiveStatsBadge({ liveStat, compact = false }: LiveStatsBadgeProps) {
  if (!liveStat) {
    return null;
  }

  const { currentValue, targetValue, isOver, isHitting, progress, gameStatus, isLive, isComplete, playerName, statType } = liveStat;

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

  const tooltipContent = (
    <div className="space-y-1 text-xs">
      <p className="font-semibold">{playerName}</p>
      <p className="text-muted-foreground">{statType}</p>
      <div className="flex items-center justify-between gap-4">
        <span>Current:</span>
        <span className="font-medium">{formatStatValue(currentValue)}</span>
      </div>
      <div className="flex items-center justify-between gap-4">
        <span>Target:</span>
        <span className="font-medium">{isOver ? 'Over' : 'Under'} {formatStatValue(targetValue)}</span>
      </div>
      {isLive && (
        <>
          <div className="flex items-center justify-between gap-4">
            <span>Progress:</span>
            <span className="font-medium">{progress}%</span>
          </div>
          <div className="w-full bg-secondary rounded-full h-1.5 mt-1">
            <div 
              className={`h-1.5 rounded-full transition-all ${isHitting ? 'bg-green-500' : 'bg-amber-500'}`}
              style={{ width: `${Math.min(100, progress)}%` }}
            />
          </div>
        </>
      )}
      <p className="text-muted-foreground mt-2">{gameStatus}</p>
    </div>
  );

  if (compact) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge 
              variant={variant}
              className={`gap-1 ${bgColor}`}
            >
              {icon}
              {isLive && `${formatStatValue(currentValue)}/${formatStatValue(targetValue)}`}
              {isComplete && (isHitting ? 'WON' : 'LOST')}
              {!isLive && !isComplete && gameStatus}
            </Badge>
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
        <span className="text-sm text-muted-foreground">{gameStatus}</span>
      </div>

      <div className="space-y-1">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">{statType}:</span>
          <span className="font-medium tabular-nums">
            {formatStatValue(currentValue)} / {formatStatValue(targetValue)}
          </span>
        </div>
        
        {(isLive || isComplete) && (
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
        
        {isLive && (
          <p className="text-xs text-muted-foreground">
            {isHitting ? '✓ Currently hitting' : `Need ${isOver ? formatStatValue(targetValue - currentValue) : formatStatValue(currentValue - targetValue)} more`}
          </p>
        )}
      </div>
    </div>
  );
}

