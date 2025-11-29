import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { MetricCard } from "@/components/MetricCard";
import { BetTable } from "@/components/BetTable";
import { BetFilters } from "@/components/BetFilters";
import { AddBetDialog } from "@/components/AddBetDialog";
import { BetDetailDialog } from "@/components/BetDetailDialog";
import { ImportBetsDialog } from "@/components/ImportBetsDialog";
import { EmptyState } from "@/components/EmptyState";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import type { LiveStat } from "@/components/LiveStatsBadge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Plus, DollarSign, TrendingUp, Target, BarChart3, Zap, Upload, Loader2, LogOut, User, RefreshCw } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import type { Bet } from "@shared/schema";
import {
  americanToImpliedProbability,
  calculateExpectedValue,
} from "@/lib/betting";

export default function Dashboard() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [addBetOpen, setAddBetOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [detailBet, setDetailBet] = useState<Bet | null>(null);
  const [sport, setSport] = useState("all");
  const [status, setStatus] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  const { data: bets = [], isLoading } = useQuery<Bet[]>({
    queryKey: ["/api/bets"],
  });

  // Fetch live stats for active bets
  const { data: liveStats = [], refetch: refetchLiveStats } = useQuery<LiveStat[]>({
    queryKey: ["/api/bets/live-stats"],
    refetchInterval: 60000, // Refetch every 60 seconds
    enabled: bets.some((bet) => bet.status === "active" && bet.betType === "Player Prop"),
  });

  // Auto-refresh live stats periodically
  useEffect(() => {
    const hasActiveBets = bets.some((bet) => bet.status === "active" && bet.betType === "Player Prop");
    if (hasActiveBets) {
      const interval = setInterval(() => {
        refetchLiveStats();
      }, 60000); // Every 60 seconds
      
      return () => clearInterval(interval);
    }
  }, [bets, refetchLiveStats]);

  const importMutation = useMutation({
    mutationFn: async (importedBets: any[]) => {
      const res = await apiRequest("POST", "/api/bets/import", importedBets);
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/bets"] });
      toast({
        title: "Bets imported",
        description: `Successfully imported ${data.length} bets`,
      });
    },
    onError: (error: Error) => {
      if (isUnauthorizedError(error)) {
        toast({ title: "Session expired", description: "Please log in again", variant: "destructive" });
        setTimeout(() => { window.location.href = "/api/login"; }, 500);
        return;
      }
      toast({ title: "Import failed", description: error.message, variant: "destructive" });
    },
  });

  const updateBetMutation = useMutation({
    mutationFn: async ({ id, ...data }: { id: string; liveOdds?: string }) => {
      const res = await apiRequest("PATCH", `/api/bets/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/bets"] });
    },
    onError: (error: Error) => {
      if (isUnauthorizedError(error)) {
        toast({ title: "Session expired", description: "Please log in again", variant: "destructive" });
        setTimeout(() => { window.location.href = "/api/login"; }, 500);
        return;
      }
      toast({ title: "Update failed", description: error.message, variant: "destructive" });
    },
  });

  const settleBetMutation = useMutation({
    mutationFn: async ({ id, result }: { id: string; result: "won" | "lost" | "push" }) => {
      const res = await apiRequest("POST", `/api/bets/${id}/settle`, { result });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/bets"] });
      setDetailBet(null);
      toast({ title: "Bet settled", description: "The bet has been marked as settled" });
    },
    onError: (error: Error) => {
      if (isUnauthorizedError(error)) {
        toast({ title: "Session expired", description: "Please log in again", variant: "destructive" });
        setTimeout(() => { window.location.href = "/api/login"; }, 500);
        return;
      }
      toast({ title: "Settlement failed", description: error.message, variant: "destructive" });
    },
  });

  const filteredBets = bets.filter((bet) => {
    const matchesSport = sport === "all" || bet.sport === sport;
    const matchesStatus = status === "all" || bet.status === status;
    const matchesSearch =
      searchQuery === "" ||
      bet.team.toLowerCase().includes(searchQuery.toLowerCase()) ||
      bet.betType.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (bet.game && bet.game.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesSport && matchesStatus && matchesSearch;
  });

  const activeBets = bets.filter((bet) => bet.status === "active");
  const settledBets = bets.filter((bet) => bet.status === "settled");

  const totalPL = settledBets.reduce(
    (sum, bet) => sum + (bet.profit ? parseFloat(bet.profit) : 0),
    0
  );

  const wins = settledBets.filter((bet) => bet.result === "won").length;
  const winRate = settledBets.length > 0 ? (wins / settledBets.length) * 100 : 0;

  const totalStaked = settledBets.reduce(
    (sum, bet) => sum + parseFloat(bet.stake),
    0
  );
  const roi = totalStaked > 0 ? (totalPL / totalStaked) * 100 : 0;

  const totalAtRisk = activeBets.reduce(
    (sum, bet) => sum + parseFloat(bet.stake),
    0
  );

  const totalPotentialWin = activeBets.reduce(
    (sum, bet) => sum + (bet.potentialWin ? parseFloat(bet.potentialWin) : 0),
    0
  );

  const totalLiveEV = activeBets.reduce((sum, bet) => {
    const openingOdds = parseFloat(bet.openingOdds);
    const liveOdds = bet.liveOdds ? parseFloat(bet.liveOdds) : openingOdds;
    const stake = parseFloat(bet.stake);
    const liveProbability = americanToImpliedProbability(liveOdds);
    return sum + calculateExpectedValue(stake, liveOdds, liveProbability);
  }, 0);

  const handleAddBet = async (data: any) => {
    try {
      // Convert gameStartTime from string to Date if provided
      const betData = {
        ...data,
        gameStartTime: data.gameStartTime ? new Date(data.gameStartTime).toISOString() : null,
      };
      
      const res = await apiRequest("POST", "/api/bets", betData);
      await res.json();
      
      queryClient.invalidateQueries({ queryKey: ["/api/bets"] });
      toast({
        title: "Bet added",
        description: "Your bet has been successfully added",
      });
      setAddBetOpen(false);
    } catch (error) {
      if (isUnauthorizedError(error as Error)) {
        toast({ title: "Session expired", description: "Please log in again", variant: "destructive" });
        setTimeout(() => { window.location.href = "/api/login"; }, 500);
        return;
      }
      toast({
        title: "Failed to add bet",
        description: (error as Error).message,
        variant: "destructive",
      });
    }
  };

  const handleImportBets = (importedBets: any[]) => {
    const formattedBets = importedBets.map((bet) => ({
      externalId: bet.id,
      sport: bet.sport,
      betType: bet.betType,
      team: bet.team,
      game: bet.game || null,
      openingOdds: bet.openingOdds,
      liveOdds: bet.liveOdds || null,
      closingOdds: bet.closingOdds || null,
      stake: bet.stake,
      potentialWin: bet.potentialWin || null,
      status: bet.status,
      result: bet.result || null,
      profit: bet.profit || null,
      clv: bet.clv || null,
      projectionSource: bet.projectionSource || null,
      notes: bet.notes || null,
      isFreePlay: bet.isFreePlay || false,
      gameStartTime: bet.gameStartTime ? new Date(bet.gameStartTime) : null,
      settledAt: bet.settledAt ? new Date(bet.settledAt) : null,
    }));
    importMutation.mutate(formattedBets);
    setImportOpen(false);
  };

  const handleClearFilters = () => {
    setSport("all");
    setStatus("all");
    setSearchQuery("");
  };

  const handleUpdateLiveOdds = (betId: string, liveOdds: string) => {
    updateBetMutation.mutate({ id: betId, liveOdds });
    if (detailBet && detailBet.id === betId) {
      setDetailBet({ ...detailBet, liveOdds });
    }
  };

  const handleSettleBet = (result: "won" | "lost" | "push") => {
    if (detailBet) {
      settleBetMutation.mutate({ id: detailBet.id, result });
    }
  };

  const getUserInitials = () => {
    if (user?.firstName && user?.lastName) {
      return `${user.firstName[0]}${user.lastName[0]}`.toUpperCase();
    }
    if (user?.email) {
      return user.email[0].toUpperCase();
    }
    return "U";
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20 md:pb-0">
      {/* Header */}
      <header className="border-b sticky top-0 bg-background z-50">
        <div className="flex items-center justify-between px-4 py-3 max-w-7xl mx-auto">
          <div>
            <h1 className="text-xl font-bold">BetTrack</h1>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="rounded-full" data-testid="button-user-menu">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={user?.profileImageUrl || undefined} alt={user?.firstName || "User"} />
                    <AvatarFallback>{getUserInitials()}</AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem disabled>
                  <User className="h-4 w-4 mr-2" />
                  {user?.email || "User"}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <a href="/api/logout" data-testid="button-logout">
                    <LogOut className="h-4 w-4 mr-2" />
                    Sign Out
                  </a>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      <main className="px-4 py-6 max-w-7xl mx-auto">
        <div className="space-y-6">
          {/* Metrics Grid - Scrollable on mobile */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <MetricCard
              label="Total P/L"
              value={`${totalPL >= 0 ? "$" : "-$"}${Math.abs(totalPL).toFixed(2)}`}
              trend={settledBets.length > 0 ? { value: `${roi >= 0 ? '+' : ''}${roi.toFixed(1)}%`, positive: totalPL >= 0 } : undefined}
              icon={<DollarSign className="h-4 w-4" />}
            />
            <MetricCard
              label="Win Rate"
              value={settledBets.length > 0 ? `${winRate.toFixed(0)}%` : "-"}
              trend={settledBets.length > 0 ? { value: `${wins}/${settledBets.length}`, positive: winRate >= 50 } : undefined}
              icon={<Target className="h-4 w-4" />}
            />
            <MetricCard
              label="Active"
              value={activeBets.length.toString()}
              trend={activeBets.length > 0 ? { value: `$${totalAtRisk.toFixed(0)}`, positive: true } : undefined}
              icon={<BarChart3 className="h-4 w-4" />}
            />
            <MetricCard
              label="To Win"
              value={`$${totalPotentialWin.toFixed(0)}`}
              trend={activeBets.length > 0 ? { value: `${activeBets.length} bets`, positive: true } : undefined}
              icon={<TrendingUp className="h-4 w-4" />}
            />
            <MetricCard
              label="Est. EV"
              value={`${totalLiveEV >= 0 ? "$" : "-$"}${Math.abs(totalLiveEV).toFixed(0)}`}
              trend={activeBets.length > 0 ? {
                value: totalLiveEV >= 0 ? "+EV" : "-EV",
                positive: totalLiveEV >= 0,
              } : undefined}
              icon={<Zap className="h-4 w-4" />}
              className="col-span-2 md:col-span-1"
            />
          </div>

          {/* Bets Section */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Your Bets</h2>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => setImportOpen(true)} data-testid="button-import-bets">
                  <Upload className="h-4 w-4 md:mr-2" />
                  <span className="hidden md:inline">Import</span>
                </Button>
                <Button size="sm" onClick={() => setAddBetOpen(true)} data-testid="button-add-bet">
                  <Plus className="h-4 w-4 md:mr-2" />
                  <span className="hidden md:inline">Add Bet</span>
                </Button>
              </div>
            </div>

            <BetFilters
              sport={sport}
              status={status}
              searchQuery={searchQuery}
              onSportChange={setSport}
              onStatusChange={setStatus}
              onSearchChange={setSearchQuery}
              onClear={handleClearFilters}
            />

            {bets.length === 0 ? (
              <EmptyState
                title="No bets yet"
                description="Import your bets or add them manually to start tracking."
                actionLabel="Import Bets"
                onAction={() => setImportOpen(true)}
              />
            ) : filteredBets.length === 0 ? (
              <EmptyState
                title="No bets found"
                description="Try adjusting your filters."
                actionLabel="Clear Filters"
                onAction={handleClearFilters}
              />
            ) : (
              <BetTable
                bets={filteredBets}
                liveStats={liveStats}
                onRowClick={(bet) => setDetailBet(bet as Bet)}
              />
            )}
          </div>
        </div>
      </main>

      {/* Mobile Bottom Action Bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-background border-t p-3 flex gap-2 md:hidden">
        <Button variant="outline" className="flex-1" onClick={() => setImportOpen(true)}>
          <Upload className="h-4 w-4 mr-2" />
          Import
        </Button>
        <Button className="flex-1" onClick={() => setAddBetOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Add Bet
        </Button>
      </div>

      <AddBetDialog
        open={addBetOpen}
        onOpenChange={setAddBetOpen}
        onSubmit={handleAddBet}
      />

      <ImportBetsDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        onImport={handleImportBets}
      />

      <BetDetailDialog
        bet={detailBet}
        open={!!detailBet}
        onOpenChange={(open) => !open && setDetailBet(null)}
        onUpdateLiveOdds={handleUpdateLiveOdds}
        onSettle={handleSettleBet}
      />
    </div>
  );
}
