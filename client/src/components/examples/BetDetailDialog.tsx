import { BetDetailDialog } from "../BetDetailDialog";
import { useState } from "react";
import { Button } from "@/components/ui/button";

export default function BetDetailDialogExample() {
  const [open, setOpen] = useState(false);

  const mockBet = {
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
    notes: "Strong value play. Lakers injury report favorable, opponent on second night of back-to-back.",
    createdAt: new Date("2024-11-20"),
    settledAt: new Date("2024-11-21"),
  };

  return (
    <div className="p-6 bg-background min-h-screen">
      <div className="max-w-2xl mx-auto">
        <Button onClick={() => setOpen(true)}>Open Bet Detail</Button>
        <BetDetailDialog
          bet={mockBet}
          open={open}
          onOpenChange={setOpen}
        />
      </div>
    </div>
  );
}
