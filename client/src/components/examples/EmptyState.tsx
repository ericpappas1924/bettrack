import { EmptyState } from "../EmptyState";

export default function EmptyStateExample() {
  return (
    <div className="p-6 bg-background min-h-screen">
      <div className="max-w-2xl mx-auto border rounded-md">
        <EmptyState
          title="No bets yet"
          description="Get started by adding your first bet from Unabated or your bookie. Track your performance and analyze your betting edge."
          actionLabel="Add First Bet"
          onAction={() => console.log("Add bet clicked")}
        />
      </div>
    </div>
  );
}
