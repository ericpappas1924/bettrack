import { BetTable } from "../BetTable";

export default function BetTableExample() {
  const mockBets = [
    {
      id: "1",
      sport: "NBA",
      betType: "Moneyline",
      team: "Lakers",
      openingOdds: "-150",
      liveOdds: "-165",
      stake: "100",
      status: "active",
      result: null,
      profit: null,
      clv: null,
      createdAt: new Date("2024-11-25"),
    },
    {
      id: "2",
      sport: "NCAAF",
      betType: "Spread -7",
      team: "Alabama",
      openingOdds: "-110",
      liveOdds: "-105",
      stake: "150",
      status: "active",
      result: null,
      profit: null,
      clv: null,
      createdAt: new Date("2024-11-25"),
    },
    {
      id: "3",
      sport: "NBA",
      betType: "Over 225.5",
      team: "Celtics vs Heat",
      openingOdds: "-105",
      liveOdds: null,
      stake: "200",
      status: "settled",
      result: "won",
      profit: "190.48",
      clv: "1.8",
      createdAt: new Date("2024-11-20"),
    },
  ];

  return (
    <div className="p-6 bg-background min-h-screen">
      <div className="max-w-7xl mx-auto">
        <BetTable 
          bets={mockBets} 
          onRowClick={(bet) => console.log("Bet clicked:", bet)}
        />
      </div>
    </div>
  );
}
