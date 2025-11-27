import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { TrendingUp, TrendingDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface MetricCardProps {
  label: string;
  value: string | number;
  trend?: {
    value: string;
    positive: boolean;
  };
  icon?: React.ReactNode;
}

export function MetricCard({ label, value, trend, icon }: MetricCardProps) {
  return (
    <Card data-testid={`card-metric-${label.toLowerCase().replace(/\s+/g, '-')}`}>
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
        {icon && <div className="text-muted-foreground">{icon}</div>}
      </CardHeader>
      <CardContent>
        <div className="flex items-baseline justify-between gap-2 flex-wrap">
          <p className="text-4xl font-bold tabular-nums" data-testid={`text-metric-value-${label.toLowerCase().replace(/\s+/g, '-')}`}>
            {value}
          </p>
          {trend && (
            <Badge 
              variant={trend.positive ? "default" : "secondary"}
              className="gap-1"
              data-testid={`badge-trend-${label.toLowerCase().replace(/\s+/g, '-')}`}
            >
              {trend.positive ? (
                <TrendingUp className="h-3 w-3" />
              ) : (
                <TrendingDown className="h-3 w-3" />
              )}
              <span className="text-xs">{trend.value}</span>
            </Badge>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
