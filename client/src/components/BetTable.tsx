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
import { LiveStatsBadge, type LiveStat } from "./LiveStatsBadge";
import { Badge } from "@/components/ui/badge";
import { RefreshCw } from "lucide-react";
import { format } from "date-fns";
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
    return liveStats.find(stat => stat.betId === betId);
  };
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
                      {liveStat && <LiveStatsBadge liveStat={liveStat} compact />}
                    </div>
                    <p className="font-medium truncate">{bet.team}</p>
                    <p className="text-xs text-muted-foreground">{bet.betType}</p>
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
                      {bet.status === "active" && !bet.clv && onFetchCLV && (
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
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <p className="text-xs text-muted-foreground">Stake</p>
                      <p className="font-semibold tabular-nums text-sm">
                        {formatCurrency(bet.stake)}
                      </p>
                    </div>
                    <div className="text-center">
                      {bet.status === "active" ? (
                        <>
                          <p className="text-xs text-muted-foreground">Win %</p>
                          <LiveProbabilityBadge
                            baselineProbability={baselineProbability}
                            liveProbability={liveProbability}
                          />
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
              <TableHead className="w-28 text-center">Win % Change</TableHead>
              <TableHead className="w-28 text-right">Est. W/L</TableHead>
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
                    <Badge variant="secondary" className="text-xs">
                      {bet.sport}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div>
                      <p className="font-medium">{bet.team}</p>
                      <p className="text-xs text-muted-foreground">{bet.betType}</p>
                      {liveStat && (
                        <div className="mt-1">
                          <LiveStatsBadge liveStat={liveStat} compact />
                        </div>
                      )}
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
                  <TableCell className="text-center">
                    {bet.status === "active" ? (
                      <LiveProbabilityBadge
                        baselineProbability={baselineProbability}
                        liveProbability={liveProbability}
                      />
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
                    {bet.status === "active" && !bet.clv && onFetchCLV && (
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8"
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
