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
import { GameStatusBadge } from "./GameStatusBadge";
import { ParlayLegsBadge } from "./ParlayLegsBadge";
import { Badge } from "@/components/ui/badge";
import type { Sport } from "@shared/betTypes";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { format } from "date-fns";
import { Edit2, Check, X, Trophy, ThumbsDown, Minus, Calculator, RefreshCw, Trash2 } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
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
  expectedValue?: string | null;
  clvFetchError?: string | null;
  clvLastAttempt?: Date | string | null;
  projectionSource?: string | null;
  notes?: string | null;
  isFreePlay?: boolean | null;
  createdAt: Date | string;
  gameStartTime?: Date | string | null;
  settledAt?: Date | string | null;
}

interface BetDetailDialogProps {
  bet: Bet | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdateLiveOdds?: (betId: string, liveOdds: string) => void;
  onSettle?: (result: "won" | "lost" | "push") => void;
  onDelete?: (betId: string) => void;
}

export function BetDetailDialog({ bet, open, onOpenChange, onUpdateLiveOdds, onSettle, onDelete }: BetDetailDialogProps) {
  const { toast } = useToast();
  const [editingLiveOdds, setEditingLiveOdds] = useState(false);
  const [liveOddsInput, setLiveOddsInput] = useState("");
  const [editingClosingOdds, setEditingClosingOdds] = useState(false);
  const [closingOddsInput, setClosingOddsInput] = useState("");
  const [calculating, setCalculating] = useState(false);
  const [fetchingCLV, setFetchingCLV] = useState(false);

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

  const handleStartEditClosingOdds = () => {
    setClosingOddsInput(bet.closingOdds || bet.openingOdds);
    setEditingClosingOdds(true);
  };

  const handleSaveClosingOdds = async () => {
    if (!closingOddsInput) return;
    
    setCalculating(true);
    try {
      await apiRequest("POST", `/api/bets/${bet.id}/calculate-clv`, {
        closingOdds: closingOddsInput
      });
      
      queryClient.invalidateQueries({ queryKey: ["/api/bets"] });
      toast({
        title: "CLV calculated",
        description: "Closing odds and CLV have been updated",
      });
      setEditingClosingOdds(false);
      setClosingOddsInput("");
    } catch (error) {
      const errorMessage = (error as Error).message || '';
      let description = errorMessage;
      
      if (errorMessage.includes("401")) {
        description = "Session expired. Please refresh the page and try again.";
      }
      
      toast({
        title: "Failed to calculate CLV",
        description,
        variant: "destructive",
      });
    } finally {
      setCalculating(false);
    }
  };

  const handleAutoFetchCLV = async () => {
    setFetchingCLV(true);
    try {
      const res = await apiRequest("POST", `/api/bets/${bet.id}/auto-fetch-clv`, {});
      const updatedBet = await res.json();
      
      // Invalidate and refetch the bets list
      await queryClient.invalidateQueries({ queryKey: ["/api/bets"] });
      
      // Close and reopen the dialog to show fresh data
      onOpenChange(false);
      
      toast({
        title: "CLV fetched",
        description: `Closing odds: ${updatedBet.closingOdds}, CLV: ${updatedBet.clv}%, EV: ${formatCurrency(updatedBet.expectedValue)}`,
      });
    } catch (error) {
      const errorMessage = (error as Error).message || '';
      let description = "Could not find closing odds. Please enter manually.";
      
      if (errorMessage.includes("401")) {
        description = "Session expired. Please refresh the page and try again.";
      } else if (errorMessage.includes("legacy bet") || errorMessage.includes("Invalid game matchup")) {
        description = "This is an older bet without matchup info. Please enter closing odds manually.";
      } else if (errorMessage.includes("Could not find current odds")) {
        description = "Player props not yet supported for auto-fetch. Using any available game odds as fallback.";
      }
      
      toast({
        title: "Auto-fetch failed",
        description,
        variant: "destructive",
      });
    } finally {
      setFetchingCLV(false);
    }
  };

  const handleDelete = () => {
    if (onDelete && window.confirm('Are you sure you want to delete this bet? This cannot be undone.')) {
      onDelete(bet.id);
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] sm:max-h-[85vh] w-[95vw] sm:w-full flex flex-col gap-0 p-0">
        <DialogHeader className="px-4 sm:px-6 pt-4 sm:pt-6 pb-3 sm:pb-4 shrink-0">
          <div className="flex items-start justify-between gap-4 pr-8">
            <div className="flex-1 min-w-0">
              <DialogTitle className="text-2xl truncate">{bet.team}</DialogTitle>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <span className="text-sm text-muted-foreground">{bet.betType}</span>
                {bet.isFreePlay && (
                  <Badge className="bg-green-600 text-white text-xs">FREE PLAY</Badge>
                )}
              </div>
            </div>
            <BetStatusBadge status={bet.status} result={bet.result} />
          </div>
        </DialogHeader>

        <div className="space-y-4 px-4 sm:px-6 overflow-y-auto flex-1">
          {bet.status === "active" && (
            <Card className="border-primary/20 bg-primary/5">
              <CardHeader className="pb-2 flex flex-row items-center justify-between gap-2 space-y-0">
                <CardTitle className="text-lg">Live Performance</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-3 sm:gap-6">
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

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
            <div className="space-y-4">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Sport</p>
                <Badge variant="secondary">{bet.sport}</Badge>
              </div>

              {bet.gameStartTime && (
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Game Status</p>
                  <GameStatusBadge 
                    gameStartTime={bet.gameStartTime} 
                    sport={bet.sport as Sport}
                    betType={bet.betType}
                    notes={bet.notes}
                  />
                </div>
              )}

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
                {editingClosingOdds ? (
                  <div className="flex items-center gap-2 mt-1">
                    <Input
                      value={closingOddsInput}
                      onChange={(e) => setClosingOddsInput(e.target.value)}
                      placeholder="-110"
                      className="w-24"
                      data-testid="input-closing-odds"
                    />
                    <Button 
                      size="icon" 
                      variant="ghost" 
                      onClick={handleSaveClosingOdds}
                      disabled={calculating}
                    >
                      {calculating ? <Calculator className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                    </Button>
                    <Button 
                      size="icon" 
                      variant="ghost" 
                      onClick={() => setEditingClosingOdds(false)}
                      disabled={calculating}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <p className="text-lg font-semibold tabular-nums">{formatOdds(bet.closingOdds)}</p>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={handleStartEditClosingOdds}
                      data-testid="button-edit-closing-odds"
                      title="Manually enter closing odds"
                    >
                      <Edit2 className="h-4 w-4" />
                    </Button>
                    {!bet.closingOdds && (
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={handleAutoFetchCLV}
                        disabled={fetchingCLV}
                        data-testid="button-auto-fetch-clv"
                        title="Try to automatically fetch closing odds"
                      >
                        {fetchingCLV ? (
                          <RefreshCw className="h-4 w-4 animate-spin" />
                        ) : (
                          <RefreshCw className="h-4 w-4" />
                        )}
                      </Button>
                    )}
                  </div>
                )}
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
                <p className="text-sm text-muted-foreground mb-1">Expected Value (EV)</p>
                <p
                  className={`text-lg font-semibold tabular-nums ${
                    bet.expectedValue && parseFloat(bet.expectedValue) > 0
                      ? "text-green-600 dark:text-green-500"
                      : bet.expectedValue && parseFloat(bet.expectedValue) < 0
                      ? "text-red-600 dark:text-red-500"
                      : ""
                  }`}
                >
                  {formatCurrency(bet.expectedValue)}
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

              {bet.gameStartTime && (
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Game Time</p>
                  <p className="text-lg font-semibold">
                    {format(new Date(bet.gameStartTime), "MMM dd, yyyy h:mm a")}
                  </p>
                </div>
              )}

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
                <p className="text-sm text-muted-foreground mb-1">
                  {(bet.betType === 'Parlay' || bet.betType === 'Teaser' || bet.betType === 'Player Prop Parlay') ? 'Legs' : 'Notes'}
                </p>
                {(bet.betType === 'Parlay' || bet.betType === 'Teaser' || bet.betType === 'Player Prop Parlay') ? (
                  <ParlayLegsBadge notes={bet.notes} betType={bet.betType} />
                ) : (
                  <p className="text-base whitespace-pre-line">{bet.notes}</p>
                )}
              </div>
            </>
          )}
        </div>

        <DialogFooter className="px-4 sm:px-6 py-3 sm:py-4 gap-2 flex-col sm:flex-row shrink-0 border-t bg-background">
          {onDelete && (
            <Button
              variant="outline"
              className="border-red-500/50 text-red-600 hover:bg-red-500/10 sm:mr-auto"
              onClick={handleDelete}
              data-testid="button-delete-bet"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete Bet
            </Button>
          )}
          
          {bet.status === "active" && onSettle && (
            <>
              <p className="text-sm text-muted-foreground hidden sm:block">Mark as:</p>
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
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
