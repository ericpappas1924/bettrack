import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { BetStatusBadge } from "./BetStatusBadge";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";

interface Bet {
  id: string;
  sport: string;
  betType: string;
  team: string;
  openingOdds: string;
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
  const formatCurrency = (value: string | null | undefined) => {
    if (!value) return "-";
    const num = parseFloat(value);
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

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-28">Date</TableHead>
            <TableHead className="w-20">Sport</TableHead>
            <TableHead className="w-32">Bet Type</TableHead>
            <TableHead>Team/Player</TableHead>
            <TableHead className="w-24 text-right">Odds</TableHead>
            <TableHead className="w-24 text-right">Stake</TableHead>
            <TableHead className="w-28">Status</TableHead>
            <TableHead className="w-24 text-right">P/L</TableHead>
            <TableHead className="w-20 text-right">CLV</TableHead>
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
            bets.map((bet) => (
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
                <TableCell className="text-sm">{bet.betType}</TableCell>
                <TableCell className="font-medium">{bet.team}</TableCell>
                <TableCell className="text-right tabular-nums text-sm">
                  {formatOdds(bet.openingOdds)}
                </TableCell>
                <TableCell className="text-right tabular-nums text-sm">
                  {formatCurrency(bet.stake)}
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
                <TableCell
                  className={`text-right tabular-nums text-sm ${
                    bet.clv && parseFloat(bet.clv) > 0
                      ? "text-green-600 dark:text-green-500"
                      : bet.clv && parseFloat(bet.clv) < 0
                      ? "text-red-600 dark:text-red-500"
                      : ""
                  }`}
                  data-testid={`text-clv-${bet.id}`}
                >
                  {formatCLV(bet.clv)}
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
