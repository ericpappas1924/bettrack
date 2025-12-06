import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Trophy, ThumbsDown, Minus, Check, AlertCircle, ChevronDown, ChevronUp } from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  buildRoundRobinBreakdown,
  type RoundRobinBreakdown,
  type RoundRobinLeg,
  formatCurrency,
  formatOdds,
} from "@/lib/roundRobin";

interface RoundRobinSettlementProps {
  betType: string;
  totalStake: number;
  notes: string;
  onSettleLeg: (legIndex: number, result: 'won' | 'lost' | 'push') => void;
  onSettleAll: (profit: number) => void;
  isSettling?: boolean;
}

export function RoundRobinSettlement({
  betType,
  totalStake,
  notes,
  onSettleLeg,
  onSettleAll,
  isSettling = false
}: RoundRobinSettlementProps) {
  const [breakdown, setBreakdown] = useState<RoundRobinBreakdown | null>(null);
  const [showParlays, setShowParlays] = useState(false);
  
  useEffect(() => {
    const result = buildRoundRobinBreakdown(betType, totalStake, notes);
    setBreakdown(result);
  }, [betType, totalStake, notes]);
  
  if (!breakdown) {
    return (
      <Card className="border-dashed">
        <CardContent className="py-4">
          <div className="flex items-center gap-2 text-muted-foreground">
            <AlertCircle className="h-4 w-4" />
            <span className="text-sm">Unable to parse round robin legs from notes</span>
          </div>
        </CardContent>
      </Card>
    );
  }
  
  const allSettled = breakdown.legs.every(l => l.status !== 'pending');
  const hasLiveStats = false; // TODO: Connect to live stats
  
  return (
    <div className="space-y-4">
      {/* Summary Card */}
      <Card>
        <CardHeader className="py-3 px-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium">
              {breakdown.parlaySize}/{breakdown.totalLegs} Round Robin
            </CardTitle>
            <Badge variant="secondary" className="text-xs">
              {breakdown.totalParlays} Parlays × {formatCurrency(breakdown.stakePerParlay)}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="pt-0 px-4 pb-4">
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-xs text-muted-foreground">Settled</p>
              <p className="text-lg font-semibold tabular-nums">
                {breakdown.settledParlays}/{breakdown.totalParlays}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Won</p>
              <p className="text-lg font-semibold tabular-nums text-green-600 dark:text-green-500">
                {breakdown.wonParlays}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Lost</p>
              <p className="text-lg font-semibold tabular-nums text-red-600 dark:text-red-500">
                {breakdown.lostParlays}
              </p>
            </div>
          </div>
          
          {allSettled && (
            <>
              <Separator className="my-3" />
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Final Profit</span>
                <span className={`text-lg font-bold tabular-nums ${
                  breakdown.totalProfit >= 0 
                    ? 'text-green-600 dark:text-green-500' 
                    : 'text-red-600 dark:text-red-500'
                }`}>
                  {breakdown.totalProfit >= 0 ? '+' : ''}{formatCurrency(breakdown.totalProfit)}
                </span>
              </div>
            </>
          )}
        </CardContent>
      </Card>
      
      {/* Leg Settlement */}
      <Card>
        <CardHeader className="py-3 px-4">
          <CardTitle className="text-sm font-medium">Settle Legs</CardTitle>
        </CardHeader>
        <CardContent className="pt-0 px-4 pb-4 space-y-3">
          {breakdown.legs.map((leg, idx) => (
            <LegSettlementRow
              key={idx}
              leg={leg}
              onSettle={(result) => onSettleLeg(idx, result)}
              disabled={isSettling}
            />
          ))}
        </CardContent>
      </Card>
      
      {/* Parlay Breakdown (Collapsible) */}
      <Collapsible open={showParlays} onOpenChange={setShowParlays}>
        <CollapsibleTrigger asChild>
          <Button 
            variant="ghost" 
            className="w-full justify-between"
            data-testid="button-toggle-parlays"
          >
            <span className="text-sm">View Parlay Breakdown</span>
            {showParlays ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="space-y-2 mt-2">
            {breakdown.parlays.map((parlay, idx) => (
              <div 
                key={idx}
                className={`p-3 rounded-md border ${
                  parlay.status === 'won' 
                    ? 'bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-900' 
                    : parlay.status === 'lost'
                    ? 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-900'
                    : 'bg-muted/50'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium">
                    Parlay {idx + 1}
                  </span>
                  <Badge 
                    variant={parlay.status === 'won' ? 'default' : parlay.status === 'lost' ? 'destructive' : 'secondary'}
                    className="text-xs"
                  >
                    {parlay.status.toUpperCase()}
                  </Badge>
                </div>
                <div className="text-xs text-muted-foreground space-y-1">
                  {parlay.legs.map((legIdx) => {
                    const leg = breakdown.legs.find(l => l.index === legIdx);
                    if (!leg) return null;
                    return (
                      <div key={legIdx} className="flex items-center gap-2">
                        {leg.status === 'won' && <Check className="h-3 w-3 text-green-600" />}
                        {leg.status === 'lost' && <ThumbsDown className="h-3 w-3 text-red-600" />}
                        {leg.status === 'pending' && <Minus className="h-3 w-3 text-muted-foreground" />}
                        <span>{leg.team} {leg.spread} ({formatOdds(leg.odds)})</span>
                      </div>
                    );
                  })}
                </div>
                <div className="flex items-center justify-between mt-2 pt-2 border-t border-dashed">
                  <span className="text-xs text-muted-foreground">
                    Stake: {formatCurrency(parlay.stake)}
                  </span>
                  <span className={`text-xs font-medium ${
                    parlay.status === 'won' ? 'text-green-600 dark:text-green-500' : ''
                  }`}>
                    {parlay.status === 'won' 
                      ? `+${formatCurrency(parlay.potentialWin)}`
                      : parlay.status === 'lost'
                      ? `-${formatCurrency(parlay.stake)}`
                      : `To Win: ${formatCurrency(parlay.potentialWin)}`
                    }
                  </span>
                </div>
              </div>
            ))}
          </div>
        </CollapsibleContent>
      </Collapsible>
      
      {/* Final Settlement Button */}
      {allSettled && (
        <Button
          className="w-full"
          onClick={() => onSettleAll(breakdown.totalProfit)}
          disabled={isSettling}
          data-testid="button-settle-round-robin"
        >
          {isSettling ? (
            "Settling..."
          ) : (
            <>
              <Check className="h-4 w-4 mr-2" />
              Settle Round Robin ({breakdown.totalProfit >= 0 ? '+' : ''}{formatCurrency(breakdown.totalProfit)})
            </>
          )}
        </Button>
      )}
    </div>
  );
}

interface LegSettlementRowProps {
  leg: RoundRobinLeg;
  onSettle: (result: 'won' | 'lost' | 'push') => void;
  disabled?: boolean;
}

function LegSettlementRow({ leg, onSettle, disabled }: LegSettlementRowProps) {
  const isSettled = leg.status !== 'pending';
  
  return (
    <div className={`p-3 rounded-md border ${
      leg.status === 'won' 
        ? 'bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-900' 
        : leg.status === 'lost'
        ? 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-900'
        : leg.status === 'push'
        ? 'bg-yellow-50 dark:bg-yellow-950/30 border-yellow-200 dark:border-yellow-900'
        : ''
    }`}>
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs shrink-0">
              {leg.sport}
            </Badge>
            {isSettled && (
              <Badge 
                variant={leg.status === 'won' ? 'default' : leg.status === 'lost' ? 'destructive' : 'secondary'}
                className="text-xs"
              >
                {leg.status.toUpperCase()}
              </Badge>
            )}
          </div>
          <p className="text-sm font-medium mt-1 truncate">
            {leg.team} {leg.spread}
          </p>
          <p className="text-xs text-muted-foreground truncate">
            {leg.matchup}
          </p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-sm font-medium tabular-nums">
            {formatOdds(leg.odds)}
          </p>
        </div>
      </div>
      
      {!isSettled && (
        <div className="flex items-center gap-2 mt-2 pt-2 border-t border-dashed">
          <Button
            size="sm"
            variant="outline"
            className="flex-1 border-yellow-500/50 text-yellow-600 hover:bg-yellow-500/10"
            onClick={() => onSettle('push')}
            disabled={disabled}
            data-testid={`button-leg-push-${leg.index}`}
          >
            <Minus className="h-3 w-3 mr-1" />
            Push
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="flex-1 border-red-500/50 text-red-600 hover:bg-red-500/10"
            onClick={() => onSettle('lost')}
            disabled={disabled}
            data-testid={`button-leg-lost-${leg.index}`}
          >
            <ThumbsDown className="h-3 w-3 mr-1" />
            Lost
          </Button>
          <Button
            size="sm"
            className="flex-1 bg-green-600 hover:bg-green-700"
            onClick={() => onSettle('won')}
            disabled={disabled}
            data-testid={`button-leg-won-${leg.index}`}
          >
            <Trophy className="h-3 w-3 mr-1" />
            Won
          </Button>
        </div>
      )}
    </div>
  );
}

export default RoundRobinSettlement;
