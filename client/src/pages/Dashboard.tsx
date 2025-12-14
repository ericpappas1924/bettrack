import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { MetricCard } from "@/components/MetricCard";
import { BetTable } from "@/components/BetTable";
import { BetFilters } from "@/components/BetFilters";
import { BetCalendar } from "@/components/BetCalendar";
import { AddBetDialog } from "@/components/AddBetDialog";
import { BetDetailDialog } from "@/components/BetDetailDialog";
import { ImportBetsDialog } from "@/components/ImportBetsDialog";
import { EmptyState } from "@/components/EmptyState";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import type { LiveStat } from "@/components/LiveStatsBadge";
import type { ParlayLiveStats } from "@/components/ParlayLiveProgress";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Plus, DollarSign, TrendingUp, Target, BarChart3, Zap, Upload, Loader2, LogOut, User, X, CalendarDays, Users } from "lucide-react";
import { Link } from "wouter";
import { format, isSameDay, startOfDay, isToday } from "date-fns";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import type { Bet } from "@shared/schema";
import { getGameStatus, type Sport } from "@shared/betTypes";

export default function Dashboard() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [addBetOpen, setAddBetOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [detailBet, setDetailBet] = useState<Bet | null>(null);
  const [sport, setSport] = useState("all");
  const [status, setStatus] = useState("all");
  const [gameStatus, setGameStatus] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [fetchingCLV, setFetchingCLV] = useState<Set<string>>(new Set());
  const [selectedDate, setSelectedDate] = useState<Date | null>(new Date());
  const [showCalendar, setShowCalendar] = useState(false);
  const [mobileCalendarOpen, setMobileCalendarOpen] = useState(false);

  const { data: bets = [], isLoading } = useQuery<Bet[]>({
    queryKey: ["/api/bets"],
    staleTime: 5000, // Consider fresh for 5 seconds, then refetch
  });

  // Compute refetch interval: only refetch if there are live bets
  const refetchInterval = useMemo(() => {
    const hasLiveBets = bets.some((bet) => {
      if (bet.status !== "active" || !bet.gameStartTime) return false;
      const gameStatus = getGameStatus(bet.gameStartTime, bet.sport as Sport);
      return gameStatus === 'live';
    });
    return hasLiveBets ? 60000 : false; // Refetch every 60s for live, stop for completed only
  }, [bets]);

  // Fetch live stats for ALL active bets that are currently live or completed
  // Always enabled - fetches in parallel with bets, backend handles empty case
  const { data: liveStats = [], refetch: refetchLiveStats, isLoading: isLoadingLiveStats } = useQuery<LiveStat[]>({
    queryKey: ["/api/bets/live-stats"],
    refetchInterval,
    staleTime: 0, // Always fetch fresh on page load - don't use cached data
    refetchOnMount: 'always', // Always refetch when component mounts
  });

  // Check if there are any active parlays/round robins
  const hasActiveParlays = bets.some((bet) => {
    if (bet.status !== 'active') return false;
    const betType = bet.betType?.toLowerCase() || '';
    return betType.includes('parlay') || betType.includes('teaser') || betType.includes('round robin');
  });

  // Fetch parlay live stats (for active parlays)
  // Always enabled - fetches in parallel with bets, backend handles empty case
  const { data: parlayLiveStats = [] } = useQuery<ParlayLiveStats[]>({
    queryKey: ["/api/bets/parlay-live-stats"],
    refetchInterval: hasActiveParlays ? 60000 : false,
    staleTime: 0, // Always fetch fresh on page load
    refetchOnMount: 'always', // Always refetch when component mounts
  });

  // Helper to get parlay stats for a specific bet
  const getParlayLiveStatsForBet = (betId: string): ParlayLiveStats | null => {
    return parlayLiveStats.find(p => p.betId === betId) || null;
  };

  // Helper to get live stats for a specific bet
  const getLiveStatForBet = (betId: string): LiveStat | null => {
    return liveStats.find(s => s.betId === betId) || null;
  };

  // Debug logging for live stats
  useEffect(() => {
    if (liveStats.length > 0) {
      console.log(`✅ [DASHBOARD] Received ${liveStats.length} live stat(s):`, liveStats.map(stat => ({
        betId: stat.betId?.substring(0, 8),
        betType: stat.betType,
        playerName: stat.playerName,
        currentValue: stat.currentValue,
        targetValue: stat.targetValue,
        isLive: stat.isLive,
        status: stat.status
      })));
    } else if (!isLoadingLiveStats && bets.some(b => {
      if (b.status !== "active" || !b.gameStartTime) return false;
      const gameStatus = getGameStatus(b.gameStartTime, b.sport as Sport);
      return gameStatus === 'live';
    })) {
      console.warn(`⚠️  [DASHBOARD] No live stats received but live bets exist`);
    }
  }, [liveStats, isLoadingLiveStats, bets]);

  // Debug logging for parlay live stats
  useEffect(() => {
    if (hasActiveParlays) {
      console.log(`🎲 [DASHBOARD] Active parlays detected - polling enabled`);
      if (parlayLiveStats.length > 0) {
        console.log(`✅ [DASHBOARD] Received parlay stats for ${parlayLiveStats.length} parlay(s):`, parlayLiveStats.map(p => ({
          betId: p.betId.substring(0, 8),
          legsCount: p.legs.length,
          liveLegs: p.legs.filter(l => l.isLive).length
        })));
      }
    }
  }, [hasActiveParlays, parlayLiveStats]);

  // Live stats are fetched via API with refetchInterval
  // Server-side scheduler ensures games are always tracked
  useEffect(() => {
    const hasLiveBets = bets.some((bet) => {
      if (bet.status !== "active" || !bet.gameStartTime) return false;
      const gameStatus = getGameStatus(bet.gameStartTime, bet.sport as Sport);
      return gameStatus === 'live';
    });
    
    if (hasLiveBets) {
      console.log(`🔴 [DASHBOARD] Live bets detected - auto-refresh enabled`);
    }
  }, [bets]);

  // Auto-refresh game status badges every 60 seconds
  // This forces re-render to update pregame/live/completed status without API calls
  const [, setRefreshTrigger] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => {
      setRefreshTrigger(prev => prev + 1);
    }, 60000); // Every 60 seconds
    
    return () => clearInterval(interval);
  }, []);

  // Note: Auto-settlement now runs SERVER-SIDE (every 5 minutes)
  // No client-side timer needed - server handles it 24/7
  useEffect(() => {
    const completedBets = bets.filter((bet) => {
      if (bet.status !== "active" || !bet.gameStartTime) return false;
      const gameStatus = getGameStatus(bet.gameStartTime, bet.sport as Sport);
      return gameStatus === 'completed';
    });
    
    if (completedBets.length > 0) {
      console.log(`ℹ️  [DASHBOARD] ${completedBets.length} completed bet(s) detected`);
      console.log(`   Server-side auto-settlement will process within 5 minutes`);
    }
  }, [bets]);

  const importMutation = useMutation({
    mutationFn: async (importedBets: any[]) => {
      const res = await apiRequest("POST", "/api/bets/import", importedBets);
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/bets"] });
      
      // Handle new response format with both imported and failed bets
      const imported = data.imported || data;
      const failed = data.failed || [];
      const enrichment = data.enrichment || { matchups: 0, gameTimes: 0 };
      
      let description = `Imported ${imported.length} bet${imported.length !== 1 ? 's' : ''}`;
      
      // Add enrichment info
      if (enrichment.matchups > 0 || enrichment.gameTimes > 0) {
        const enrichedItems = [];
        if (enrichment.matchups > 0) enrichedItems.push(`${enrichment.matchups} opponent${enrichment.matchups !== 1 ? 's' : ''} found`);
        if (enrichment.gameTimes > 0) enrichedItems.push(`${enrichment.gameTimes} time${enrichment.gameTimes !== 1 ? 's' : ''} added`);
        description += `. Auto-enriched: ${enrichedItems.join(', ')}`;
      }
      
      if (failed.length > 0) {
        // Partial success
        toast({
          title: "Partial import success",
          description: `${description}. ${failed.length} failed validation.`,
          variant: "default",
        });
        console.warn('Failed bets:', failed);
      } else {
        // Full success
        toast({
          title: "Bets imported",
          description,
        });
      }
    },
    onError: (error: Error) => {
      if (isUnauthorizedError(error)) {
        toast({ title: "Session expired", description: "Please log in again", variant: "destructive" });
        setTimeout(() => { window.location.href = "/api/login"; }, 500);
        return;
      }
      toast({ title: "Import failed", description: error.message, variant: "destructive" });
    },
  });

  const updateBetMutation = useMutation({
    mutationFn: async ({ id, ...data }: { id: string; liveOdds?: string }) => {
      const res = await apiRequest("PATCH", `/api/bets/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/bets"] });
    },
    onError: (error: Error) => {
      if (isUnauthorizedError(error)) {
        toast({ title: "Session expired", description: "Please log in again", variant: "destructive" });
        setTimeout(() => { window.location.href = "/api/login"; }, 500);
        return;
      }
      toast({ title: "Update failed", description: error.message, variant: "destructive" });
    },
  });

  const settleBetMutation = useMutation({
    mutationFn: async ({ id, result }: { id: string; result: "won" | "lost" | "push" }) => {
      const res = await apiRequest("POST", `/api/bets/${id}/settle`, { result });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/bets"] });
      setDetailBet(null);
      toast({ title: "Bet settled", description: "The bet has been marked as settled" });
    },
    onError: (error: Error) => {
      if (isUnauthorizedError(error)) {
        toast({ title: "Session expired", description: "Please log in again", variant: "destructive" });
        setTimeout(() => { window.location.href = "/api/login"; }, 500);
        return;
      }
      toast({ title: "Settlement failed", description: error.message, variant: "destructive" });
    },
  });

  const fetchCLVMutation = useMutation({
    mutationFn: async (betId: string) => {
      const res = await apiRequest("POST", `/api/bets/${betId}/auto-fetch-clv`, {});
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/bets"] });
      toast({
        title: "CLV fetched",
        description: `CLV: ${data.clv}%, EV: $${data.expectedValue}`,
      });
    },
    onError: (error: Error) => {
      if (isUnauthorizedError(error)) {
        toast({ title: "Session expired", description: "Please log in again", variant: "destructive" });
        setTimeout(() => { window.location.href = "/api/login"; }, 500);
        return;
      }
      const errorMessage = error.message || '';
      let description = "Could not find closing odds. Please enter manually.";
      
      if (errorMessage.includes("legacy bet") || errorMessage.includes("Invalid game matchup")) {
        description = "This is an older bet without matchup info. Please enter closing odds manually.";
      } else if (errorMessage.includes("Could not find current odds")) {
        description = "Unable to fetch odds for this bet. Please enter manually.";
      }
      
      toast({ title: "Auto-fetch failed", description, variant: "destructive" });
    },
  });

  const filteredBets = bets.filter((bet) => {
    const matchesSport = sport === "all" || bet.sport === sport;
    const matchesStatus = status === "all" || bet.status === status;
    const matchesSearch =
      searchQuery === "" ||
      bet.team.toLowerCase().includes(searchQuery.toLowerCase()) ||
      bet.betType.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (bet.game && bet.game.toLowerCase().includes(searchQuery.toLowerCase()));
    
    // Game status filtering
    let matchesGameStatus = true;
    if (gameStatus !== "all" && bet.gameStartTime && bet.sport) {
      const currentGameStatus = getGameStatus(bet.gameStartTime, bet.sport as Sport);
      matchesGameStatus = currentGameStatus === gameStatus;
    } else if (gameStatus !== "all" && !bet.gameStartTime) {
      matchesGameStatus = false;
    }
    
    // Date filtering - filter by gameStartTime or createdAt
    let matchesDate = true;
    if (selectedDate) {
      const betDate = bet.gameStartTime ? new Date(bet.gameStartTime) : new Date(bet.createdAt);
      matchesDate = isSameDay(startOfDay(betDate), startOfDay(selectedDate));
    }
    
    return matchesSport && matchesStatus && matchesGameStatus && matchesSearch && matchesDate;
  });

  const activeBets = bets.filter((bet) => bet.status === "active");
  const settledBets = bets.filter((bet) => bet.status === "settled");

  const totalPL = settledBets.reduce(
    (sum, bet) => sum + (bet.profit ? parseFloat(bet.profit) : 0),
    0
  );

  const wins = settledBets.filter((bet) => bet.result === "won").length;
  const winRate = settledBets.length > 0 ? (wins / settledBets.length) * 100 : 0;

  const totalStaked = settledBets.reduce(
    (sum, bet) => sum + parseFloat(bet.stake),
    0
  );
  const roi = totalStaked > 0 ? (totalPL / totalStaked) * 100 : 0;

  const totalAtRisk = activeBets.reduce(
    (sum, bet) => sum + parseFloat(bet.stake),
    0
  );

  const totalPotentialWin = activeBets.reduce(
    (sum, bet) => sum + (bet.potentialWin ? parseFloat(bet.potentialWin) : 0),
    0
  );

  // Daily profit - bets settled today
  const today = startOfDay(new Date());
  const todaySettledBets = settledBets.filter((bet) => {
    const settledDate = bet.settledAt ? new Date(bet.settledAt) : new Date(bet.createdAt);
    return isSameDay(startOfDay(settledDate), today);
  });
  const dailyPL = todaySettledBets.reduce(
    (sum, bet) => sum + (bet.profit ? parseFloat(bet.profit) : 0),
    0
  );

  const handleFetchCLV = (betId: string) => {
    setFetchingCLV(prev => new Set(prev).add(betId));
    fetchCLVMutation.mutate(betId, {
      onSettled: () => {
        setFetchingCLV(prev => {
          const next = new Set(prev);
          next.delete(betId);
          return next;
        });
      },
    });
  };

  const handleAddBet = async (data: any) => {
    try {
      // Convert gameStartTime from string to Date if provided
      const betData = {
        ...data,
        gameStartTime: data.gameStartTime ? new Date(data.gameStartTime).toISOString() : null,
      };
      
      const res = await apiRequest("POST", "/api/bets", betData);
      await res.json();
      
      queryClient.invalidateQueries({ queryKey: ["/api/bets"] });
      toast({
        title: "Bet added",
        description: "Your bet has been successfully added",
      });
      setAddBetOpen(false);
    } catch (error) {
      if (isUnauthorizedError(error as Error)) {
        toast({ title: "Session expired", description: "Please log in again", variant: "destructive" });
        setTimeout(() => { window.location.href = "/api/login"; }, 500);
        return;
      }
      toast({
        title: "Failed to add bet",
        description: (error as Error).message,
        variant: "destructive",
      });
    }
  };

  const handleImportBets = (importedBets: any[]) => {
    const formattedBets = importedBets.map((bet) => ({
      externalId: bet.id,
      sport: bet.sport,
      betType: bet.betType,
      team: bet.team,
      game: bet.game || null,
      openingOdds: bet.openingOdds,
      liveOdds: bet.liveOdds || null,
      closingOdds: bet.closingOdds || null,
      stake: bet.stake,
      potentialWin: bet.potentialWin || null,
      status: bet.status,
      result: bet.result || null,
      profit: bet.profit || null,
      clv: bet.clv || null,
      projectionSource: bet.projectionSource || null,
      notes: bet.notes || null,
      isFreePlay: bet.isFreePlay || false,
      gameStartTime: bet.gameStartTime ? new Date(bet.gameStartTime) : null,
      settledAt: bet.settledAt ? new Date(bet.settledAt) : null,
    }));
    importMutation.mutate(formattedBets);
    setImportOpen(false);
  };

  const handleClearFilters = () => {
    setSport("all");
    setStatus("all");
    setGameStatus("all");
    setSearchQuery("");
  };

  const handleClearDate = () => {
    setSelectedDate(null);
  };

  const hasActiveFilters = sport !== "all" || status !== "all" || gameStatus !== "all" || searchQuery !== "";
  const isViewingAllBets = !selectedDate && !hasActiveFilters;

  const handleUpdateLiveOdds = (betId: string, liveOdds: string) => {
    updateBetMutation.mutate({ id: betId, liveOdds });
    if (detailBet && detailBet.id === betId) {
      setDetailBet({ ...detailBet, liveOdds });
    }
  };

  const handleSettleBet = (result: "won" | "lost" | "push") => {
    if (detailBet) {
      settleBetMutation.mutate({ id: detailBet.id, result });
    }
  };

  const deleteBetMutation = useMutation({
    mutationFn: async (betId: string) => {
      await apiRequest("DELETE", `/api/bets/${betId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/bets"] });
      toast({ title: "Bet deleted", description: "The bet has been removed" });
    },
    onError: (error: Error) => {
      if (isUnauthorizedError(error)) {
        toast({ title: "Session expired", description: "Please log in again", variant: "destructive" });
        setTimeout(() => { window.location.href = "/api/login"; }, 500);
        return;
      }
      toast({ title: "Delete failed", description: error.message, variant: "destructive" });
    },
  });

  const handleDeleteBet = (betId: string) => {
    deleteBetMutation.mutate(betId);
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

  return (
    <div className="min-h-screen bg-background pb-20 md:pb-0">
      {/* Header */}
      <header className="border-b sticky top-0 bg-background z-50">
        <div className="flex items-center justify-between px-4 py-3 max-w-7xl mx-auto">
          <div>
            <h1 className="text-lg sm:text-xl font-bold">BetTrack</h1>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/social">
              <Button variant="outline" size="sm" data-testid="button-social">
                <Users className="h-4 w-4 md:mr-2" />
                <span className="hidden md:inline">Social</span>
              </Button>
            </Link>
            <ThemeToggle />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="rounded-full" data-testid="button-user-menu">
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
                  <a href="/api/logout" data-testid="button-logout">
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
          {/* Metrics Grid - Scrollable on mobile */}
          <div className="grid grid-cols-2 md:grid-cols-6 gap-2 sm:gap-3">
            <MetricCard
              label="Today's P/L"
              value={`${dailyPL >= 0 ? "$" : "-$"}${Math.abs(dailyPL).toFixed(2)}`}
              trend={todaySettledBets.length > 0 ? { value: `${todaySettledBets.length} bet${todaySettledBets.length !== 1 ? 's' : ''}`, positive: dailyPL >= 0 } : undefined}
              icon={<CalendarDays className="h-4 w-4" />}
            />
            <MetricCard
              label="Total P/L"
              value={`${totalPL >= 0 ? "$" : "-$"}${Math.abs(totalPL).toFixed(2)}`}
              trend={settledBets.length > 0 ? { value: `${roi >= 0 ? '+' : ''}${roi.toFixed(1)}%`, positive: totalPL >= 0 } : undefined}
              icon={<DollarSign className="h-4 w-4" />}
            />
            <MetricCard
              label="Win Rate"
              value={settledBets.length > 0 ? `${winRate.toFixed(0)}%` : "-"}
              trend={settledBets.length > 0 ? { value: `${wins}/${settledBets.length}`, positive: winRate >= 50 } : undefined}
              icon={<Target className="h-4 w-4" />}
            />
            <MetricCard
              label="Active"
              value={activeBets.length.toString()}
              trend={activeBets.length > 0 ? { value: `$${totalAtRisk.toFixed(0)}`, positive: true } : undefined}
              icon={<BarChart3 className="h-4 w-4" />}
            />
            <MetricCard
              label="To Win"
              value={`$${totalPotentialWin.toFixed(0)}`}
              trend={activeBets.length > 0 ? { value: `${activeBets.length} bets`, positive: true } : undefined}
              icon={<TrendingUp className="h-4 w-4" />}
            />
            <MetricCard
              label="ROI"
              value={settledBets.length > 0 ? `${roi >= 0 ? '+' : ''}${roi.toFixed(1)}%` : "-"}
              trend={settledBets.length > 0 ? {
                value: `$${totalStaked.toFixed(0)} staked`,
                positive: roi >= 0,
              } : undefined}
              icon={<Zap className="h-4 w-4" />}
              className="col-span-2 md:col-span-1"
            />
          </div>

          {/* Bets Section */}
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base sm:text-lg font-semibold">Your Bets</h2>
                {/* Mobile Calendar Sheet Trigger */}
                <Sheet open={mobileCalendarOpen} onOpenChange={setMobileCalendarOpen}>
                  <SheetTrigger asChild>
                    <Badge 
                      variant="secondary" 
                      className="gap-1 cursor-pointer hover-elevate md:hidden"
                      data-testid="badge-mobile-calendar-trigger"
                    >
                      <CalendarDays className="h-3 w-3" />
                      {selectedDate ? (isToday(selectedDate) ? 'Today' : format(selectedDate, 'MMM d')) : 'All dates'}
                    </Badge>
                  </SheetTrigger>
                  <SheetContent side="bottom" className="h-auto max-h-[80vh]">
                    <SheetHeader className="pb-2">
                      <SheetTitle>Select Date</SheetTitle>
                    </SheetHeader>
                    <div className="pb-4">
                      <BetCalendar
                        bets={bets}
                        selectedDate={selectedDate}
                        onSelectDate={(date) => {
                          setSelectedDate(date);
                          setMobileCalendarOpen(false);
                        }}
                      />
                      {selectedDate && (
                        <Button 
                          variant="outline" 
                          className="w-full mt-3"
                          onClick={() => {
                            setSelectedDate(null);
                            setMobileCalendarOpen(false);
                          }}
                          data-testid="button-mobile-clear-date"
                        >
                          View All Dates
                        </Button>
                      )}
                    </div>
                  </SheetContent>
                </Sheet>
                {/* Desktop Date Badge */}
                {selectedDate && (
                  <Badge 
                    variant="secondary" 
                    className="gap-1 cursor-pointer hover-elevate hidden md:flex"
                    onClick={handleClearDate}
                    data-testid="badge-selected-date"
                  >
                    <CalendarDays className="h-3 w-3" />
                    {isToday(selectedDate) ? 'Today' : format(selectedDate, 'MMM d')}
                    <X className="h-3 w-3 ml-1" />
                  </Badge>
                )}
                {!selectedDate && (
                  <Badge variant="outline" className="text-xs hidden md:flex" data-testid="badge-all-dates">
                    All dates
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => setShowCalendar(!showCalendar)}
                  className="hidden md:flex"
                  data-testid="button-toggle-calendar"
                >
                  <CalendarDays className="h-4 w-4 mr-2" />
                  {showCalendar ? 'Hide' : 'Show'} Calendar
                </Button>
                <Button variant="outline" size="sm" onClick={() => setImportOpen(true)} data-testid="button-import-bets">
                  <Upload className="h-4 w-4 md:mr-2" />
                  <span className="hidden md:inline">Import</span>
                </Button>
                <Button size="sm" onClick={() => setAddBetOpen(true)} data-testid="button-add-bet">
                  <Plus className="h-4 w-4 md:mr-2" />
                  <span className="hidden md:inline">Add Bet</span>
                </Button>
              </div>
            </div>

            {/* Calendar and Filters Layout */}
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
              {/* Calendar - Hidden on mobile by default, shown on desktop */}
              {showCalendar && (
                <div className="lg:col-span-1 hidden md:block">
                  <BetCalendar
                    bets={bets}
                    selectedDate={selectedDate}
                    onSelectDate={setSelectedDate}
                  />
                </div>
              )}
              
              {/* Bets list */}
              <div className={showCalendar ? "lg:col-span-3" : "lg:col-span-4"}>
                <div className="space-y-4">
                  <BetFilters
                    sport={sport}
                    status={status}
                    gameStatus={gameStatus}
                    searchQuery={searchQuery}
                    onSportChange={setSport}
                    onStatusChange={setStatus}
                    onGameStatusChange={setGameStatus}
                    onSearchChange={setSearchQuery}
                    onClear={handleClearFilters}
                  />

                  {bets.length === 0 ? (
                    <EmptyState
                      title="No bets yet"
                      description="Import your bets or add them manually to start tracking."
                      actionLabel="Import Bets"
                      onAction={() => setImportOpen(true)}
                    />
                  ) : filteredBets.length === 0 ? (
                    <EmptyState
                      title="No bets found"
                      description={selectedDate 
                        ? `No bets on ${isToday(selectedDate) ? 'today' : format(selectedDate, 'MMM d, yyyy')}. Try selecting a different date or clear the date filter.`
                        : "Try adjusting your filters."
                      }
                      actionLabel={selectedDate ? "View All Dates" : "Clear Filters"}
                      onAction={selectedDate ? handleClearDate : handleClearFilters}
                    />
                  ) : (
                    <BetTable
                      bets={filteredBets}
                      liveStats={liveStats}
                      parlayLiveStats={parlayLiveStats}
                      onRowClick={(bet) => setDetailBet(bet as Bet)}
                      onFetchCLV={handleFetchCLV}
                      fetchingCLV={fetchingCLV}
                    />
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Mobile Bottom Action Bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-background border-t p-3 flex gap-2 md:hidden">
        <Button variant="outline" className="flex-1" onClick={() => setImportOpen(true)}>
          <Upload className="h-4 w-4 mr-2" />
          Import
        </Button>
        <Button className="flex-1" onClick={() => setAddBetOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Add Bet
        </Button>
      </div>

      <AddBetDialog
        open={addBetOpen}
        onOpenChange={setAddBetOpen}
        onSubmit={handleAddBet}
      />

      <ImportBetsDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        onImport={handleImportBets}
      />

      <BetDetailDialog
        bet={detailBet}
        open={!!detailBet}
        onOpenChange={(open) => !open && setDetailBet(null)}
        onUpdateLiveOdds={handleUpdateLiveOdds}
        onSettle={handleSettleBet}
        onDelete={handleDeleteBet}
        parlayLiveStats={detailBet ? getParlayLiveStatsForBet(detailBet.id) : null}
        liveStat={detailBet ? getLiveStatForBet(detailBet.id) : null}
      />
    </div>
  );
}
