import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { MetricCard } from "@/components/MetricCard";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  DollarSign,
  TrendingUp,
  Target,
  BarChart3,
  Loader2,
  LogOut,
  User,
  ArrowLeft,
  Calendar,
  Activity,
  TrendingDown,
  Minus,
  AlertTriangle,
  Calculator,
  Zap,
} from "lucide-react";
import { Link } from "wouter";
import { format, subDays, subMonths, startOfDay, endOfDay } from "date-fns";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import { SPORTS, BET_TYPES } from "@shared/betTypes";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

interface PerformanceData {
  summary: {
    totalBets: number;
    wins: number;
    losses: number;
    pushes: number;
    winRate: number;
    roi: number;
    totalStaked: number;
    totalProfit: number;
    avgOdds: number;
  };
  trendData: Array<{
    date: string;
    profit: number;
    wins: number;
    losses: number;
    pushes: number;
    cumulativeProfit: number;
  }>;
  betTypeBreakdown: {
    [key: string]: {
      wins: number;
      losses: number;
      pushes: number;
      profit: number;
      staked: number;
      roi: number;
      winRate: number;
    };
  };
  oddsRangeAnalysis: {
    [key: string]: {
      label: string;
      wins: number;
      losses: number;
      pushes: number;
      roi: number;
      profit: number;
      staked: number;
      count: number;
    };
  };
  recentForm: {
    bets: Array<{
      date: string;
      result: string;
      profit: number;
      betType: string;
      team: string;
      stake: number;
    }>;
    last20WinRate: number;
    last20Roi: number;
    last20Profit: number;
    trend: string;
  };
  betSizeAnalysis: {
    ranges: Array<{
      label: string;
      wins: number;
      losses: number;
      pushes: number;
      roi: number;
      profit: number;
      staked: number;
      count: number;
      avgStake: number;
    }>;
    quartiles: number[];
  };
  sportComparison: {
    sports: Array<{
      sport: string;
      wins: number;
      losses: number;
      pushes: number;
      roi: number;
      profit: number;
      staked: number;
      count: number;
    }>;
  };
  advancedMetrics: {
    totalUnits: number;
    unitsWon: number;
    unitSize: number;
    avgWinSize: number;
    avgLossSize: number;
    winLossRatio: number;
    breakevenWinRate: number;
    actualWinRate: number;
    avgClv: number | null;
  };
  predictiveInsights: {
    projections: {
      weekly: { bets: number; expectedProfit: number; lowEstimate: number; highEstimate: number };
      monthly: { bets: number; expectedProfit: number; lowEstimate: number; highEstimate: number };
      quarterly: { bets: number; expectedProfit: number; lowEstimate: number; highEstimate: number };
      yearly: { bets: number; expectedProfit: number; lowEstimate: number; highEstimate: number };
    };
    warnings: string[];
    confidence: string;
  };
}

const TIME_RANGES = {
  ALL: { label: "All Time", value: "all" },
  WEEK: { label: "Last 7 Days", value: "7d" },
  MONTH: { label: "Last 30 Days", value: "30d" },
  QUARTER: { label: "Last 3 Months", value: "3m" },
  YEAR: { label: "Last Year", value: "1y" },
};

