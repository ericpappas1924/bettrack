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
import { ParlayLiveProgress, type ParlayLiveStats } from "./ParlayLiveProgress";
import { RoundRobinSettlement } from "./RoundRobinSettlement";
import { isRoundRobin } from "@/lib/roundRobin";
import { Badge } from "@/components/ui/badge";
import type { Sport } from "@shared/betTypes";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { format } from "date-fns";
import { Edit2, Check, X, Trophy, ThumbsDown, Minus, Calculator, RefreshCw, Trash2, Banknote, Loader2 } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  americanToImpliedProbability,
  calculateExpectedValue,
  formatProbability,
} from "@/lib/betting";

interface PotdCategory {
  id: string;
  name: string;
  displayName: string;
  wins: number;
  losses: number;
  pushes: number;
  units: number;
  streak: number;
}

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
  playOfDayCategory?: string | null;
}

interface BetDetailDialogProps {
  bet: Bet | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdateLiveOdds?: (betId: string, liveOdds: string) => void;
  onSettle?: (result: "won" | "lost" | "push") => void;
  onDelete?: (betId: string) => void;
  parlayLiveStats?: ParlayLiveStats | null;
}

export function BetDetailDialog({ bet, open, onOpenChange, onUpdateLiveOdds, onSettle, onDelete, parlayLiveStats }: BetDetailDialogProps) {
  const { toast } = useToast();
  const [editingLiveOdds, setEditingLiveOdds] = useState(false);
  const [liveOddsInput, setLiveOddsInput] = useState("");
  const [editingClosingOdds, setEditingClosingOdds] = useState(false);
  const [closingOddsInput, setClosingOddsInput] = useState("");
  const [calculating, setCalculating] = useState(false);
  const [fetchingCLV, setFetchingCLV] = useState(false);
  const [showPotdSelect, setShowPotdSelect] = useState(false);
  const [selectedPotdCategory, setSelectedPotdCategory] = useState<string>("");

  // Fetch POTD categories
  const { data: potdCategories = [] } = useQuery<PotdCategory[]>({
    queryKey: ["/api/potd/categories"],
    enabled: open,
  });

  // Mark as POTD mutation
  const markPotdMutation = useMutation({
    mutationFn: async ({ betId, categoryId }: { betId: string; categoryId: string }) => {
      const res = await apiRequest("POST", `/api/bets/${betId}/mark-potd`, { categoryId });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/bets"] });
      queryClient.invalidateQueries({ queryKey: ["/api/potd/bets"] });
      toast({
        title: "Marked as Play of the Day",
        description: "This bet has been added to the POTD tracker.",
      });
      setShowPotdSelect(false);
      setSelectedPotdCategory("");
      // Close dialog to ensure fresh data on reopen
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to mark as POTD",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleMarkAsPotd = () => {
    if (!bet || !selectedPotdCategory) return;
    markPotdMutation.mutate({ betId: bet.id, categoryId: selectedPotdCategory });
  };

  // Settle individual round robin leg mutation
  const settleLegMutation = useMutation({
    mutationFn: async ({ betId, legIndex, result }: { betId: string; legIndex: number; result: 'won' | 'lost' | 'push' }) => {
      const res = await apiRequest("POST", `/api/bets/${betId}/settle-leg`, { legIndex, result });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/bets"] });
      toast({
        title: "Leg settled",
        description: "The leg has been marked as settled.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to settle leg",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Settle entire round robin mutation - server calculates profit from leg outcomes
  const settleRoundRobinMutation = useMutation({
    mutationFn: async ({ betId }: { betId: string }) => {
      const res = await apiRequest("POST", `/api/bets/${betId}/settle-round-robin`, {});
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/bets"] });
      toast({
        title: "Round robin settled",
        description: "All parlays have been calculated and the bet is now settled.",
      });
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to settle round robin",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSettleLeg = (legIndex: number, result: 'won' | 'lost' | 'push') => {
    if (!bet) return;
    settleLegMutation.mutate({ betId: bet.id, legIndex, result });
  };

  const handleSettleRoundRobin = () => {
    if (!bet) return;
    settleRoundRobinMutation.mutate({ betId: bet.id });
  };

  if (!bet) return null;

  // Extract the team/selection being bet on for CS2/esports moneyline bets
  // For CS2 bets, the team field often contains the full matchup (e.g., "Mouz vs Team Spirit")
  // but we need to show which team they're actually betting on
  const extractBettingSelection = (team: string, game: string | null | undefined, notes: string | null | undefined): { selection: string; isMatchupOnly: boolean } => {
    // Check if team field is just the matchup (contains " vs ")
    const isMatchup = team && team.includes(' vs ');
    
    if (isMatchup && game && team === game) {
      // Try to extract from notes - CS2 bets have format in notes or description
      // Look for pattern: "Winner (2 way) / TEAM_NAME" or similar
      if (notes) {
        const winnerMatch = notes.match(/Winner\s*\([^)]+\)\s*\/\s*([^/\n-]+?)(?:\s*[-+]\d|$)/i);
        if (winnerMatch) {
          return { selection: winnerMatch[1].trim(), isMatchupOnly: false };
        }
      }
      
      // Try to extract from team field if it has the full description
      // Format: "Team1 vs Team2 / Match / Winner (2 way) / Team2 -231"
      const fullDescMatch = team.match(/Winner\s*\([^)]+\)\s*\/\s*([^/\n-]+?)(?:\s*[-+]\d|$)/i);
      if (fullDescMatch) {
        return { selection: fullDescMatch[1].trim(), isMatchupOnly: false };
      }
      
      // Can't determine which team - show matchup
      return { selection: team, isMatchupOnly: true };
    }
    
    // Not a matchup-only field, use as-is
    return { selection: team, isMatchupOnly: false };
  };

  const { selection: bettingSelection, isMatchupOnly } = extractBettingSelection(bet.team, bet.game, bet.notes);

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
      <DialogContent className="max-w-3xl max-h-[85vh] sm:max-h-[85vh] w-[95vw] sm:w-full flex flex-col gap-0 p-0 overflow-hidden">
        <DialogHeader className="px-3 sm:px-6 pt-3 sm:pt-6 pb-2 sm:pb-4 shrink-0">
          <div className="flex items-start justify-between gap-2 sm:gap-4 pr-8">
            <div className="flex-1 min-w-0">
              <DialogTitle className="text-lg sm:text-2xl truncate">
                {isMatchupOnly ? bet.game || bet.team : bettingSelection}
              </DialogTitle>
              {isMatchupOnly && (
                <p className="text-xs sm:text-sm text-muted-foreground mt-1">
                  Betting on: {bettingSelection}
                </p>
              )}
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <span className="text-xs sm:text-sm text-muted-foreground">{bet.betType}</span>
                {bet.isFreePlay && (
                  <Badge className="bg-green-600 text-white text-xs">FREE PLAY</Badge>
                )}
              </div>
            </div>
            <BetStatusBadge status={bet.status} result={bet.result} />
          </div>
        </DialogHeader>

        <div className="space-y-3 sm:space-y-4 px-3 sm:px-6 overflow-y-auto flex-1 pb-2">
          {bet.status === "active" && (
            <Card className="border-primary/20 bg-primary/5">
              <CardHeader className="pb-2 flex flex-row items-center justify-between gap-2 space-y-0 px-3 sm:px-6">
                <CardTitle className="text-base sm:text-lg">Live Performance</CardTitle>
              </CardHeader>
              <CardContent className="px-3 sm:px-6">
                <div className="grid grid-cols-2 gap-2 sm:gap-6">
                  <div className="text-center">
                    <p className="text-xs sm:text-sm text-muted-foreground mb-1">Win % Change</p>
                    <LiveProbabilityBadge
                      baselineProbability={baselineProbability}
                      liveProbability={liveProbability}
                    />
                  </div>
                  <div className="text-center">
                    <p className="text-xs sm:text-sm text-muted-foreground mb-1">Current Win %</p>
                    <p className="text-lg sm:text-2xl font-bold tabular-nums">
                      {formatProbability(liveProbability)}
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

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-6">
            <div className="space-y-3 sm:space-y-4">
              <div>
                <p className="text-xs sm:text-sm text-muted-foreground mb-1">Sport</p>
                <Badge variant="secondary" className="text-xs">{bet.sport}</Badge>
              </div>

              {bet.gameStartTime && (
                <div>
                  <p className="text-xs sm:text-sm text-muted-foreground mb-1">Game Status</p>
                  <GameStatusBadge
                    gameStartTime={bet.gameStartTime}
                    sport={bet.sport as Sport}
                    betType={bet.betType}
                    notes={bet.notes}
                    betStatus={bet.status}
                  />
                </div>
              )}

              {bet.game && (
                <div>
                  <p className="text-xs sm:text-sm text-muted-foreground mb-1">Game</p>
                  <p className="text-sm sm:text-base">{bet.game}</p>
                </div>
              )}

              {/* Show betting selection clearly for moneyline bets */}
              {(bet.betType === 'Straight' || bet.betType === 'Live') && bet.game && bettingSelection !== bet.game && (
                <div>
                  <p className="text-xs sm:text-sm text-muted-foreground mb-1">Betting On</p>
                  <p className="text-sm sm:text-base font-semibold">{bettingSelection}</p>
                </div>
              )}

              <div>
                <p className="text-xs sm:text-sm text-muted-foreground mb-1">Opening Odds</p>
                <p className="text-base sm:text-lg font-semibold tabular-nums">{formatOdds(bet.openingOdds)}</p>
              </div>

              <div>
                <p className="text-xs sm:text-sm text-muted-foreground mb-1">Closing Odds</p>
                {editingClosingOdds ? (
                  <div className="flex items-center gap-1 sm:gap-2 mt-1">
                    <Input
                      value={closingOddsInput}
                      onChange={(e) => setClosingOddsInput(e.target.value)}
                      placeholder="-110"
                      className="w-20 sm:w-24 h-8"
                      data-testid="input-closing-odds"
                    />
                    <Button 
                      size="icon" 
                      variant="ghost" 
                      onClick={handleSaveClosingOdds}
                      disabled={calculating}
                      className="h-8 w-8"
                    >
                      {calculating ? <Calculator className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                    </Button>
                    <Button 
                      size="icon" 
                      variant="ghost" 
                      onClick={() => setEditingClosingOdds(false)}
                      disabled={calculating}
                      className="h-8 w-8"
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center gap-1 sm:gap-2">
                    <p className="text-base sm:text-lg font-semibold tabular-nums">{formatOdds(bet.closingOdds)}</p>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={handleStartEditClosingOdds}
                      data-testid="button-edit-closing-odds"
                      title="Manually enter closing odds"
                      className="h-7 w-7 sm:h-8 sm:w-8"
                    >
                      <Edit2 className="h-3 w-3" />
                    </Button>
                    {!bet.closingOdds && (
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={handleAutoFetchCLV}
                        disabled={fetchingCLV}
                        data-testid="button-auto-fetch-clv"
                        title="Try to automatically fetch closing odds"
                        className="h-7 w-7 sm:h-8 sm:w-8"
                      >
                        {fetchingCLV ? (
                          <RefreshCw className="h-3 w-3 animate-spin" />
                        ) : (
                          <RefreshCw className="h-3 w-3" />
                        )}
                      </Button>
                    )}
                  </div>
                )}
              </div>

              <div>
                <p className="text-xs sm:text-sm text-muted-foreground mb-1">Stake</p>
                <p className="text-base sm:text-lg font-semibold tabular-nums">{formatCurrency(bet.stake)}</p>
              </div>

              {bet.potentialWin && (
                <div>
                  <p className="text-xs sm:text-sm text-muted-foreground mb-1">Potential Win</p>
                  <p className="text-base sm:text-lg font-semibold tabular-nums">{formatCurrency(bet.potentialWin)}</p>
                </div>
              )}
            </div>

            <div className="space-y-3 sm:space-y-4">
              <div>
                <p className="text-xs sm:text-sm text-muted-foreground mb-1">CLV</p>
                <p
                  className={`text-base sm:text-lg font-semibold tabular-nums ${
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
                <p className="text-xs sm:text-sm text-muted-foreground mb-1">Expected Value</p>
                <p
                  className={`text-base sm:text-lg font-semibold tabular-nums ${
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
                <p className="text-xs sm:text-sm text-muted-foreground mb-1">Profit/Loss</p>
                <p
                  className={`text-base sm:text-lg font-semibold tabular-nums ${
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
                <p className="text-xs sm:text-sm text-muted-foreground mb-1">Placed On</p>
                <p className="text-sm sm:text-lg font-semibold">
                  {format(new Date(bet.createdAt), "MMM dd, yyyy")}
                </p>
              </div>

              {bet.gameStartTime && (
                <div>
                  <p className="text-xs sm:text-sm text-muted-foreground mb-1">Game Time</p>
                  <p className="text-sm sm:text-lg font-semibold">
                    {format(new Date(bet.gameStartTime), "MMM dd h:mm a")}
                  </p>
                </div>
              )}

              {bet.settledAt && (
                <div>
                  <p className="text-xs sm:text-sm text-muted-foreground mb-1">Settled On</p>
                  <p className="text-sm sm:text-lg font-semibold">
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
                <p className="text-xs sm:text-sm text-muted-foreground mb-1">Projection Source</p>
                <p className="text-sm sm:text-base">{bet.projectionSource}</p>
              </div>
            </>
          )}

          {/* Round Robin Settlement UI */}
          {bet.notes && isRoundRobin(bet.betType) && bet.status === "active" && (
            <>
              <Separator />
              <div>
                <p className="text-xs sm:text-sm text-muted-foreground mb-1">Round Robin Legs</p>
                <RoundRobinSettlement
                  betType={bet.betType}
                  totalStake={parseFloat(bet.stake)}
                  notes={bet.notes}
                  onSettleLeg={handleSettleLeg}
                  onSettleAll={handleSettleRoundRobin}
                  isSettling={settleLegMutation.isPending || settleRoundRobinMutation.isPending}
                />
              </div>
            </>
          )}

          {bet.notes && !isRoundRobin(bet.betType) && (
            <>
              <Separator />
              <div>
                <p className="text-xs sm:text-sm text-muted-foreground mb-1">
                  {(bet.betType === 'Parlay' || bet.betType === 'Teaser' || bet.betType === 'Player Prop Parlay') ? 'Legs' : 'Notes'}
                </p>
                {(bet.betType === 'Parlay' || bet.betType === 'Teaser' || bet.betType === 'Player Prop Parlay') ? (
                  parlayLiveStats && parlayLiveStats.legs.length > 0 ? (
                    <ParlayLiveProgress parlayStats={parlayLiveStats} />
                  ) : (
                    <ParlayLegsBadge notes={bet.notes} betType={bet.betType} />
                  )
                ) : (
                  <p className="text-sm sm:text-base whitespace-pre-line">{bet.notes}</p>
                )}
              </div>
            </>
          )}

          {/* POTD Section */}
          {bet.status === "active" && !bet.playOfDayCategory && (
            <>
              <Separator />
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-xs sm:text-sm text-muted-foreground">Play of the Day</p>
                  {!showPotdSelect && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowPotdSelect(true)}
                      data-testid="button-show-potd-select"
                      className="text-amber-600 border-amber-500/50 hover:bg-amber-500/10"
                    >
                      <Banknote className="h-3 w-3 mr-1" />
                      <span className="text-xs sm:text-sm">Mark as POTD</span>
                    </Button>
                  )}
                </div>
                {showPotdSelect && (
                  <div className="flex items-center gap-2 flex-wrap">
                    <Select value={selectedPotdCategory} onValueChange={setSelectedPotdCategory}>
                      <SelectTrigger className="w-48" data-testid="select-potd-category-dialog">
                        <SelectValue placeholder="Select category" />
                      </SelectTrigger>
                      <SelectContent>
                        {potdCategories.map((cat) => (
                          <SelectItem key={cat.id} value={cat.id}>{cat.displayName}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      size="sm"
                      onClick={handleMarkAsPotd}
                      disabled={!selectedPotdCategory || markPotdMutation.isPending}
                      className="bg-amber-600 hover:bg-amber-700"
                      data-testid="button-confirm-potd"
                    >
                      {markPotdMutation.isPending ? (
                        <Loader2 className="h-3 w-3 animate-spin mr-1" />
                      ) : (
                        <Check className="h-3 w-3 mr-1" />
                      )}
                      Confirm
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setShowPotdSelect(false);
                        setSelectedPotdCategory("");
                      }}
                      data-testid="button-cancel-potd"
                    >
                      Cancel
                    </Button>
                  </div>
                )}
              </div>
            </>
          )}

          {/* Show if already marked as POTD */}
          {bet.playOfDayCategory && (
            <>
              <Separator />
              <div className="flex items-center gap-2">
                <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400 flex items-center gap-1">
                  <Banknote className="h-3 w-3" />
                  Play of the Day
                </Badge>
                <span className="text-xs text-muted-foreground">
                  {potdCategories.find(c => c.id === bet.playOfDayCategory)?.displayName || 'Loading...'}
                </span>
              </div>
            </>
          )}
        </div>

        <DialogFooter className="px-3 sm:px-6 py-2 sm:py-4 gap-2 shrink-0 border-t bg-background">
          {onDelete && (
            <Button
              variant="outline"
              size="sm"
              className="border-red-500/50 text-red-600 hover:bg-red-500/10 sm:mr-auto w-full sm:w-auto"
              onClick={handleDelete}
              data-testid="button-delete-bet"
            >
              <Trash2 className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
              <span className="text-xs sm:text-sm">Delete</span>
            </Button>
          )}
          
          {bet.status === "active" && onSettle && (
            <div className="flex gap-2 w-full sm:w-auto">
              <Button
                variant="outline"
                size="sm"
                onClick={() => onSettle("push")}
                data-testid="button-settle-push"
                className="flex-1 sm:flex-none"
              >
                <Minus className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
                <span className="text-xs sm:text-sm">Push</span>
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="border-red-500/50 text-red-600 hover:bg-red-500/10 flex-1 sm:flex-none"
                onClick={() => onSettle("lost")}
                data-testid="button-settle-lost"
              >
                <ThumbsDown className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
                <span className="text-xs sm:text-sm">Lost</span>
              </Button>
              <Button
                size="sm"
                className="bg-green-600 hover:bg-green-700 flex-1 sm:flex-none"
                onClick={() => onSettle("won")}
                data-testid="button-settle-won"
              >
                <Trophy className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
                <span className="text-xs sm:text-sm">Won</span>
              </Button>
            </div>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
