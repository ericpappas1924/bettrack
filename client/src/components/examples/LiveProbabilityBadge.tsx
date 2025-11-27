import { LiveProbabilityBadge } from "../LiveProbabilityBadge";

export default function LiveProbabilityBadgeExample() {
  return (
    <div className="p-6 bg-background min-h-screen">
      <div className="flex flex-wrap gap-4 max-w-2xl mx-auto">
        <LiveProbabilityBadge baselineProbability={0.60} liveProbability={0.65} />
        <LiveProbabilityBadge baselineProbability={0.55} liveProbability={0.48} />
        <LiveProbabilityBadge baselineProbability={0.50} liveProbability={0.50} />
      </div>
    </div>
  );
}
