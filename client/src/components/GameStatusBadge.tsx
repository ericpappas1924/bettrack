import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Activity, CheckCircle2, Clock } from "lucide-react";
import { getGameStatus, getGameEndTime, getTimeUntilGame, getTimeRemaining, GAME_STATUS, type Sport, type GameStatus } from "@shared/betTypes";
import { format } from "date-fns";

interface GameStatusBadgeProps {
  gameStartTime: Date | string | null;
  sport: Sport;
  compact?: boolean;
  betType?: string;
  notes?: string | null;
}

export function GameStatusBadge({ gameStartTime, sport, compact = false, betType, notes }: GameStatusBadgeProps) {
  if (!gameStartTime) {
    return null;
  }

  // For parlays/teasers, determine status from leg completion
  if ((betType === 'Parlay' || betType === 'Teaser' || betType === 'Player Prop Parlay') && notes) {
    const legs = notes.split('\n').filter(line => 
      line.trim() && 
      !line.startsWith('Category:') && 
      !line.startsWith('League:') &&
      !line.startsWith('Game ID:') &&
      !line.startsWith('Auto-settled:')
    );

    if (legs.length > 0) {
      const totalLegs = legs.length;
      const completeLegs = legs.filter(leg => leg.includes('[Won]') || leg.includes('[Lost]')).length;
      const allComplete = completeLegs === totalLegs;

      // If all legs complete, show as FINAL
      if (allComplete) {
        return (
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="gap-1">
              <CheckCircle2 className="h-3 w-3" />
              FINAL
            </Badge>
            <span className="text-sm text-muted-foreground">
              All {totalLegs} legs complete
            </span>
          </div>
        );
      }

      // Otherwise show progress
      return (
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="gap-1">
            <Clock className="h-3 w-3" />
            IN PROGRESS
          </Badge>
          <span className="text-sm text-muted-foreground">
            {completeLegs}/{totalLegs} legs complete
          </span>
        </div>
      );
    }
  }

  const status = getGameStatus(gameStartTime, sport);
  
  if (status === GAME_STATUS.UNKNOWN) {
    return null;
  }

  const startTime = typeof gameStartTime === 'string' ? new Date(gameStartTime) : gameStartTime;
  const endTime = getGameEndTime(gameStartTime, sport);

  // Format time helpers
  const formatMinutes = (minutes: number): string => {
    if (minutes < 60) {
      return `${minutes}m`;
    }
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  };

  // Get status-specific details
  let icon;
  let variant: "default" | "secondary" | "destructive" | "outline" = "secondary";
  let bgColor = "";
  let label = "";
  let timeInfo = "";

  switch (status) {
    case GAME_STATUS.PREGAME:
      icon = <Clock className="h-3 w-3" />;
      variant = "outline";
      label = "PREGAME";
      const timeUntil = getTimeUntilGame(gameStartTime);
      if (timeUntil !== null) {
        if (timeUntil < 60) {
          timeInfo = `Starts in ${timeUntil}m`;
        } else if (timeUntil < 1440) { // Less than 24 hours
          timeInfo = `Starts in ${formatMinutes(timeUntil)}`;
        } else {
          timeInfo = `Starts ${format(startTime, "MMM dd, h:mm a")}`;
        }
      } else {
        timeInfo = `Starts ${format(startTime, "MMM dd, h:mm a")}`;
      }
      break;

    case GAME_STATUS.LIVE:
      icon = <Activity className="h-3 w-3 animate-pulse" />;
      bgColor = "bg-green-600 hover:bg-green-700 dark:bg-green-700 dark:hover:bg-green-800";
      label = "LIVE";
      const timeLeft = getTimeRemaining(gameStartTime, sport);
      if (timeLeft !== null && timeLeft > 0) {
        timeInfo = `Est. ${formatMinutes(timeLeft)} remaining`;
      } else {
        timeInfo = "In Progress";
      }
      break;

    case GAME_STATUS.COMPLETED:
      icon = <CheckCircle2 className="h-3 w-3" />;
      variant = "secondary";
      label = "FINAL";
      timeInfo = `Ended ${format(startTime, "MMM dd")}`;
      break;
  }

  const tooltipContent = (
    <div className="space-y-1 text-xs">
      <p className="font-semibold">{label}</p>
      <div className="flex items-center justify-between gap-4">
        <span>Started:</span>
        <span className="font-medium">{format(startTime, "MMM dd, h:mm a")}</span>
      </div>
      {endTime && status === GAME_STATUS.LIVE && (
        <div className="flex items-center justify-between gap-4">
          <span>Est. End:</span>
          <span className="font-medium">{format(endTime, "h:mm a")}</span>
        </div>
      )}
      {endTime && status === GAME_STATUS.COMPLETED && (
        <div className="flex items-center justify-between gap-4">
          <span>Est. Ended:</span>
          <span className="font-medium">{format(endTime, "h:mm a")}</span>
        </div>
      )}
      <p className="text-muted-foreground mt-2">{timeInfo}</p>
    </div>
  );

  if (compact) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge 
              variant={variant}
              className={`gap-1 text-xs ${bgColor}`}
            >
              {icon}
              {label}
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
          {label}
        </Badge>
        <span className="text-sm text-muted-foreground">{timeInfo}</span>
      </div>
      
      <div className="space-y-1 text-sm">
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Kickoff:</span>
          <span className="font-medium">{format(startTime, "MMM dd, h:mm a")}</span>
        </div>
        {endTime && status !== GAME_STATUS.PREGAME && (
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Est. End:</span>
            <span className="font-medium">{format(endTime, "h:mm a")}</span>
          </div>
        )}
      </div>
    </div>
  );
}




