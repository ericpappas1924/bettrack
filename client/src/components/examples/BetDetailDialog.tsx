import { BetDetailDialog } from "../BetDetailDialog";
import { useState } from "react";
import { Button } from "@/components/ui/button";

export default function BetDetailDialogExample() {
  const [open, setOpen] = useState(false);
  const [mockBet, setMockBet] = useState({
    id: "1",
    sport: "NBA",
    betType: "Moneyline",
    team: "Los Angeles Lakers",
    openingOdds: "-150",
    liveOdds: "-165",
    closingOdds: null,
    stake: "100",
    status: "active",
    result: null,
    profit: null,
    clv: null,
    projectionSource: "Unabated NBA",
    notes: "Strong value play. Lakers injury report favorable.",
    createdAt: new Date("2024-11-20"),
    settledAt: null,
  });

  const handleUpdateLiveOdds = (betId: string, liveOdds: string) => {
    setMockBet((prev) => ({ ...prev, liveOdds }));
  };

  return (
    <div className="p-6 bg-background min-h-screen">
      <div className="max-w-2xl mx-auto">
        <Button onClick={() => setOpen(true)}>Open Bet Detail</Button>
        <BetDetailDialog
          bet={mockBet}
          open={open}
          onOpenChange={setOpen}
          onUpdateLiveOdds={handleUpdateLiveOdds}
        />
      </div>
    </div>
  );
}
