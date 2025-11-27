import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

interface LiveProbabilityBadgeProps {
  baselineProbability: number;
  liveProbability: number;
}

export function LiveProbabilityBadge({
  baselineProbability,
  liveProbability,
}: LiveProbabilityBadgeProps) {
  const change = liveProbability - baselineProbability;
  const changePercent = change * 100;

  const formatChange = () => {
    if (changePercent >= 0) {
      return `+${changePercent.toFixed(1)}%`;
    }
    return `${changePercent.toFixed(1)}%`;
  };

  if (Math.abs(changePercent) < 0.1) {
    return (
      <Badge variant="secondary" className="gap-1 tabular-nums">
        <Minus className="h-3 w-3" />
        <span>0.0%</span>
      </Badge>
    );
  }

  if (change > 0) {
    return (
      <Badge 
        variant="default" 
        className="gap-1 tabular-nums bg-green-600 hover:bg-green-700 dark:bg-green-700 dark:hover:bg-green-800"
      >
        <TrendingUp className="h-3 w-3" />
        <span>{formatChange()}</span>
      </Badge>
    );
  }

  return (
    <Badge variant="destructive" className="gap-1 tabular-nums">
      <TrendingDown className="h-3 w-3" />
      <span>{formatChange()}</span>
    </Badge>
  );
}
