import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BetStatusBadge } from "./BetStatusBadge";
import { LiveProbabilityBadge } from "./LiveProbabilityBadge";
import type { LiveStat } from "./LiveStatsBadge";
import { GameStatusBadge } from "./GameStatusBadge";
import { Badge } from "@/components/ui/badge";
import type { Sport } from "@shared/betTypes";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { RefreshCw, AlertCircle } from "lucide-react";
import { format } from "date-fns";
import { useEffect } from "react";
import {
  americanToImpliedProbability,
  calculateExpectedValue,
} from "@/lib/betting";

interface Bet {
  id: string;
  sport: string;
  betType: string;
  team: string;
  openingOdds: string;
  liveOdds?: string | null;
  stake: string;
  potentialWin?: string | null;
  status: string;
  result?: string | null;
  profit?: string | null;
  clv?: string | null;
  expectedValue?: string | null;
  clvFetchError?: string | null;
  clvLastAttempt?: Date | string | null;
  createdAt: Date | string;
  gameStartTime?: Date | string | null;
}

interface BetTableProps {
  bets: Bet[];
  liveStats?: LiveStat[];
  onRowClick?: (bet: Bet) => void;
  onFetchCLV?: (betId: string) => void;
  fetchingCLV?: Set<string>;
}

export function BetTable({ bets, liveStats = [], onRowClick, onFetchCLV, fetchingCLV = new Set() }: BetTableProps) {
  const getLiveStatForBet = (betId: string) => {
    const stat = liveStats.find(stat => stat.betId === betId);
    if (stat) {
      console.log(`✅ [BET-TABLE] Found live stat for bet ${betId.substring(0, 8)}:`, {
        playerName: stat.playerName,
        currentValue: stat.currentValue,
        targetValue: stat.targetValue,
        isLive: stat.isLive
      });
    }
    return stat;
  };
  
  // Debug: Log all live stats on mount/update
  useEffect(() => {
    if (liveStats.length > 0) {
      console.log(`📊 [BET-TABLE] Total live stats: ${liveStats.length}`, liveStats.map(s => ({
        betId: s.betId?.substring(0, 8),
        playerName: s.playerName
      })));
      console.log(`📊 [BET-TABLE] Total bets: ${bets.length}`, bets.filter(b => b.status === 'active').map(b => ({
        betId: b.id.substring(0, 8),
        sport: b.sport,
        betType: b.betType
      })));
    }
  }, [liveStats, bets]);
  const formatCurrency = (value: string | number | null | undefined) => {
    if (value === null || value === undefined) return "-";
    const num = typeof value === "string" ? parseFloat(value) : value;
    if (isNaN(num)) return "-";
    return num >= 0 ? `$${num.toFixed(2)}` : `-$${Math.abs(num).toFixed(2)}`;
  };

  const formatOdds = (odds: string) => {
    const num = parseFloat(odds);
    return num > 0 ? `+${num}` : num.toString();
  };

  const getWinProbabilities = (bet: Bet) => {
    const openingOdds = parseFloat(bet.openingOdds);
    const baselineProbability = americanToImpliedProbability(openingOdds);

    if (bet.liveOdds) {
      const liveOddsNum = parseFloat(bet.liveOdds);
      const liveProbability = americanToImpliedProbability(liveOddsNum);
      return { baselineProbability, liveProbability };
    }

    return { baselineProbability, liveProbability: baselineProbability };
  };

  const getEstimatedEV = (bet: Bet) => {
    const { liveProbability } = getWinProbabilities(bet);
    const stake = parseFloat(bet.stake);
    const odds = bet.liveOdds ? parseFloat(bet.liveOdds) : parseFloat(bet.openingOdds);
    return calculateExpectedValue(stake, odds, liveProbability);
  };

  if (bets.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        No bets found
      </div>
    );
  }

  return (
    <>
      {/* Mobile Card View */}
      <div className="md:hidden space-y-3">
        {bets.map((bet) => {
          const { baselineProbability, liveProbability } = getWinProbabilities(bet);
          const estimatedEV = bet.status === "active" ? getEstimatedEV(bet) : null;
          const liveStat = getLiveStatForBet(bet.id);

          return (
            <Card
              key={bet.id}
              className="hover-elevate cursor-pointer"
              onClick={() => onRowClick?.(bet)}
              data-testid={`card-bet-${bet.id}`}
            >
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <Badge variant="secondary" className="text-xs">{bet.sport}</Badge>
                      <BetStatusBadge status={bet.status} result={bet.result} />
                      {bet.gameStartTime && (
                        <GameStatusBadge 
                          gameStartTime={bet.gameStartTime} 
                          sport={bet.sport as Sport}
                          compact 
                          betType={bet.betType}
                          notes={bet.notes}
                          betStatus={bet.status}
                        />
                      )}
                      {liveStat && liveStat.isLive && (
                        <div className="flex items-center gap-1">
                          <Badge variant="secondary" className="text-xs">
                            LIVE
                          </Badge>
                          {liveStat.betType === 'Player Prop' && liveStat.currentValue !== undefined && liveStat.targetValue !== undefined && (
                            <span className="text-xs font-medium tabular-nums">
                              {Number.isInteger(liveStat.currentValue) 
                                ? liveStat.currentValue.toString() 
                                : liveStat.currentValue.toFixed(1)} / {Number.isInteger(liveStat.targetValue) 
                                  ? liveStat.targetValue.toString() 
                                  : liveStat.targetValue.toFixed(1)}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                    <p className="font-medium truncate">{bet.team}</p>
                    <p className="text-xs text-muted-foreground">{bet.betType}</p>
                    {liveStat && liveStat.betType === 'Player Prop' && liveStat.progress !== undefined && (
                      <div className="w-full bg-secondary rounded-full h-1.5 mt-1">
                        <div 
                          className={`h-1.5 rounded-full transition-all ${
                            liveStat.isComplete 
                              ? (liveStat.isWinning ? 'bg-green-500' : 'bg-red-500')
                              : (liveStat.isWinning ? 'bg-green-500' : 'bg-amber-500')
                          }`}
                          style={{ width: `${Math.min(100, liveStat.progress || 0)}%` }}
                        />
                      </div>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    <div className="flex items-center gap-1">
                      <div>
                        <p className="text-lg font-bold tabular-nums">
                          {formatOdds(bet.openingOdds)}
                        </p>
                        {bet.liveOdds && bet.status === "active" && (
                          <p className="text-xs text-muted-foreground">
                            Live: {formatOdds(bet.liveOdds)}
                          </p>
                        )}
                      </div>
                      {bet.status === "active" && !bet.clv && (
                        <>
                          {bet.clvFetchError && (
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <AlertCircle className="h-4 w-4 text-yellow-600 dark:text-yellow-500" />
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p className="text-sm">CLV Fetch Failed: {bet.clvFetchError}</p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          )}
                          {onFetchCLV && (
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8 shrink-0"
                              onClick={(e) => {
                                e.stopPropagation();
                                onFetchCLV(bet.id);
                              }}
                              disabled={fetchingCLV.has(bet.id)}
                              title="Fetch current CLV"
                            >
                              <RefreshCw className={`h-4 w-4 ${fetchingCLV.has(bet.id) ? 'animate-spin' : ''}`} />
                            </Button>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <div className="space-y-2 pt-3 border-t">
                  {bet.gameStartTime && (
                    <div>
                      <p className="text-xs text-muted-foreground">Game Time</p>
                      <p className="text-sm">
                        {format(new Date(bet.gameStartTime), "MMM dd, h:mm a")}
                      </p>
                    </div>
                  )}
                  <div className="grid grid-cols-4 gap-2">
                    <div>
                      <p className="text-xs text-muted-foreground">Stake</p>
                      <p className="font-semibold tabular-nums text-sm">
                        {formatCurrency(bet.stake)}
                      </p>
                    </div>
                    <div className="text-center">
                      {bet.status === "active" ? (
                        <>
                          <p className="text-xs text-muted-foreground">Live Progress</p>
                          {liveStat ? (
                            <div className="space-y-1">
                              {liveStat.betType === 'Player Prop' && liveStat.currentValue !== undefined && liveStat.targetValue !== undefined ? (
                                <>
                                  <p className="text-xs font-medium tabular-nums">
                                    {Number.isInteger(liveStat.currentValue) 
                                      ? liveStat.currentValue.toString() 
                                      : liveStat.currentValue.toFixed(1)} / {Number.isInteger(liveStat.targetValue) 
                                        ? liveStat.targetValue.toString() 
                                        : liveStat.targetValue.toFixed(1)}
                                  </p>
                                  {liveStat.progress !== undefined && (
                                    <div className="w-full bg-secondary rounded-full h-1.5">
                                      <div 
                                        className={`h-1.5 rounded-full transition-all ${
                                          liveStat.isComplete 
                                            ? (liveStat.isWinning ? 'bg-green-500' : 'bg-red-500')
                                            : (liveStat.isWinning ? 'bg-green-500' : 'bg-amber-500')
                                        }`}
                                        style={{ width: `${Math.min(100, liveStat.progress || 0)}%` }}
                                      />
                                    </div>
                                  )}
                                </>
                              ) : (
                                liveStat.currentScore && (
                                  <p className="text-xs font-medium">{liveStat.currentScore}</p>
                                )
                              )}
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">-</span>
                          )}
                        </>
                      ) : (
                        <>
                          <p className="text-xs text-muted-foreground">P/L</p>
                          <p
                            className={`font-semibold tabular-nums text-sm ${
                              bet.profit && parseFloat(bet.profit) > 0
                                ? "text-green-600 dark:text-green-500"
                                : bet.profit && parseFloat(bet.profit) < 0
                                ? "text-red-600 dark:text-red-500"
                                : ""
                            }`}
                          >
                            {formatCurrency(bet.profit)}
                          </p>
                        </>
                      )}
                    </div>
                    <div className="text-center">
                      <p className="text-xs text-muted-foreground">CLV</p>
                      <p
                        className={`font-semibold tabular-nums text-sm ${
                          bet.clv && parseFloat(bet.clv) > 0
                            ? "text-green-600 dark:text-green-500"
                            : bet.clv && parseFloat(bet.clv) < 0
                            ? "text-red-600 dark:text-red-500"
                            : ""
                        }`}
                      >
                        {bet.clv ? `${parseFloat(bet.clv) > 0 ? '+' : ''}${parseFloat(bet.clv).toFixed(1)}%` : "-"}
                      </p>
                    </div>
                    <div className="text-right">
                      {bet.status === "active" ? (
                        <>
                          <p className="text-xs text-muted-foreground">Est. W/L</p>
                          <p
                            className={`font-semibold tabular-nums text-sm ${
                              estimatedEV !== null && estimatedEV > 0
                                ? "text-green-600 dark:text-green-500"
                              : estimatedEV !== null && estimatedEV < 0
                                ? "text-red-600 dark:text-red-500"
                                : ""
                            }`}
                          >
                            {estimatedEV !== null ? formatCurrency(estimatedEV) : "-"}
                          </p>
                        </>
                      ) : (
                        <>
                          <p className="text-xs text-muted-foreground">To Win</p>
                          <p className="font-semibold tabular-nums text-sm">
                            {formatCurrency(bet.potentialWin)}
                          </p>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Desktop Table View */}
      <div className="hidden md:block rounded-md border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-24">Bet Placed</TableHead>
              <TableHead className="w-32">Game Time</TableHead>
              <TableHead className="w-20">Sport</TableHead>
              <TableHead>Team/Player</TableHead>
              <TableHead className="w-24 text-right">Odds</TableHead>
              <TableHead className="w-24 text-right">Stake</TableHead>
              <TableHead className="w-32">Live Progress</TableHead>
              <TableHead className="w-28 text-right">Est. W/L</TableHead>
              <TableHead className="w-20 text-right">CLV</TableHead>
              <TableHead className="w-24">Status</TableHead>
              <TableHead className="w-24 text-right">P/L</TableHead>
              <TableHead className="w-16"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {bets.map((bet) => {
              const { baselineProbability, liveProbability } = getWinProbabilities(bet);
              const estimatedEV = bet.status === "active" ? getEstimatedEV(bet) : null;
              const liveStat = getLiveStatForBet(bet.id);

              return (
                <TableRow
                  key={bet.id}
                  className="cursor-pointer hover-elevate"
                  onClick={() => onRowClick?.(bet)}
                  data-testid={`row-bet-${bet.id}`}
                >
                  <TableCell className="text-sm">
                    {format(new Date(bet.createdAt), "MMM dd")}
                  </TableCell>
                  <TableCell className="text-sm">
                    {bet.gameStartTime 
                      ? format(new Date(bet.gameStartTime), "MMM dd, h:mm a")
                      : "-"}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-1">
                      <Badge variant="secondary" className="text-xs w-fit">
                        {bet.sport}
                      </Badge>
                      {bet.gameStartTime && (
                        <GameStatusBadge 
                          gameStartTime={bet.gameStartTime} 
                          sport={bet.sport as Sport}
                          compact 
                          betType={bet.betType}
                          notes={bet.notes}
                          betStatus={bet.status}
                        />
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div>
                      <p className="font-medium">{bet.team}</p>
                      <p className="text-xs text-muted-foreground">{bet.betType}</p>
                    </div>
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-sm">
                    <div>
                      <p>{formatOdds(bet.openingOdds)}</p>
                      {bet.liveOdds && bet.status === "active" && (
                        <p className="text-xs text-muted-foreground">
                          Live: {formatOdds(bet.liveOdds)}
                        </p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-sm">
                    {formatCurrency(bet.stake)}
                  </TableCell>
                  <TableCell>
                    {liveStat ? (
                      <div className="space-y-1">
                        {liveStat.betType === 'Player Prop' && liveStat.currentValue !== undefined && liveStat.targetValue !== undefined ? (
                          <>
                            <div className="flex items-center justify-between gap-2 text-xs">
                              <span className="text-muted-foreground">
                                {liveStat.playerName || 'Player'}
                              </span>
                              <span className="font-medium tabular-nums">
                                {Number.isInteger(liveStat.currentValue) 
                                  ? liveStat.currentValue.toString() 
                                  : liveStat.currentValue.toFixed(1)} / {Number.isInteger(liveStat.targetValue) 
                                    ? liveStat.targetValue.toString() 
                                    : liveStat.targetValue.toFixed(1)}
                              </span>
                            </div>
                            {liveStat.progress !== undefined && (
                              <div className="w-full bg-secondary rounded-full h-1.5">
                                <div 
                                  className={`h-1.5 rounded-full transition-all ${
                                    liveStat.isComplete 
                                      ? (liveStat.isWinning ? 'bg-green-500' : 'bg-red-500')
                                      : (liveStat.isWinning ? 'bg-green-500' : 'bg-amber-500')
                                  }`}
                                  style={{ width: `${Math.min(100, liveStat.progress || 0)}%` }}
                                />
                              </div>
                            )}
                            {liveStat.isLive && (
                              <span className="text-xs text-muted-foreground">
                                {liveStat.gameStatus || 'Live'}
                              </span>
                            )}
                          </>
                        ) : (
                          <>
                            {liveStat.currentScore && (
                              <div className="text-xs font-medium">{liveStat.currentScore}</div>
                            )}
                            {liveStat.isLive && (
                              <span className="text-xs text-muted-foreground">
                                {liveStat.gameStatus || 'Live'}
                              </span>
                            )}
                          </>
                        )}
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell
                    className={`text-right tabular-nums text-sm font-semibold ${
                      estimatedEV !== null && estimatedEV > 0
                        ? "text-green-600 dark:text-green-500"
                        : estimatedEV !== null && estimatedEV < 0
                        ? "text-red-600 dark:text-red-500"
                        : ""
                    }`}
                    data-testid={`text-ev-${bet.id}`}
                  >
                    {estimatedEV !== null ? formatCurrency(estimatedEV) : "-"}
                  </TableCell>
                  <TableCell
                    className={`text-right tabular-nums text-sm font-semibold ${
                      bet.clv && parseFloat(bet.clv) > 0
                        ? "text-green-600 dark:text-green-500"
                        : bet.clv && parseFloat(bet.clv) < 0
                        ? "text-red-600 dark:text-red-500"
                        : ""
                    }`}
                    data-testid={`text-clv-${bet.id}`}
                  >
                    {bet.clv ? `${parseFloat(bet.clv) > 0 ? '+' : ''}${parseFloat(bet.clv).toFixed(1)}%` : "-"}
                  </TableCell>
                  <TableCell>
                    <BetStatusBadge status={bet.status} result={bet.result} />
                  </TableCell>
                  <TableCell
                    className={`text-right tabular-nums font-semibold ${
                      bet.profit && parseFloat(bet.profit) > 0
                        ? "text-green-600 dark:text-green-500"
                        : bet.profit && parseFloat(bet.profit) < 0
                        ? "text-red-600 dark:text-red-500"
                        : ""
                    }`}
                    data-testid={`text-profit-${bet.id}`}
                  >
                    {formatCurrency(bet.profit)}
                  </TableCell>
                  <TableCell>
                    {bet.status === "active" && (
                      <div className="flex items-center gap-1">
                        {bet.clvFetchError && (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <AlertCircle className="h-4 w-4 text-yellow-600 dark:text-yellow-500 cursor-help" />
                              </TooltipTrigger>
                              <TooltipContent>
                                <p className="text-sm max-w-xs">CLV Fetch Failed: {bet.clvFetchError}</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        )}
                        {onFetchCLV && (
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8"
                            onClick={(e) => {
                              e.stopPropagation();
                              onFetchCLV(bet.id);
                            }}
                            disabled={fetchingCLV.has(bet.id)}
                            title={bet.clv ? "Re-fetch CLV" : "Fetch current CLV"}
                          >
                            <RefreshCw className={`h-4 w-4 ${fetchingCLV.has(bet.id) ? 'animate-spin' : ''}`} />
                          </Button>
                        )}
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </>
  );
}
