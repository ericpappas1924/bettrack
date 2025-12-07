import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { CheckCircle2, XCircle, Clock, Activity, HelpCircle } from "lucide-react";

export interface ParlayLegLiveStat {
  legIndex: number;
  description: string;
  sport: string;
  team: string;
  betType: string;
  line?: number;
  overUnder?: string;
  gameDate: Date | string | null;
  
  isLive: boolean;
  isComplete: boolean;
  isWinning: boolean;
  status: 'pending' | 'live' | 'won' | 'lost' | 'unknown';
  
  homeTeam?: string;
  awayTeam?: string;
  homeScore?: number;
  awayScore?: number;
  gameStatus?: string;
  
  totalScore?: number;
  
  // Player prop specific
  playerName?: string;
  statType?: string;
  currentValue?: number;
  targetValue?: number;
  progress?: number;
}

export interface ParlayLiveStats {
  betId: string;
  legs: ParlayLegLiveStat[];
}

interface ParlayLiveProgressProps {
  parlayStats?: ParlayLiveStats | null;
  compact?: boolean;
}

function getStatusIcon(status: ParlayLegLiveStat['status'], isLive: boolean) {
  if (status === 'won') {
    return <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />;
  }
  if (status === 'lost') {
    return <XCircle className="h-3.5 w-3.5 text-red-500" />;
  }
  if (status === 'live' || isLive) {
    return <Activity className="h-3.5 w-3.5 text-amber-500 animate-pulse" />;
  }
  if (status === 'unknown') {
    return <HelpCircle className="h-3.5 w-3.5 text-muted-foreground" />;
  }
  return <Clock className="h-3.5 w-3.5 text-muted-foreground" />;
}

function getStatusBadge(leg: ParlayLegLiveStat) {
  const { status, isLive, isWinning, homeScore, awayScore, gameStatus } = leg;
  
  if (status === 'won') {
    return (
      <Badge className="bg-green-600 text-white text-xs">
        Won
      </Badge>
    );
  }
  
  if (status === 'lost') {
    return (
      <Badge variant="destructive" className="text-xs">
        Lost
      </Badge>
    );
  }
  
  if (status === 'live' || isLive) {
    const score = homeScore !== undefined && awayScore !== undefined 
      ? `${awayScore}-${homeScore}` 
      : '';
    
    return (
      <Badge className={`text-xs ${isWinning ? 'bg-green-600' : 'bg-amber-600'} text-white`}>
        <Activity className="h-2.5 w-2.5 mr-1 animate-pulse" />
        {score || 'LIVE'}
      </Badge>
    );
  }
  
  return (
    <Badge variant="secondary" className="text-xs">
      Pending
    </Badge>
  );
}

export function ParlayLiveProgress({ parlayStats, compact = false }: ParlayLiveProgressProps) {
  if (!parlayStats || parlayStats.legs.length === 0) {
    return null;
  }

  const { legs } = parlayStats;
  const totalLegs = legs.length;
  const wonLegs = legs.filter(l => l.status === 'won').length;
  const lostLegs = legs.filter(l => l.status === 'lost').length;
  const liveLegs = legs.filter(l => l.status === 'live' || l.isLive).length;
  const pendingLegs = legs.filter(l => l.status === 'pending').length;
  
  const completedLegs = wonLegs + lostLegs;
  const progressPercent = (completedLegs / totalLegs) * 100;
  
  const hasLost = lostLegs > 0;
  const allWon = wonLegs === totalLegs;
  const hasLive = liveLegs > 0;

  if (compact) {
    return (
      <div className="flex items-center gap-2">
        {hasLost ? (
          <Badge variant="destructive" className="text-xs">
            {wonLegs}/{totalLegs} Won
          </Badge>
        ) : allWon ? (
          <Badge className="bg-green-600 text-white text-xs">
            All {totalLegs} Won
          </Badge>
        ) : hasLive ? (
          <Badge className="bg-amber-600 text-white text-xs">
            <Activity className="h-2.5 w-2.5 mr-1 animate-pulse" />
            {wonLegs}/{totalLegs}
          </Badge>
        ) : (
          <Badge variant="secondary" className="text-xs">
            {wonLegs}/{totalLegs}
          </Badge>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3" data-testid="parlay-live-progress">
      <div className="space-y-1">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>Progress</span>
          <span>{completedLegs}/{totalLegs} legs complete</span>
        </div>
        <Progress 
          value={progressPercent} 
          className={`h-2 ${hasLost ? '[&>div]:bg-red-500' : allWon ? '[&>div]:bg-green-500' : ''}`}
        />
      </div>
      
      <div className="space-y-2">
        {legs.map((leg, index) => (
          <div 
            key={index}
            className={`flex items-start gap-2 p-2 rounded-md ${
              leg.status === 'won' ? 'bg-green-500/10' :
              leg.status === 'lost' ? 'bg-red-500/10' :
              leg.isLive ? 'bg-amber-500/10' :
              'bg-muted/50'
            }`}
            data-testid={`parlay-leg-${index}`}
          >
            {getStatusIcon(leg.status, leg.isLive)}
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-medium truncate">
                  {leg.team}
                </span>
                {getStatusBadge(leg)}
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span>{leg.sport}</span>
                {leg.betType && <span>{leg.betType}</span>}
                {leg.line && (
                  <span>
                    {leg.overUnder || ''}{leg.line > 0 ? '+' : ''}{leg.line}
                  </span>
                )}
              </div>
              {/* Player prop progress */}
              {leg.betType === 'Player Prop' && leg.currentValue !== undefined && leg.targetValue !== undefined && (
                <div className="mt-1 space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium">
                      {leg.currentValue} / {leg.targetValue} {leg.statType}
                    </span>
                    <span className={leg.isWinning ? 'text-green-600' : 'text-amber-600'}>
                      {leg.progress !== undefined ? `${Math.round(leg.progress)}%` : ''}
                    </span>
                  </div>
                  <Progress 
                    value={leg.progress || 0} 
                    className={`h-1.5 ${leg.isWinning ? '[&>div]:bg-green-500' : '[&>div]:bg-amber-500'}`}
                  />
                  {leg.gameStatus && (
                    <span className="text-xs text-muted-foreground">
                      {leg.gameStatus}
                    </span>
                  )}
                </div>
              )}
              {/* Team game score */}
              {leg.betType !== 'Player Prop' && (leg.isLive || leg.isComplete) && leg.homeScore !== undefined && leg.awayScore !== undefined && (
                <div className="text-xs font-medium mt-1">
                  {leg.awayTeam} {leg.awayScore} - {leg.homeScore} {leg.homeTeam}
                  {leg.gameStatus && (
                    <span className="ml-2 text-muted-foreground">
                      {leg.gameStatus}
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
      
      {hasLive && (
        <p className="text-xs text-muted-foreground text-center">
          <Activity className="h-3 w-3 inline mr-1 animate-pulse" />
          Live tracking updates every minute
        </p>
      )}
    </div>
  );
}

export function ParlayLiveProgressCompact({ parlayStats }: { parlayStats?: ParlayLiveStats | null }) {
  return <ParlayLiveProgress parlayStats={parlayStats} compact />;
}
