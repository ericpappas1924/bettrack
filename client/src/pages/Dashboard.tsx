import { useState } from "react";
import { MetricCard } from "@/components/MetricCard";
import { BetTable } from "@/components/BetTable";
import { BetFilters } from "@/components/BetFilters";
import { AddBetDialog } from "@/components/AddBetDialog";
import { BetDetailDialog } from "@/components/BetDetailDialog";
import { EmptyState } from "@/components/EmptyState";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Plus, DollarSign, TrendingUp, Target, BarChart3, Zap } from "lucide-react";
import {
  americanToImpliedProbability,
  calculateExpectedValue,
} from "@/lib/betting";

//todo: remove mock functionality
const initialMockBets = [
  {
    id: "1",
    sport: "NBA",
    betType: "Moneyline",
    team: "Los Angeles Lakers",
    openingOdds: "-150",
    liveOdds: "-165",
    closingOdds: "-165",
    stake: "100",
    status: "settled",
    result: "won",
    profit: "66.67",
    clv: "3.5",
    projectionSource: "Unabated NBA",
    notes: "Strong value play",
    createdAt: new Date("2024-11-20"),
    settledAt: new Date("2024-11-21"),
  },
  {
    id: "2",
    sport: "NCAAF",
    betType: "Spread -7",
    team: "Alabama Crimson Tide",
    openingOdds: "-110",
    liveOdds: "-108",
    closingOdds: "-108",
    stake: "150",
    status: "settled",
    result: "lost",
    profit: "-150",
    clv: "-2.1",
    projectionSource: "Unabated NCAAF",
    notes: null,
    createdAt: new Date("2024-11-21"),
    settledAt: new Date("2024-11-22"),
  },
  {
    id: "3",
    sport: "NBA",
    betType: "Over 225.5",
    team: "Celtics vs Heat",
    openingOdds: "-105",
    liveOdds: "-120",
    closingOdds: null,
    stake: "200",
    status: "active",
    result: null,
    profit: null,
    clv: null,
    projectionSource: "Unabated NBA",
    notes: null,
    createdAt: new Date("2024-11-25"),
    settledAt: null,
  },
  {
    id: "4",
    sport: "NBA",
    betType: "Spread +3.5",
    team: "Golden State Warriors",
    openingOdds: "-112",
    liveOdds: "-125",
    closingOdds: null,
    stake: "100",
    status: "active",
    result: null,
    profit: null,
    clv: null,
    projectionSource: "Unabated NBA",
    notes: null,
    createdAt: new Date("2024-11-26"),
    settledAt: null,
  },
  {
    id: "5",
    sport: "NCAAF",
    betType: "Moneyline",
    team: "Ohio State Buckeyes",
    openingOdds: "+165",
    liveOdds: "+140",
    closingOdds: null,
    stake: "50",
    status: "active",
    result: null,
    profit: null,
    clv: null,
    projectionSource: null,
    notes: "Underdog value",
    createdAt: new Date("2024-11-26"),
    settledAt: null,
  },
];

type BetType = typeof initialMockBets[0];

export default function Dashboard() {
  const [bets, setBets] = useState(initialMockBets);
  const [addBetOpen, setAddBetOpen] = useState(false);
  const [detailBet, setDetailBet] = useState<BetType | null>(null);
  const [sport, setSport] = useState("all");
  const [status, setStatus] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  //todo: remove mock functionality
  const filteredBets = bets.filter((bet) => {
    const matchesSport = sport === "all" || bet.sport === sport;
    const matchesStatus = status === "all" || bet.status === status;
    const matchesSearch =
      searchQuery === "" ||
      bet.team.toLowerCase().includes(searchQuery.toLowerCase()) ||
      bet.betType.toLowerCase().includes(searchQuery.toLowerCase());
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
              trend={{ value: "+12.5%", positive: totalPL >= 0 }}
              icon={<DollarSign className="h-4 w-4" />}
            />
            <MetricCard
              label="ROI"
              value={`${roi.toFixed(1)}%`}
              trend={{ value: "+2.1%", positive: roi >= 0 }}
              icon={<TrendingUp className="h-4 w-4" />}
            />
            <MetricCard
              label="Win Rate"
              value={`${winRate.toFixed(1)}%`}
              trend={{ value: "+5.0%", positive: winRate >= 50 }}
              icon={<Target className="h-4 w-4" />}
            />
            <MetricCard
              label="Active Bets"
              value={activeBets.length.toString()}
              icon={<BarChart3 className="h-4 w-4" />}
            />
            <MetricCard
              label="Live Est. W/L"
              value={`${totalLiveEV >= 0 ? "$" : "-$"}${Math.abs(totalLiveEV).toFixed(2)}`}
              trend={{
                value: totalLiveEV >= 0 ? "+EV" : "-EV",
                positive: totalLiveEV >= 0,
              }}
              icon={<Zap className="h-4 w-4" />}
            />
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <h2 className="text-xl font-semibold">Recent Bets</h2>
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

            {filteredBets.length === 0 ? (
              <EmptyState
                title="No bets found"
                description="Try adjusting your filters or add your first bet to get started."
                actionLabel="Add Bet"
                onAction={() => setAddBetOpen(true)}
              />
            ) : (
              <BetTable
                bets={filteredBets}
                onRowClick={(bet) => setDetailBet(bet as BetType)}
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

      <BetDetailDialog
        bet={detailBet}
        open={!!detailBet}
        onOpenChange={(open) => !open && setDetailBet(null)}
        onUpdateLiveOdds={handleUpdateLiveOdds}
      />
    </div>
  );
}
