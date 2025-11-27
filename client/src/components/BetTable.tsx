import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { BetStatusBadge } from "./BetStatusBadge";
import { LiveProbabilityBadge } from "./LiveProbabilityBadge";
import { Badge } from "@/components/ui/badge";
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
  status: string;
  result?: string | null;
  profit?: string | null;
  clv?: string | null;
  createdAt: Date | string;
}

interface BetTableProps {
  bets: Bet[];
  onRowClick?: (bet: Bet) => void;
}

export function BetTable({ bets, onRowClick }: BetTableProps) {
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

  const formatCLV = (clv: string | null | undefined) => {
    if (!clv) return "-";
    const num = parseFloat(clv);
    return num >= 0 ? `+${num.toFixed(1)}%` : `${num.toFixed(1)}%`;
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

  return (
    <div className="rounded-md border overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-24">Date</TableHead>
            <TableHead className="w-20">Sport</TableHead>
            <TableHead>Team/Player</TableHead>
            <TableHead className="w-24 text-right">Odds</TableHead>
            <TableHead className="w-24 text-right">Stake</TableHead>
            <TableHead className="w-28 text-center">Win % Change</TableHead>
            <TableHead className="w-28 text-right">Est. W/L</TableHead>
            <TableHead className="w-24">Status</TableHead>
            <TableHead className="w-24 text-right">P/L</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {bets.length === 0 ? (
            <TableRow>
              <TableCell colSpan={9} className="h-24 text-center text-muted-foreground">
                No bets found
              </TableCell>
            </TableRow>
          ) : (
            bets.map((bet) => {
              const { baselineProbability, liveProbability } = getWinProbabilities(bet);
              const estimatedEV = bet.status === "active" ? getEstimatedEV(bet) : null;

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
                  <TableCell>
                    <Badge variant="secondary" className="text-xs">
                      {bet.sport}
                    </Badge>
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
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>
    </div>
  );
}