export default function PerformanceAnalytics() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [selectedSport, setSelectedSport] = useState<string>("all");
  const [selectedBetTypes, setSelectedBetTypes] = useState<string[]>([]);
  const [timeRange, setTimeRange] = useState<string>("all");

  // Calculate date range based on timeRange
  const { startDate, endDate } = useMemo(() => {
    const end = endOfDay(new Date());
    let start: Date | null = null;

    switch (timeRange) {
      case "7d":
        start = startOfDay(subDays(end, 7));
        break;
      case "30d":
        start = startOfDay(subDays(end, 30));
        break;
      case "3m":
        start = startOfDay(subMonths(end, 3));
        break;
      case "1y":
        start = startOfDay(subMonths(end, 12));
        break;
      default:
        start = null;
    }

    return { startDate: start, endDate: end };
  }, [timeRange]);

  // Build query parameters
  const queryParams = useMemo(() => {
    const params = new URLSearchParams();
    if (selectedSport !== "all") params.append("sport", selectedSport);
    if (selectedBetTypes.length > 0) params.append("betTypes", selectedBetTypes.join(","));
    if (startDate) params.append("startDate", startDate.toISOString());
    if (endDate) params.append("endDate", endDate.toISOString());
    return params.toString();
  }, [selectedSport, selectedBetTypes, startDate, endDate]);

  const { data: performanceData, isLoading } = useQuery<PerformanceData>({
    queryKey: ["/api/analytics/performance", queryParams],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/analytics/performance?${queryParams}`);
      return res.json();
    },
    onError: (error: Error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Session expired",
          description: "Please log in again",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
      }
    },
  });

  const handleBetTypeToggle = (betType: string) => {
    setSelectedBetTypes((prev) =>
      prev.includes(betType)
        ? prev.filter((t) => t !== betType)
        : [...prev, betType]
    );
  };

  const getUserInitials = () => {
    if (user?.firstName && user?.lastName) {
      return `${user.firstName[0]}${user.lastName[0]}`.toUpperCase();
    }
    if (user?.email) {
      return user.email[0].toUpperCase();
    }
    return "U";
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const summary = performanceData?.summary || {
    totalBets: 0,
    wins: 0,
    losses: 0,
    pushes: 0,
    winRate: 0,
    roi: 0,
    totalStaked: 0,
    totalProfit: 0,
    avgOdds: 0,
  };

  const trendData = performanceData?.trendData || [];
  const betTypeBreakdown = performanceData?.betTypeBreakdown || {};
  const oddsRangeAnalysis = performanceData?.oddsRangeAnalysis || {};
  const recentForm = performanceData?.recentForm || { bets: [], last20WinRate: 0, last20Roi: 0, last20Profit: 0, trend: 'stable' };
  const betSizeAnalysis = performanceData?.betSizeAnalysis || { ranges: [], quartiles: [] };
  const sportComparison = performanceData?.sportComparison || { sports: [] };
  const advancedMetrics = performanceData?.advancedMetrics || {
    totalUnits: 0,
    unitsWon: 0,
    unitSize: 0,
    avgWinSize: 0,
    avgLossSize: 0,
    winLossRatio: 0,
    breakevenWinRate: 0,
    actualWinRate: 0,
    avgClv: null,
  };
  const predictiveInsights = performanceData?.predictiveInsights || {
    projections: {
      weekly: { bets: 0, expectedProfit: 0, lowEstimate: 0, highEstimate: 0 },
      monthly: { bets: 0, expectedProfit: 0, lowEstimate: 0, highEstimate: 0 },
      quarterly: { bets: 0, expectedProfit: 0, lowEstimate: 0, highEstimate: 0 },
      yearly: { bets: 0, expectedProfit: 0, lowEstimate: 0, highEstimate: 0 },
    },
    warnings: [],
    confidence: 'low',
  };

  // Format trend data for chart
  const chartData = trendData.map((day) => ({
    date: format(new Date(day.date), "MMM d"),
    profit: day.cumulativeProfit,
  }));

  // Format sport comparison data for chart
  const sportChartData = sportComparison.sports.map((sport) => ({
    sport: sport.sport,
    roi: sport.roi,
    count: sport.count,
  }));

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b sticky top-0 bg-background z-50">
        <div className="flex items-center justify-between px-4 py-3 max-w-7xl mx-auto">
          <div className="flex items-center gap-3">
            <Link href="/">
              <Button variant="ghost" size="icon">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
            <div>
              <h1 className="text-lg sm:text-xl font-bold">Performance Analytics</h1>
              <p className="text-sm text-muted-foreground hidden sm:block">
                Track your betting performance over time
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="rounded-full">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={user?.profileImageUrl || undefined} alt={user?.firstName || "User"} />
                    <AvatarFallback>{getUserInitials()}</AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem disabled>
                  <User className="h-4 w-4 mr-2" />
                  {user?.email || "User"}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <a href="/api/logout">
                    <LogOut className="h-4 w-4 mr-2" />
                    Sign Out
                  </a>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      <main className="px-3 sm:px-4 py-4 sm:py-6 max-w-7xl mx-auto">
        <div className="space-y-6">
          {/* Filters Section */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5" />
                Filters
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Sport Filter */}
                <div className="space-y-2">
                  <Label>Sport</Label>
                  <Select value={selectedSport} onValueChange={setSelectedSport}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select sport" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Sports</SelectItem>
                      {Object.values(SPORTS).map((sport) => (
                        <SelectItem key={sport} value={sport}>
                          {sport}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Time Range Filter */}
                <div className="space-y-2">
                  <Label>Time Range</Label>
                  <Select value={timeRange} onValueChange={setTimeRange}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select time range" />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.values(TIME_RANGES).map((range) => (
                        <SelectItem key={range.value} value={range.value}>
                          {range.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Bet Type Filter (Multi-select) */}
              <div className="space-y-2">
                <Label>Bet Types</Label>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                  {Object.values(BET_TYPES).map((betType) => (
                    <div key={betType} className="flex items-center space-x-2">
                      <Checkbox
                        id={betType}
                        checked={selectedBetTypes.includes(betType)}
                        onCheckedChange={() => handleBetTypeToggle(betType)}
                      />
                      <Label
                        htmlFor={betType}
                        className="text-sm font-normal cursor-pointer"
                      >
                        {betType}
                      </Label>
                    </div>
                  ))}
                </div>
                {selectedBetTypes.length > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedBetTypes([])}
                  >
                    Clear Selection
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Summary Metrics */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <MetricCard
              label="Record"
              value={`${summary.wins}-${summary.losses}-${summary.pushes}`}
              trend={
                summary.totalBets > 0
                  ? { value: `${summary.totalBets} bets`, positive: summary.wins > summary.losses }
                  : undefined
              }
              icon={<Target className="h-4 w-4" />}
            />
            <MetricCard
              label="Win Rate"
              value={`${summary.winRate.toFixed(1)}%`}
              trend={
                summary.totalBets > 0
                  ? { value: `${summary.wins} wins`, positive: summary.winRate >= 50 }
                  : undefined
              }
              icon={<Activity className="h-4 w-4" />}
            />
            <MetricCard
              label="Total P/L"
              value={`${summary.totalProfit >= 0 ? "$" : "-$"}${Math.abs(summary.totalProfit).toFixed(2)}`}
              trend={
                summary.totalStaked > 0
                  ? { value: `$${summary.totalStaked.toFixed(0)} staked`, positive: summary.totalProfit >= 0 }
                  : undefined
              }
              icon={<DollarSign className="h-4 w-4" />}
            />
            <MetricCard
              label="ROI"
              value={`${summary.roi >= 0 ? "+" : ""}${summary.roi.toFixed(1)}%`}
              trend={
                summary.avgOdds !== 0
                  ? { value: `Avg ${summary.avgOdds > 0 ? "+" : ""}${summary.avgOdds} odds`, positive: summary.roi >= 0 }
                  : undefined
              }
              icon={<TrendingUp className="h-4 w-4" />}
            />
          </div>

          {/* Recent Form Widget */}
          {recentForm.bets.length > 0 && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <Activity className="h-5 w-5" />
                    Recent Form (Last 20 Bets)
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    <Badge variant={recentForm.last20Profit >= 0 ? "default" : "secondary"}>
                      {recentForm.last20Profit >= 0 ? "+" : ""}${recentForm.last20Profit.toFixed(2)}
                    </Badge>
                    <Badge variant="outline">
                      {recentForm.last20WinRate.toFixed(1)}% WR
                    </Badge>
                    <div className="flex items-center gap-1">
                      {recentForm.trend === 'improving' && <TrendingUp className="h-4 w-4 text-green-600" />}
                      {recentForm.trend === 'declining' && <TrendingDown className="h-4 w-4 text-red-600" />}
                      {recentForm.trend === 'stable' && <Minus className="h-4 w-4 text-muted-foreground" />}
                      <span className="text-sm text-muted-foreground capitalize">{recentForm.trend}</span>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Team</TableHead>
                        <TableHead>Stake</TableHead>
                        <TableHead>Result</TableHead>
                        <TableHead className="text-right">Profit</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {recentForm.bets.slice(0, 20).map((bet, idx) => (
                        <TableRow key={idx}>
                          <TableCell className="text-xs">{format(new Date(bet.date), "MMM d")}</TableCell>
                          <TableCell className="text-xs">{bet.betType}</TableCell>
                          <TableCell className="text-xs truncate max-w-[150px]">{bet.team}</TableCell>
                          <TableCell className="text-xs">${bet.stake.toFixed(2)}</TableCell>
                          <TableCell>
                            <Badge 
                              variant={bet.result === 'won' ? 'default' : bet.result === 'lost' ? 'destructive' : 'secondary'}
                              className="text-xs"
                            >
                              {bet.result}
                            </Badge>
                          </TableCell>
                          <TableCell className={`text-right font-medium ${bet.profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {bet.profit >= 0 ? '+' : ''}${bet.profit.toFixed(2)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Advanced Metrics */}
          {summary.totalBets > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calculator className="h-5 w-5" />
                  Advanced Metrics
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <MetricCard
                    label="Total Units"
                    value={advancedMetrics.unitsWon.toFixed(2)}
                    trend={{
                      value: `${advancedMetrics.totalUnits.toFixed(1)} staked`,
                      positive: advancedMetrics.unitsWon >= 0,
                    }}
                    icon={<Target className="h-4 w-4" />}
                  />
                  <MetricCard
                    label="Win/Loss Ratio"
                    value={advancedMetrics.winLossRatio.toFixed(2)}
                    trend={{
                      value: `$${advancedMetrics.avgWinSize.toFixed(2)} avg win`,
                      positive: advancedMetrics.winLossRatio > 1,
                    }}
                    icon={<Zap className="h-4 w-4" />}
                  />
                  <MetricCard
                    label="Avg Win Size"
                    value={`$${advancedMetrics.avgWinSize.toFixed(2)}`}
                    icon={<TrendingUp className="h-4 w-4" />}
                  />
                  <MetricCard
                    label="Avg Loss Size"
                    value={`$${advancedMetrics.avgLossSize.toFixed(2)}`}
                    icon={<TrendingDown className="h-4 w-4" />}
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
                  <Card className="bg-accent/50">
                    <CardContent className="pt-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm text-muted-foreground">Breakeven Win Rate</p>
                          <p className="text-2xl font-bold">{advancedMetrics.breakevenWinRate.toFixed(1)}%</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm text-muted-foreground">Actual Win Rate</p>
                          <p className={`text-2xl font-bold ${advancedMetrics.actualWinRate >= advancedMetrics.breakevenWinRate ? 'text-green-600' : 'text-red-600'}`}>
                            {advancedMetrics.actualWinRate.toFixed(1)}%
                          </p>
                        </div>
                      </div>
                      <div className="mt-2 text-xs text-muted-foreground text-center">
                        {advancedMetrics.actualWinRate >= advancedMetrics.breakevenWinRate 
                          ? '✓ Above breakeven threshold' 
                          : '✗ Below breakeven threshold'}
                      </div>
                    </CardContent>
                  </Card>
                  {advancedMetrics.avgClv !== null && (
                    <Card className="bg-accent/50">
                      <CardContent className="pt-6">
                        <div className="text-center">
                          <p className="text-sm text-muted-foreground">Average CLV</p>
                          <p className={`text-3xl font-bold ${advancedMetrics.avgClv >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {advancedMetrics.avgClv >= 0 ? '+' : ''}{advancedMetrics.avgClv.toFixed(2)}%
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            Closing Line Value
                          </p>
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Predictive Insights */}
          {summary.totalBets > 0 && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5" />
                    Predictive Insights
                  </CardTitle>
                  <Badge variant={
                    predictiveInsights.confidence === 'high' ? 'default' :
                    predictiveInsights.confidence === 'medium' ? 'secondary' : 'outline'
                  }>
                    {predictiveInsights.confidence} confidence
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {predictiveInsights.warnings.length > 0 && (
                  <Alert>
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>Warnings</AlertTitle>
                    <AlertDescription>
                      <ul className="list-disc list-inside space-y-1">
                        {predictiveInsights.warnings.map((warning, idx) => (
                          <li key={idx} className="text-sm">{warning}</li>
                        ))}
                      </ul>
                    </AlertDescription>
                  </Alert>
                )}
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Timeframe</TableHead>
                        <TableHead>Expected Bets</TableHead>
                        <TableHead>Expected Profit</TableHead>
                        <TableHead>Range</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      <TableRow>
                        <TableCell className="font-medium">Weekly</TableCell>
                        <TableCell>{predictiveInsights.projections.weekly.bets}</TableCell>
                        <TableCell className={predictiveInsights.projections.weekly.expectedProfit >= 0 ? 'text-green-600' : 'text-red-600'}>
                          {predictiveInsights.projections.weekly.expectedProfit >= 0 ? '+' : ''}
                          ${predictiveInsights.projections.weekly.expectedProfit.toFixed(2)}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          ${predictiveInsights.projections.weekly.lowEstimate.toFixed(0)} to $
                          {predictiveInsights.projections.weekly.highEstimate.toFixed(0)}
                        </TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell className="font-medium">Monthly</TableCell>
                        <TableCell>{predictiveInsights.projections.monthly.bets}</TableCell>
                        <TableCell className={predictiveInsights.projections.monthly.expectedProfit >= 0 ? 'text-green-600' : 'text-red-600'}>
                          {predictiveInsights.projections.monthly.expectedProfit >= 0 ? '+' : ''}
                          ${predictiveInsights.projections.monthly.expectedProfit.toFixed(2)}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          ${predictiveInsights.projections.monthly.lowEstimate.toFixed(0)} to $
                          {predictiveInsights.projections.monthly.highEstimate.toFixed(0)}
                        </TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell className="font-medium">Quarterly</TableCell>
                        <TableCell>{predictiveInsights.projections.quarterly.bets}</TableCell>
                        <TableCell className={predictiveInsights.projections.quarterly.expectedProfit >= 0 ? 'text-green-600' : 'text-red-600'}>
                          {predictiveInsights.projections.quarterly.expectedProfit >= 0 ? '+' : ''}
                          ${predictiveInsights.projections.quarterly.expectedProfit.toFixed(2)}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          ${predictiveInsights.projections.quarterly.lowEstimate.toFixed(0)} to $
                          {predictiveInsights.projections.quarterly.highEstimate.toFixed(0)}
                        </TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell className="font-medium">Yearly</TableCell>
                        <TableCell>{predictiveInsights.projections.yearly.bets}</TableCell>
                        <TableCell className={predictiveInsights.projections.yearly.expectedProfit >= 0 ? 'text-green-600' : 'text-red-600'}>
                          {predictiveInsights.projections.yearly.expectedProfit >= 0 ? '+' : ''}
                          ${predictiveInsights.projections.yearly.expectedProfit.toFixed(2)}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          ${predictiveInsights.projections.yearly.lowEstimate.toFixed(0)} to $
                          {predictiveInsights.projections.yearly.highEstimate.toFixed(0)}
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Cumulative Profit Chart */}
          {chartData.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Profit Trend</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis
                      dataKey="date"
                      className="text-xs"
                      stroke="currentColor"
                    />
                    <YAxis
                      className="text-xs"
                      stroke="currentColor"
                      tickFormatter={(value) => `$${value}`}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--background))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "var(--radius)",
                      }}
                      formatter={(value: number) => [`$${value.toFixed(2)}`, "Profit"]}
                    />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="profit"
                      stroke="hsl(var(--primary))"
                      strokeWidth={2}
                      dot={{ fill: "hsl(var(--primary))" }}
                      name="Cumulative Profit"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          {/* Sport Comparison Chart */}
          {sportChartData.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5" />
                  Performance by Sport
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={Math.max(250, sportChartData.length * 50)}>
                  <BarChart data={sportChartData} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis
                      type="number"
                      className="text-xs"
                      stroke="currentColor"
                      tickFormatter={(value) => `${value}%`}
                    />
                    <YAxis
                      type="category"
                      dataKey="sport"
                      className="text-xs"
                      stroke="currentColor"
                      width={80}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--background))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "var(--radius)",
                      }}
                      formatter={(value: number, name: string, props: any) => [
                        `${value.toFixed(2)}% ROI (${props.payload.count} bets)`,
                        "ROI"
                      ]}
                    />
                    <Bar dataKey="roi" radius={[0, 4, 4, 0]}>
                      {sportChartData.map((entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={entry.roi >= 0 ? "hsl(142, 76%, 36%)" : "hsl(0, 84%, 60%)"}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          {/* Bet Type Breakdown */}
          {Object.keys(betTypeBreakdown).length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Performance by Bet Type</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {Object.entries(betTypeBreakdown)
                    .sort(([, a], [, b]) => b.profit - a.profit)
                    .map(([betType, data]) => (
                      <div
                        key={betType}
                        className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent/50 transition-colors"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <p className="font-semibold">{betType}</p>
                            <Badge variant={data.profit >= 0 ? "default" : "secondary"}>
                              {data.wins}-{data.losses}-{data.pushes}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-4 text-sm text-muted-foreground">
                            <span>Win Rate: {data.winRate.toFixed(1)}%</span>
                            <span>ROI: {data.roi >= 0 ? "+" : ""}{data.roi.toFixed(1)}%</span>
                            <span>Staked: ${data.staked.toFixed(2)}</span>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className={`text-2xl font-bold ${data.profit >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
                            {data.profit >= 0 ? "+" : ""}${data.profit.toFixed(2)}
                          </p>
                        </div>
                      </div>
                    ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Odds Range Analysis */}
          {Object.keys(oddsRangeAnalysis).length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Target className="h-5 w-5" />
                  Performance by Odds Range
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                  {Object.entries(oddsRangeAnalysis)
                    .sort(([, a], [, b]) => b.profit - a.profit)
                    .map(([key, data]) => (
                      <Card key={key} className="bg-accent/30 hover:bg-accent/50 transition-colors">
                        <CardContent className="pt-6">
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <p className="text-sm font-semibold">{data.label}</p>
                              <Badge variant={data.profit >= 0 ? "default" : "secondary"} className="text-xs">
                                {data.wins}-{data.losses}-{data.pushes}
                              </Badge>
                            </div>
                            <div className="space-y-1">
                              <div className="flex items-center justify-between text-sm">
                                <span className="text-muted-foreground">Win Rate:</span>
                                <span className="font-medium">
                                  {data.count > 0 ? ((data.wins / data.count) * 100).toFixed(1) : 0}%
                                </span>
                              </div>
                              <div className="flex items-center justify-between text-sm">
                                <span className="text-muted-foreground">ROI:</span>
                                <span className={`font-medium ${data.roi >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                  {data.roi >= 0 ? '+' : ''}{data.roi.toFixed(1)}%
                                </span>
                              </div>
                              <div className="flex items-center justify-between text-sm">
                                <span className="text-muted-foreground">Profit:</span>
                                <span className={`font-bold ${data.profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                  {data.profit >= 0 ? '+' : ''}${data.profit.toFixed(2)}
                                </span>
                              </div>
                              <div className="text-xs text-muted-foreground text-center pt-1 border-t">
                                {data.count} bets • ${data.staked.toFixed(0)} staked
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Bet Size Analysis */}
          {betSizeAnalysis.ranges.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <DollarSign className="h-5 w-5" />
                  Performance by Bet Size
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                  {betSizeAnalysis.ranges.map((range, idx) => (
                    <Card 
                      key={idx} 
                      className={`${range.roi === Math.max(...betSizeAnalysis.ranges.map(r => r.roi)) && range.roi > 0 
                        ? 'bg-green-50 dark:bg-green-950 border-green-500' 
                        : 'bg-accent/30'} hover:bg-accent/50 transition-colors`}
                    >
                      <CardContent className="pt-6">
                        <div className="space-y-3">
                          <div className="text-center">
                            <p className="text-sm font-semibold text-muted-foreground">{range.label}</p>
                            <p className="text-xs text-muted-foreground">Avg: ${range.avgStake.toFixed(2)}</p>
                          </div>
                          <div className="space-y-2">
                            <div className="flex items-center justify-center">
                              <Badge variant={range.profit >= 0 ? "default" : "secondary"}>
                                {range.wins}-{range.losses}-{range.pushes}
                              </Badge>
                            </div>
                            <div className="space-y-1">
                              <div className="flex items-center justify-between text-sm">
                                <span className="text-muted-foreground">Win Rate:</span>
                                <span className="font-medium">
                                  {range.count > 0 ? ((range.wins / range.count) * 100).toFixed(1) : 0}%
                                </span>
                              </div>
                              <div className="flex items-center justify-between text-sm">
                                <span className="text-muted-foreground">ROI:</span>
                                <span className={`font-medium ${range.roi >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                  {range.roi >= 0 ? '+' : ''}{range.roi.toFixed(1)}%
                                </span>
                              </div>
                              <div className="flex items-center justify-between">
                                <span className="text-sm text-muted-foreground">Profit:</span>
                                <span className={`text-lg font-bold ${range.profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                  {range.profit >= 0 ? '+' : ''}${range.profit.toFixed(2)}
                                </span>
                              </div>
                              <div className="text-xs text-muted-foreground text-center pt-1 border-t">
                                {range.count} bets • ${range.staked.toFixed(0)} staked
                              </div>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Empty State */}
          {summary.totalBets === 0 && (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <BarChart3 className="h-16 w-16 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">No Data Available</h3>
                <p className="text-muted-foreground text-center mb-4">
                  No settled bets found for the selected filters. Try adjusting your filters or settle some bets.
                </p>
                <Link href="/">
                  <Button>Go to Dashboard</Button>
                </Link>
              </CardContent>
            </Card>
          )}
        </div>
      </main>
    </div>
  );
}

