import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Search, X } from "lucide-react";
import { PROP_TYPES, SPORTS, BET_TYPES } from "@shared/betTypes";

interface BetFiltersProps {
  sport: string;
  betType: string;
  status: string;
  gameStatus: string;
  propMarket: string;
  onSportChange: (value: string) => void;
  onBetTypeChange: (value: string) => void;
  onStatusChange: (value: string) => void;
  onGameStatusChange: (value: string) => void;
  onPropMarketChange: (value: string) => void;
  searchQuery: string;
  onSearchChange: (value: string) => void;
  onClear: () => void;
}

// Map sports to relevant prop markets for contextual filtering
const SPORT_PROP_MARKETS: Record<string, string[]> = {
  [SPORTS.NBA]: [
    PROP_TYPES.POINTS,
    PROP_TYPES.ASSISTS,
    PROP_TYPES.REBOUNDS,
    PROP_TYPES.PRA,
    PROP_TYPES.THREES,
  ],
  [SPORTS.NFL]: [
    PROP_TYPES.RECEPTIONS,
    PROP_TYPES.RECEIVING_YARDS,
    PROP_TYPES.RUSHING_YARDS,
    PROP_TYPES.PASSING_YARDS,
    PROP_TYPES.CARRIES,
    PROP_TYPES.COMPLETIONS,
    PROP_TYPES.PASSING_ATTEMPTS,
    PROP_TYPES.TOUCHDOWNS,
    PROP_TYPES.INTERCEPTIONS,
  ],
  [SPORTS.NCAAF]: [
    PROP_TYPES.RECEPTIONS,
    PROP_TYPES.RECEIVING_YARDS,
    PROP_TYPES.RUSHING_YARDS,
    PROP_TYPES.PASSING_YARDS,
    PROP_TYPES.CARRIES,
    PROP_TYPES.COMPLETIONS,
    PROP_TYPES.PASSING_ATTEMPTS,
    PROP_TYPES.TOUCHDOWNS,
    PROP_TYPES.INTERCEPTIONS,
  ],
};

export function BetFilters({
  sport,
  betType,
  status,
  gameStatus,
  propMarket,
  onSportChange,
  onBetTypeChange,
  onStatusChange,
  onGameStatusChange,
  onPropMarketChange,
  searchQuery,
  onSearchChange,
  onClear,
}: BetFiltersProps) {
  const hasFilters =
    sport !== "all" ||
    betType !== "all" ||
    status !== "all" ||
    gameStatus !== "all" ||
    propMarket !== "all" ||
    searchQuery !== "";

  const propMarkets =
    SPORT_PROP_MARKETS[sport] ||
    Object.values(PROP_TYPES).filter(
      (p) =>
        ![
          PROP_TYPES.REGULAR_LINES,
          PROP_TYPES.TEASERS,
          PROP_TYPES.OVER,
          PROP_TYPES.UNDER,
          PROP_TYPES.OVER_UNDER,
        ].includes(p)
    );

  const isPropBetType =
    betType === BET_TYPES.PLAYER_PROPS || betType === BET_TYPES.PLAYER_PROP_PARLAY;

  return (
    <div className="space-y-3">
      {/* Search - Full Width on Mobile */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search bets..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-9"
          data-testid="input-search-bets"
        />
      </div>

      {/* Filter Row */}
      <div className="flex gap-2 items-center flex-wrap">
        <Select value={sport} onValueChange={onSportChange}>
          <SelectTrigger className="w-[110px] sm:w-32" data-testid="select-sport-filter">
            <SelectValue placeholder="Sport" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Sports</SelectItem>
            <SelectItem value="NBA">NBA</SelectItem>
            <SelectItem value="NFL">NFL</SelectItem>
            <SelectItem value="NCAAF">NCAAF</SelectItem>
            <SelectItem value="CFB">CFB</SelectItem>
          </SelectContent>
        </Select>

        <Select value={betType} onValueChange={onBetTypeChange}>
          <SelectTrigger className="w-[130px] sm:w-36" data-testid="select-bet-type-filter">
            <SelectValue placeholder="Bet Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Bet Types</SelectItem>
            {Object.values(BET_TYPES).map((type) => (
              <SelectItem key={type} value={type}>
                {type}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={gameStatus} onValueChange={onGameStatusChange}>
          <SelectTrigger className="w-[110px] sm:w-32" data-testid="select-game-status-filter">
            <SelectValue placeholder="Game" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Games</SelectItem>
            <SelectItem value="pregame">Pregame</SelectItem>
            <SelectItem value="live">Live</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
          </SelectContent>
        </Select>

        <Select value={status} onValueChange={onStatusChange}>
          <SelectTrigger className="w-[110px] sm:w-32" data-testid="select-status-filter">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="settled">Settled</SelectItem>
          </SelectContent>
        </Select>

        <Select
          value={propMarket}
          onValueChange={onPropMarketChange}
          disabled={!isPropBetType}
        >
          <SelectTrigger className="w-[140px] sm:w-40" data-testid="select-prop-market-filter">
            <SelectValue placeholder="Market" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Markets</SelectItem>
            {propMarkets.map((market) => (
              <SelectItem key={market} value={market}>
                {market}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {hasFilters && (
          <Button 
            variant="ghost" 
            size="icon"
            onClick={onClear}
            data-testid="button-clear-filters"
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
}
