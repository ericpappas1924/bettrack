import { MetricCard } from "../MetricCard";
import { DollarSign, TrendingUp, Target, BarChart3 } from "lucide-react";

export default function MetricCardExample() {
  return (
    <div className="p-6 bg-background min-h-screen">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-7xl mx-auto">
        <MetricCard
          label="Total P/L"
          value="$2,450"
          trend={{ value: "+12.5%", positive: true }}
          icon={<DollarSign className="h-4 w-4" />}
        />
        <MetricCard
          label="ROI"
          value="8.2%"
          trend={{ value: "+2.1%", positive: true }}
          icon={<TrendingUp className="h-4 w-4" />}
        />
        <MetricCard
          label="Win Rate"
          value="54.3%"
          trend={{ value: "-1.2%", positive: false }}
          icon={<Target className="h-4 w-4" />}
        />
        <MetricCard
          label="Avg CLV"
          value="+3.2%"
          trend={{ value: "+0.5%", positive: true }}
          icon={<BarChart3 className="h-4 w-4" />}
        />
      </div>
    </div>
  );
}
