import { BetStatusBadge } from "../BetStatusBadge";

export default function BetStatusBadgeExample() {
  return (
    <div className="p-6 bg-background min-h-screen">
      <div className="flex flex-wrap gap-4 max-w-2xl mx-auto">
        <BetStatusBadge status="settled" result="won" />
        <BetStatusBadge status="settled" result="lost" />
        <BetStatusBadge status="active" />
        <BetStatusBadge status="pending" />
      </div>
    </div>
  );
}
