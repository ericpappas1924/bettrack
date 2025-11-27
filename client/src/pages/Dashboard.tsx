import { useState } from "react";
import { MetricCard } from "@/components/MetricCard";
import { BetTable } from "@/components/BetTable";
import { BetFilters } from "@/components/BetFilters";
import { AddBetDialog } from "@/components/AddBetDialog";
import { BetDetailDialog } from "@/components/BetDetailDialog";
import { EmptyState } from "@/components/EmptyState";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Plus, DollarSign, TrendingUp, Target, BarChart3 } from "lucide-react";

//todo: remove mock functionality
const mockBets = [
  {
    id: "1",
    sport: "NBA",
    betType: "Moneyline",
    team: "Los Angeles Lakers",
    openingOdds: "-150",
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
    closingOdds: null,
    stake: "200",
    status: "active",
    result: null,
    profit: null,
    clv: "1.8",
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
    closingOdds: "-115",
    stake: "100",
    status: "settled",
    result: "won",
    profit: "89.29",
    clv: "2.8",
    projectionSource: "Unabated NBA",
    notes: null,
    createdAt: new Date("2024-11-22"),
    settledAt: new Date("2024-11-23"),
  },
  {
    id: "5",
    sport: "NCAAF",
    betType: "Moneyline",
    team: "Ohio State Buckeyes",
    openingOdds: "+165",
    closingOdds: "+155",
    stake: "50",
    status: "settled",
    result: "won",
    profit: "82.50",
    clv: "-4.2",
    projectionSource: null,
    notes: "Underdog value",
    createdAt: new Date("2024-11-18"),
    settledAt: new Date("2024-11-19"),
  },
];

type BetType = typeof mockBets[0];

export default function Dashboard() {
  const [addBetOpen, setAddBetOpen] = useState(false);
  const [detailBet, setDetailBet] = useState<BetType | null>(null);
  const [sport, setSport] = useState("all");
  const [status, setStatus] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  //todo: remove mock functionality
  const filteredBets = mockBets.filter((bet) => {
    const matchesSport = sport === "all" || bet.sport === sport;
    const matchesStatus = status === "all" || bet.status === status;
    const matchesSearch =
      searchQuery === "" ||
      bet.team.toLowerCase().includes(searchQuery.toLowerCase()) ||
      bet.betType.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesSport && matchesStatus && matchesSearch;
  });

  const handleAddBet = (data: any) => {
    console.log("Adding bet:", data);
    setAddBetOpen(false);
  };

  const handleClearFilters = () => {
    setSport("all");
    setStatus("all");
    setSearchQuery("");
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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <MetricCard
              label="Total P/L"
              value="$138.46"
              trend={{ value: "+12.5%", positive: true }}
              icon={<DollarSign className="h-4 w-4" />}
            />
            <MetricCard
              label="ROI"
              value="23.1%"
              trend={{ value: "+2.1%", positive: true }}
              icon={<TrendingUp className="h-4 w-4" />}
            />
            <MetricCard
              label="Win Rate"
              value="60.0%"
              trend={{ value: "+5.0%", positive: true }}
              icon={<Target className="h-4 w-4" />}
            />
            <MetricCard
              label="Avg CLV"
              value="+0.4%"
              trend={{ value: "-0.2%", positive: false }}
              icon={<BarChart3 className="h-4 w-4" />}
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
      />
    </div>
  );
}
