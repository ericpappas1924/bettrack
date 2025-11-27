import { useState } from "react";
import { MetricCard } from "@/components/MetricCard";
import { BetTable } from "@/components/BetTable";
import { BetFilters } from "@/components/BetFilters";
import { AddBetDialog } from "@/components/AddBetDialog";
import { BetDetailDialog } from "@/components/BetDetailDialog";
import { ImportBetsDialog } from "@/components/ImportBetsDialog";
import { EmptyState } from "@/components/EmptyState";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Plus, DollarSign, TrendingUp, Target, BarChart3, Zap, Upload } from "lucide-react";
import {
  americanToImpliedProbability,
  calculateExpectedValue,
} from "@/lib/betting";

interface AppBet {
  id: string;
  sport: string;
  betType: string;
  team: string;
  game?: string;
  openingOdds: string;
  liveOdds: string | null;
  closingOdds: string | null;
  stake: string;
  potentialWin?: string;
  status: string;
  result: string | null;
  profit: string | null;
  clv: string | null;
  projectionSource: string | null;
  notes: string | null;
  isFreePlay?: boolean;
  createdAt: Date;
  settledAt: Date | null;
}

export default function Dashboard() {
  const [bets, setBets] = useState<AppBet[]>([]);
  const [addBetOpen, setAddBetOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [detailBet, setDetailBet] = useState<AppBet | null>(null);
  const [sport, setSport] = useState("all");
  const [status, setStatus] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

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

  const handleAddBet = (data: any) => {
    console.log("Adding bet:", data);
    setAddBetOpen(false);
  };

  const handleImportBets = (importedBets: AppBet[]) => {
    setBets((prev) => {
      const existingIds = new Set(prev.map(b => b.id));
      const newBets = importedBets.filter(b => !existingIds.has(b.id));
      return [...prev, ...newBets];
    });
    setImportOpen(false);
  };

  const handleClearFilters = () => {
    setSport("all");
    setStatus("all");
    setSearchQuery("");
  };

  const handleUpdateLiveOdds = (betId: string, liveOdds: string) => {
    setBets((prev) =>
      prev.map((bet) =>
        bet.id === betId ? { ...bet, liveOdds } : bet
      )
    );
    if (detailBet && detailBet.id === betId) {
      setDetailBet({ ...detailBet, liveOdds });
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="flex items-center justify-between px-6 lg:px-8 py-4">
          <div>
            <h1 className="text-2xl font-bold">BetTrack</h1>
            <p className="text-sm text-muted-foreground">
              Sports Betting Performance Tracker
            </p>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Button variant="outline" onClick={() => setImportOpen(true)} data-testid="button-import-bets">
              <Upload className="h-4 w-4 mr-2" />
              Import
            </Button>
            <Button onClick={() => setAddBetOpen(true)} data-testid="button-add-bet">
              <Plus className="h-4 w-4 mr-2" />
              Add Bet
            </Button>
          </div>
        </div>
      </header>

      <main className="px-6 lg:px-8 py-8 max-w-7xl mx-auto">
        <div className="space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
            <MetricCard
              label="Total P/L"
              value={`${totalPL >= 0 ? "$" : "-$"}${Math.abs(totalPL).toFixed(2)}`}
              trend={settledBets.length > 0 ? { value: `${roi >= 0 ? '+' : ''}${roi.toFixed(1)}%`, positive: totalPL >= 0 } : undefined}
              icon={<DollarSign className="h-4 w-4" />}
            />
            <MetricCard
              label="Win Rate"
              value={settledBets.length > 0 ? `${winRate.toFixed(1)}%` : "-"}
              trend={settledBets.length > 0 ? { value: `${wins}/${settledBets.length}`, positive: winRate >= 50 } : undefined}
              icon={<Target className="h-4 w-4" />}
            />
            <MetricCard
              label="Active Bets"
              value={activeBets.length.toString()}
              trend={activeBets.length > 0 ? { value: `$${totalAtRisk.toFixed(0)} at risk`, positive: true } : undefined}
              icon={<BarChart3 className="h-4 w-4" />}
            />
            <MetricCard
              label="Potential Win"
              value={`$${totalPotentialWin.toFixed(2)}`}
              trend={activeBets.length > 0 ? { value: `${activeBets.length} pending`, positive: true } : undefined}
              icon={<TrendingUp className="h-4 w-4" />}
            />
            <MetricCard
              label="Live Est. EV"
              value={`${totalLiveEV >= 0 ? "$" : "-$"}${Math.abs(totalLiveEV).toFixed(2)}`}
              trend={activeBets.length > 0 ? {
                value: totalLiveEV >= 0 ? "+EV" : "-EV",
                positive: totalLiveEV >= 0,
              } : undefined}
              icon={<Zap className="h-4 w-4" />}
            />
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <h2 className="text-xl font-semibold">Your Bets</h2>
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
                description="Import your bets from your bookie or add them manually to start tracking your performance."
                actionLabel="Import Bets"
                onAction={() => setImportOpen(true)}
              />
            ) : filteredBets.length === 0 ? (
              <EmptyState
                title="No bets found"
                description="Try adjusting your filters to find your bets."
                actionLabel="Clear Filters"
                onAction={handleClearFilters}
              />
            ) : (
              <BetTable
                bets={filteredBets}
                onRowClick={(bet) => setDetailBet(bet as AppBet)}
              />
            )}
          </div>
        </div>
      </main>

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
      />
    </div>
  );
}
