import { BetFilters } from "../BetFilters";
import { useState } from "react";

export default function BetFiltersExample() {
  const [sport, setSport] = useState("all");
  const [status, setStatus] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  return (
    <div className="p-6 bg-background min-h-screen">
      <div className="max-w-7xl mx-auto">
        <BetFilters
          sport={sport}
          status={status}
          searchQuery={searchQuery}
          onSportChange={setSport}
          onStatusChange={setStatus}
          onSearchChange={setSearchQuery}
          onClear={() => {
            setSport("all");
            setStatus("all");
            setSearchQuery("");
          }}
        />
      </div>
    </div>
  );
}
