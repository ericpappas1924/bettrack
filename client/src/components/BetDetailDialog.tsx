import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { BetStatusBadge } from "./BetStatusBadge";
import { LiveProbabilityBadge } from "./LiveProbabilityBadge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { format } from "date-fns";
import { Edit2, Check, X, Trophy, ThumbsDown, Minus } from "lucide-react";
import {
  americanToImpliedProbability,
  calculateExpectedValue,
  formatProbability,
} from "@/lib/betting";

interface Bet {
  id: string;
  sport: string;
  betType: string;
  team: string;
  game?: string | null;
  openingOdds: string;
  liveOdds?: string | null;
  closingOdds?: string | null;
  stake: string;
  potentialWin?: string | null;
  status: string;
  result?: string | null;
  profit?: string | null;
  clv?: string | null;
  projectionSource?: string | null;
  notes?: string | null;
  isFreePlay?: boolean;
  createdAt: Date | string;
  settledAt?: Date | string | null;
}

interface BetDetailDialogProps {
  bet: Bet | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdateLiveOdds?: (betId: string, liveOdds: string) => void;
  onSettle?: (result: "won" | "lost" | "push") => void;
}

export function BetDetailDialog({ bet, open, onOpenChange, onUpdateLiveOdds, onSettle }: BetDetailDialogProps) {
  const [editingLiveOdds, setEditingLiveOdds] = useState(false);
  const [liveOddsInput, setLiveOddsInput] = useState("");

  if (!bet) return null;

  const formatCurrency = (value: string | number | null | undefined) => {
    if (value === null || value === undefined) return "-";
    const num = typeof value === "string" ? parseFloat(value) : value;
    if (isNaN(num)) return "-";
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

  const openingOdds = parseFloat(bet.openingOdds);
  const baselineProbability = americanToImpliedProbability(openingOdds);
  
  const liveOddsNum = bet.liveOdds ? parseFloat(bet.liveOdds) : openingOdds;
  const liveProbability = americanToImpliedProbability(liveOddsNum);
  
  const stake = parseFloat(bet.stake);
  const estimatedEV = calculateExpectedValue(stake, liveOddsNum, liveProbability);

  const handleSaveLiveOdds = () => {
    if (liveOddsInput && onUpdateLiveOdds) {
      onUpdateLiveOdds(bet.id, liveOddsInput);
    }
    setEditingLiveOdds(false);
    setLiveOddsInput("");
  };

  const handleStartEditLiveOdds = () => {
    setLiveOddsInput(bet.liveOdds || bet.openingOdds);
    setEditingLiveOdds(true);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-start justify-between gap-4">
            <div>
              <DialogTitle className="text-2xl">{bet.team}</DialogTitle>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-muted-foreground">{bet.betType}</span>
                {bet.isFreePlay && (
                  <Badge className="bg-green-600 text-white">FREE PLAY</Badge>
                )}
              </div>
            </div>
            <BetStatusBadge status={bet.status} result={bet.result} />
          </div>
        </DialogHeader>

        <div className="space-y-6">
          {bet.status === "active" && (
            <Card className="border-primary/20 bg-primary/5">
              <CardHeader className="pb-2 flex flex-row items-center justify-between gap-2 space-y-0">
                <CardTitle className="text-lg">Live Performance</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-6">
                  <div className="text-center">
                    <p className="text-sm text-muted-foreground mb-1">Win % Change</p>
                    <LiveProbabilityBadge
                      baselineProbability={baselineProbability}
                      liveProbability={liveProbability}
                    />
                  </div>
                  <div className="text-center">
                    <p className="text-sm text-muted-foreground mb-1">Current Win %</p>
                    <p className="text-2xl font-bold tabular-nums">
                      {formatProbability(liveProbability)}
                    </p>
                  </div>
                  <div className="text-center">
                    <p className="text-sm text-muted-foreground mb-1">Estimated W/L</p>
                    <p
                      className={`text-2xl font-bold tabular-nums ${
                        estimatedEV > 0
                          ? "text-green-600 dark:text-green-500"
                          : estimatedEV < 0
                          ? "text-red-600 dark:text-red-500"
                          : ""
                      }`}
                    >
                      {formatCurrency(estimatedEV)}
                    </p>
                  </div>
                </div>

                <Separator className="my-4" />

                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Live Odds</p>
                    {editingLiveOdds ? (
                      <div className="flex items-center gap-2 mt-1">
                        <Input
                          value={liveOddsInput}
                          onChange={(e) => setLiveOddsInput(e.target.value)}
                          placeholder="-110"
                          className="w-24"
                          data-testid="input-live-odds"
                        />
                        <Button size="icon" variant="ghost" onClick={handleSaveLiveOdds}>
                          <Check className="h-4 w-4" />
                        </Button>
                        <Button size="icon" variant="ghost" onClick={() => setEditingLiveOdds(false)}>
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <p className="text-lg font-semibold tabular-nums">
                          {formatOdds(bet.liveOdds || bet.openingOdds)}
                        </p>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={handleStartEditLiveOdds}
                          data-testid="button-edit-live-odds"
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-muted-foreground">Opening Win %</p>
                    <p className="text-lg font-semibold tabular-nums">
                      {formatProbability(baselineProbability)}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-4">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Sport</p>
                <Badge variant="secondary">{bet.sport}</Badge>
              </div>

              {bet.game && (
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Game</p>
                  <p className="text-base">{bet.game}</p>
                </div>
              )}

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

              {bet.potentialWin && (
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Potential Win</p>
                  <p className="text-lg font-semibold tabular-nums">{formatCurrency(bet.potentialWin)}</p>
                </div>
              )}
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
                <p className="text-base whitespace-pre-line">{bet.notes}</p>
              </div>
            </>
          )}
        </div>

        {bet.status === "active" && onSettle && (
          <DialogFooter className="mt-6 gap-2">
            <p className="text-sm text-muted-foreground mr-auto">Mark as:</p>
            <Button
              variant="outline"
              onClick={() => onSettle("push")}
              data-testid="button-settle-push"
            >
              <Minus className="h-4 w-4 mr-2" />
              Push
            </Button>
            <Button
              variant="outline"
              className="border-red-500/50 text-red-600 hover:bg-red-500/10"
              onClick={() => onSettle("lost")}
              data-testid="button-settle-lost"
            >
              <ThumbsDown className="h-4 w-4 mr-2" />
              Lost
            </Button>
            <Button
              className="bg-green-600 hover:bg-green-700"
              onClick={() => onSettle("won")}
              data-testid="button-settle-won"
            >
              <Trophy className="h-4 w-4 mr-2" />
              Won
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
