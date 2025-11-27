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

interface BetFiltersProps {
  sport: string;
  status: string;
  onSportChange: (value: string) => void;
  onStatusChange: (value: string) => void;
  searchQuery: string;
  onSearchChange: (value: string) => void;
  onClear: () => void;
}

export function BetFilters({
  sport,
  status,
  onSportChange,
  onStatusChange,
  searchQuery,
  onSearchChange,
  onClear,
}: BetFiltersProps) {
  return (
    <div className="flex flex-wrap gap-4 items-center">
      <div className="relative flex-1 min-w-64">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search bets..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-9"
          data-testid="input-search-bets"
        />
      </div>

      <Select value={sport} onValueChange={onSportChange}>
        <SelectTrigger className="w-40" data-testid="select-sport-filter">
          <SelectValue placeholder="All Sports" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Sports</SelectItem>
          <SelectItem value="NBA">NBA</SelectItem>
          <SelectItem value="NFL">NFL</SelectItem>
          <SelectItem value="NCAAF">NCAAF</SelectItem>
          <SelectItem value="CFB">CFB</SelectItem>
        </SelectContent>
      </Select>

      <Select value={status} onValueChange={onStatusChange}>
        <SelectTrigger className="w-40" data-testid="select-status-filter">
          <SelectValue placeholder="All Status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Status</SelectItem>
          <SelectItem value="active">Active</SelectItem>
          <SelectItem value="settled">Settled</SelectItem>
          <SelectItem value="pending">Pending</SelectItem>
        </SelectContent>
      </Select>

      <Button 
        variant="ghost" 
        onClick={onClear}
        data-testid="button-clear-filters"
      >
        <X className="h-4 w-4 mr-2" />
        Clear
      </Button>
    </div>
  );
}
