import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { BetStatusBadge } from "./BetStatusBadge";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { format } from "date-fns";
import { Calendar, TrendingUp, DollarSign, Target } from "lucide-react";

interface Bet {
  id: string;
  sport: string;
  betType: string;
  team: string;
  openingOdds: string;
  closingOdds?: string | null;
  stake: string;
  status: string;
  result?: string | null;
  profit?: string | null;
  clv?: string | null;
  projectionSource?: string | null;
  notes?: string | null;
  createdAt: Date | string;
  settledAt?: Date | string | null;
}

interface BetDetailDialogProps {
  bet: Bet | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function BetDetailDialog({ bet, open, onOpenChange }: BetDetailDialogProps) {
  if (!bet) return null;

  const formatCurrency = (value: string | null | undefined) => {
    if (!value) return "-";
    const num = parseFloat(value);
    return num >= 0 ? `$${num.toFixed(2)}` : `-$${Math.abs(num).toFixed(2)}`;
  };

  const formatOdds = (odds: string | null | undefined) => {
    if (!odds) return "-";
    const num = parseFloat(odds);
    return num > 0 ? `+${num}` : num.toString();
  };

  const formatCLV = (clv: string | null | undefined) => {
    if (!clv) return "-";
    const num = parseFloat(clv);
    return num >= 0 ? `+${num.toFixed(1)}%` : `${num.toFixed(1)}%`;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <div className="flex items-start justify-between gap-4">
            <div>
              <DialogTitle className="text-2xl">{bet.team}</DialogTitle>
              <p className="text-muted-foreground mt-1">{bet.betType}</p>
            </div>
            <BetStatusBadge status={bet.status} result={bet.result} />
          </div>
        </DialogHeader>

        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-4">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Sport</p>
                <Badge variant="secondary">{bet.sport}</Badge>
              </div>

              <div>
                <p className="text-sm text-muted-foreground mb-1">Opening Odds</p>
                <p className="text-lg font-semibold tabular-nums">{formatOdds(bet.openingOdds)}</p>
              </div>

              <div>
                <p className="text-sm text-muted-foreground mb-1">Closing Odds</p>
                <p className="text-lg font-semibold tabular-nums">{formatOdds(bet.closingOdds)}</p>
              </div>

              <div>
                <p className="text-sm text-muted-foreground mb-1">Stake</p>
                <p className="text-lg font-semibold tabular-nums">{formatCurrency(bet.stake)}</p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <p className="text-sm text-muted-foreground mb-1">CLV (Closing Line Value)</p>
                <p
                  className={`text-lg font-semibold tabular-nums ${
                    bet.clv && parseFloat(bet.clv) > 0
                      ? "text-green-600 dark:text-green-500"
                      : bet.clv && parseFloat(bet.clv) < 0
                      ? "text-red-600 dark:text-red-500"
                      : ""
                  }`}
                >
                  {formatCLV(bet.clv)}
                </p>
              </div>

              <div>
                <p className="text-sm text-muted-foreground mb-1">Profit/Loss</p>
                <p
                  className={`text-lg font-semibold tabular-nums ${
                    bet.profit && parseFloat(bet.profit) > 0
                      ? "text-green-600 dark:text-green-500"
                      : bet.profit && parseFloat(bet.profit) < 0
                      ? "text-red-600 dark:text-red-500"
                      : ""
                  }`}
                >
                  {formatCurrency(bet.profit)}
                </p>
              </div>

              <div>
                <p className="text-sm text-muted-foreground mb-1">Placed On</p>
                <p className="text-lg font-semibold">
                  {format(new Date(bet.createdAt), "MMM dd, yyyy")}
                </p>
              </div>

              {bet.settledAt && (
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Settled On</p>
                  <p className="text-lg font-semibold">
                    {format(new Date(bet.settledAt), "MMM dd, yyyy")}
                  </p>
                </div>
              )}
            </div>
          </div>

          {bet.projectionSource && (
            <>
              <Separator />
              <div>
                <p className="text-sm text-muted-foreground mb-1">Projection Source</p>
                <p className="text-base">{bet.projectionSource}</p>
              </div>
            </>
          )}

          {bet.notes && (
            <>
              <Separator />
              <div>
                <p className="text-sm text-muted-foreground mb-1">Notes</p>
                <p className="text-base">{bet.notes}</p>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
