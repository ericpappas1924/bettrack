import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Trophy, TrendingUp, Users, Copy, ArrowLeft, Loader2, LogOut, User, ChevronRight, Eye, Clock, Target, Check, X, Flame, Snowflake, CheckCircle2 } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import { Link } from "wouter";
import type { Bet, User as UserType, PotdCategory } from "@shared/schema";

type BetWithUser = Bet & { user: UserType };

type LeaderboardEntry = {
  user: UserType;
  totalBets: number;
  settledBets: number;
  wonBets: number;
  totalStake: number;
  totalProfit: number;
  roi: number;
  avgClv: number | null;
};

type PotdStats = {
  totalWins: number;
  totalLosses: number;
  totalPushes: number;
  totalUnits: string;
  winRate: string;
  record: string;
};

// Parse parlay legs from notes field
interface ParsedLeg {
  dateTime: string;
  sport: string;
  details: string;
  status?: 'won' | 'lost' | 'pending';
  score?: string;
}

function parseParlayLegs(notes: string | null | undefined): ParsedLeg[] {
  if (!notes) return [];
  
  const legs: ParsedLeg[] = [];
  const lines = notes.split('\n').filter((l: string) => {
    const trimmed = l.trim();
    return trimmed && 
           !trimmed.startsWith('Category:') && 
           !trimmed.startsWith('League:') &&
           !trimmed.startsWith('Game ID:') &&
           !trimmed.startsWith('Auto-settled:') &&
           !trimmed.startsWith('Tailed from');
  });
  
  for (const legLine of lines) {
    // Pattern: [DATE TIME] [SPORT] BET DETAILS [Status] (Score: X-Y)
    const legMatch = legLine.match(/\[([^\]]+)\]\s*\[([^\]]+)\]\s*(.+)/);
    if (!legMatch) continue;
    
    const dateTime = legMatch[1];
    const sport = legMatch[2];
    let details = legMatch[3].trim();
    
    // Extract status if present
    let status: 'won' | 'lost' | 'pending' | undefined;
    if (details.includes('[Won]')) {
      status = 'won';
      details = details.replace('[Won]', '').trim();
    } else if (details.includes('[Lost]')) {
      status = 'lost';
      details = details.replace('[Lost]', '').trim();
    } else if (details.includes('[Pending]')) {
      status = 'pending';
      details = details.replace('[Pending]', '').trim();
    }
    
    // Extract score if present
    let score: string | undefined;
    const scoreMatch = details.match(/\(Score:\s*([^)]+)\)/);
    if (scoreMatch) {
      score = scoreMatch[1];
      details = details.replace(scoreMatch[0], '').trim();
    }
    
    legs.push({ dateTime, sport, details, status, score });
  }
  
  return legs;
}

export default function SocialDashboard() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [selectedUser, setSelectedUser] = useState<UserType | null>(null);
  const [tailDialogOpen, setTailDialogOpen] = useState(false);
  const [betToTail, setBetToTail] = useState<BetWithUser | null>(null);
  const [tailStake, setTailStake] = useState("");
  const [detailBet, setDetailBet] = useState<BetWithUser | null>(null);
  const [selectedPotdCategory, setSelectedPotdCategory] = useState<string | null>(null);
  const [settleDialogOpen, setSettleDialogOpen] = useState(false);
  const [betToSettle, setBetToSettle] = useState<BetWithUser | null>(null);

  const { data: feed = [], isLoading: feedLoading } = useQuery<BetWithUser[]>({
    queryKey: ["/api/social/feed"],
  });

  const { data: leaderboard = [], isLoading: leaderboardLoading } = useQuery<LeaderboardEntry[]>({
    queryKey: ["/api/social/leaderboard"],
  });

  const { data: userBets = [], isLoading: userBetsLoading } = useQuery<BetWithUser[]>({
    queryKey: ["/api/social/users", selectedUser?.id, "bets"],
    enabled: !!selectedUser,
  });

  const { data: potdCategories = [], isLoading: potdCategoriesLoading } = useQuery<PotdCategory[]>({
    queryKey: ["/api/potd/categories"],
  });

  const { data: potdBets = [], isLoading: potdBetsLoading } = useQuery<BetWithUser[]>({
    queryKey: ["/api/potd/bets", selectedPotdCategory],
  });

  const { data: potdStats } = useQuery<PotdStats>({
    queryKey: ["/api/potd/stats"],
  });

  const tailMutation = useMutation({
    mutationFn: async ({ betId, stake }: { betId: string; stake?: string }) => {
      const res = await apiRequest("POST", `/api/bets/${betId}/tail`, stake ? { stake } : {});
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/bets"] });
      queryClient.invalidateQueries({ queryKey: ["/api/social/feed"] });
      toast({ title: "Bet tailed!", description: "The bet has been added to your tracker" });
      setTailDialogOpen(false);
      setBetToTail(null);
      setTailStake("");
    },
    onError: (error: Error) => {
      if (isUnauthorizedError(error)) {
        toast({ title: "Session expired", description: "Please log in again", variant: "destructive" });
        setTimeout(() => { window.location.href = "/api/login"; }, 500);
        return;
      }
      toast({ title: "Failed to tail bet", description: error.message, variant: "destructive" });
    },
  });

  const settlePotdMutation = useMutation({
    mutationFn: async ({ betId, result }: { betId: string; result: 'won' | 'lost' | 'push' }) => {
      const res = await apiRequest("POST", `/api/potd/bets/${betId}/settle`, { result });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/potd/bets"] });
      queryClient.invalidateQueries({ queryKey: ["/api/potd/categories"] });
      queryClient.invalidateQueries({ queryKey: ["/api/potd/stats"] });
      toast({ title: "POTD Settled!", description: "The bet and category stats have been updated" });
      setSettleDialogOpen(false);
      setBetToSettle(null);
    },
    onError: (error: Error) => {
      if (isUnauthorizedError(error)) {
        toast({ title: "Session expired", description: "Please log in again", variant: "destructive" });
        setTimeout(() => { window.location.href = "/api/login"; }, 500);
        return;
      }
      toast({ title: "Failed to settle bet", description: error.message, variant: "destructive" });
    },
  });

  const getUserInitials = (u: UserType | null | undefined) => {
    if (u?.firstName && u?.lastName) {
      return `${u.firstName[0]}${u.lastName[0]}`.toUpperCase();
    }
    if (u?.email) {
      return u.email[0].toUpperCase();
    }
    return "U";
  };

  const getUserDisplayName = (u: UserType | null | undefined) => {
    if (u?.firstName && u?.lastName) {
      return `${u.firstName} ${u.lastName}`;
    }
    if (u?.firstName) {
      return u.firstName;
    }
    if (u?.email) {
      return u.email.split("@")[0];
    }
    return "User";
  };

  const formatOdds = (odds: string) => {
    const num = parseFloat(odds);
    return num > 0 ? `+${num}` : `${num}`;
  };

  const handleTailClick = (bet: BetWithUser) => {
    setBetToTail(bet);
    setTailStake(bet.stake);
    setTailDialogOpen(true);
  };

  const handleConfirmTail = () => {
    if (betToTail) {
      tailMutation.mutate({ betId: betToTail.id, stake: tailStake || undefined });
    }
  };

  const handleViewDetails = (bet: BetWithUser) => {
    setDetailBet(bet);
  };

  const handleSettlePotd = (bet: BetWithUser) => {
    setBetToSettle(bet);
    setSettleDialogOpen(true);
  };

  const handleConfirmSettle = (result: 'won' | 'lost' | 'push') => {
    if (betToSettle) {
      settlePotdMutation.mutate({ betId: betToSettle.id, result });
    }
  };

  const getStreakIcon = (streak: number) => {
    if (streak >= 3) return <Flame className="h-4 w-4 text-orange-500" />;
    if (streak <= -3) return <Snowflake className="h-4 w-4 text-blue-500" />;
    if (streak > 0) return <Flame className="h-3 w-3 text-orange-400/70" />;
    if (streak < 0) return <Snowflake className="h-3 w-3 text-blue-400/70" />;
    return null;
  };

  const getStreakText = (streak: number) => {
    if (streak === 0) return null;
    const absStreak = Math.abs(streak);
    return `${absStreak}${streak > 0 ? 'W' : 'L'}`;
  };

  const getCategoryRecord = (cat: PotdCategory) => {
    if (cat.pushes > 0) {
      return `${cat.wins}-${cat.losses}-${cat.pushes}`;
    }
    return `${cat.wins}-${cat.losses}`;
  };

  const activeFeedBets = feed.filter(bet => bet.status === 'active');
  const activePotdBets = potdBets.filter(bet => bet.status === 'active');
  const settledPotdBets = potdBets.filter(bet => bet.status === 'settled');

  if (feedLoading || leaderboardLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b sticky top-0 bg-background z-50">
        <div className="flex items-center justify-between px-4 py-3 max-w-7xl mx-auto">
          <div className="flex items-center gap-3">
            <Link href="/">
              <Button variant="ghost" size="icon" data-testid="button-back-dashboard">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
            <div>
              <h1 className="text-lg sm:text-xl font-bold">Social</h1>
              <p className="text-xs text-muted-foreground hidden sm:block">See what others are betting</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="rounded-full" data-testid="button-user-menu">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={user?.profileImageUrl || undefined} alt={user?.firstName || "User"} />
                    <AvatarFallback>{getUserInitials(user)}</AvatarFallback>
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
        {selectedUser ? (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="sm" onClick={() => setSelectedUser(null)} data-testid="button-back-feed">
                <ArrowLeft className="h-4 w-4 mr-1" />
                Back
              </Button>
            </div>
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center gap-3">
                  <Avatar className="h-12 w-12">
                    <AvatarImage src={selectedUser.profileImageUrl || undefined} />
                    <AvatarFallback>{getUserInitials(selectedUser)}</AvatarFallback>
                  </Avatar>
                  <div>
                    <CardTitle className="text-lg">{getUserDisplayName(selectedUser)}</CardTitle>
                    <p className="text-sm text-muted-foreground">
                      {userBets.length} bet{userBets.length !== 1 ? 's' : ''}
                    </p>
                  </div>
                </div>
              </CardHeader>
            </Card>
            
            <div className="space-y-3">
              <h3 className="font-semibold">Bets</h3>
              {userBetsLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : userBets.length === 0 ? (
                <Card className="py-8 text-center text-muted-foreground">
                  No bets yet
                </Card>
              ) : (
                userBets.map((bet) => (
                  <BetCard
                    key={bet.id}
                    bet={bet}
                    currentUserId={user?.id}
                    onTail={handleTailClick}
                    onViewDetails={handleViewDetails}
                    formatOdds={formatOdds}
                    getUserInitials={getUserInitials}
                    getUserDisplayName={getUserDisplayName}
                    showUser={false}
                  />
                ))
              )}
            </div>
          </div>
        ) : (
          <Tabs defaultValue="feed" className="space-y-4">
            <TabsList className="grid w-full grid-cols-3 max-w-md">
              <TabsTrigger value="feed" data-testid="tab-feed">
                <Users className="h-4 w-4 mr-1 sm:mr-2" />
                <span className="hidden sm:inline">Feed</span>
                <span className="sm:hidden">Feed</span>
              </TabsTrigger>
              <TabsTrigger value="potd" data-testid="tab-potd">
                <Flame className="h-4 w-4 mr-1 sm:mr-2" />
                <span className="hidden sm:inline">Plays</span>
                <span className="sm:hidden">POTD</span>
              </TabsTrigger>
              <TabsTrigger value="leaderboard" data-testid="tab-leaderboard">
                <Trophy className="h-4 w-4 mr-1 sm:mr-2" />
                <span className="hidden sm:inline">Rankings</span>
                <span className="sm:hidden">Ranks</span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="feed" className="space-y-3">
              {activeFeedBets.length === 0 ? (
                <Card className="py-12 text-center">
                  <Users className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
                  <p className="text-muted-foreground">No active bets from other users</p>
                  <p className="text-sm text-muted-foreground mt-1">Check back later!</p>
                </Card>
              ) : (
                activeFeedBets.map((bet) => (
                  <BetCard
                    key={bet.id}
                    bet={bet}
                    currentUserId={user?.id}
                    onTail={handleTailClick}
                    onUserClick={setSelectedUser}
                    onViewDetails={handleViewDetails}
                    formatOdds={formatOdds}
                    getUserInitials={getUserInitials}
                    getUserDisplayName={getUserDisplayName}
                    showUser={true}
                  />
                ))
              )}
            </TabsContent>

            <TabsContent value="leaderboard" className="space-y-3">
              {leaderboard.length === 0 ? (
                <Card className="py-12 text-center">
                  <Trophy className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
                  <p className="text-muted-foreground">No rankings yet</p>
                  <p className="text-sm text-muted-foreground mt-1">Start placing bets to appear here!</p>
                </Card>
              ) : (
                leaderboard.map((entry, index) => (
                  <Card
                    key={entry.user.id}
                    className="hover-elevate cursor-pointer"
                    onClick={() => setSelectedUser(entry.user)}
                    data-testid={`leaderboard-entry-${entry.user.id}`}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-muted font-bold text-sm">
                          {index + 1}
                        </div>
                        <Avatar className="h-10 w-10">
                          <AvatarImage src={entry.user.profileImageUrl || undefined} />
                          <AvatarFallback>{getUserInitials(entry.user)}</AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{getUserDisplayName(entry.user)}</p>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <span>{entry.settledBets} settled</span>
                            <span className="text-muted-foreground/50">|</span>
                            <span>{entry.wonBets} won</span>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className={`font-bold tabular-nums ${entry.roi >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                            {entry.roi >= 0 ? '+' : ''}{entry.roi.toFixed(1)}% ROI
                          </div>
                          {entry.avgClv !== null && (
                            <div className="text-xs text-muted-foreground">
                              CLV: {entry.avgClv >= 0 ? '+' : ''}{entry.avgClv.toFixed(1)}%
                            </div>
                          )}
                        </div>
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </TabsContent>

            <TabsContent value="potd" className="space-y-4">
              {/* Overall Stats Card */}
              {potdStats && (
                <Card className="bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/30 border-amber-200 dark:border-amber-800">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between gap-4 flex-wrap">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-amber-100 dark:bg-amber-900/50 rounded-lg">
                          <Flame className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-sm sm:text-base">Plays of the Day</h3>
                          <p className="text-xs text-muted-foreground">Community picks</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4 sm:gap-6">
                        <div className="text-center">
                          <p className="font-bold text-lg sm:text-xl tabular-nums">{potdStats.record}</p>
                          <p className="text-xs text-muted-foreground">Record</p>
                        </div>
                        <div className="text-center">
                          <p className={`font-bold text-lg sm:text-xl tabular-nums ${parseFloat(potdStats.totalUnits) >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                            {parseFloat(potdStats.totalUnits) >= 0 ? '+' : ''}{potdStats.totalUnits}u
                          </p>
                          <p className="text-xs text-muted-foreground">Units</p>
                        </div>
                        <div className="text-center">
                          <p className="font-bold text-lg sm:text-xl tabular-nums">{potdStats.winRate}%</p>
                          <p className="text-xs text-muted-foreground">Win Rate</p>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Category Filter */}
              <div className="flex items-center gap-2 flex-wrap">
                <Label className="text-sm font-medium">Category:</Label>
                <Select
                  value={selectedPotdCategory || "all"}
                  onValueChange={(v) => setSelectedPotdCategory(v === "all" ? null : v)}
                >
                  <SelectTrigger className="w-48" data-testid="select-potd-category">
                    <SelectValue placeholder="All Categories" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Categories</SelectItem>
                    {potdCategories.map((cat) => (
                      <SelectItem key={cat.id} value={cat.id}>{cat.displayName}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Category Cards */}
              {!selectedPotdCategory && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {potdCategoriesLoading ? (
                    <div className="col-span-full flex justify-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                  ) : (
                    potdCategories.map((cat) => (
                      <Card 
                        key={cat.id} 
                        className="hover-elevate cursor-pointer"
                        onClick={() => setSelectedPotdCategory(cat.id)}
                        data-testid={`potd-category-${cat.name}`}
                      >
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <h4 className="font-medium text-sm truncate">{cat.displayName}</h4>
                                {getStreakIcon(cat.streak)}
                                {getStreakText(cat.streak) && (
                                  <span className={`text-xs font-medium ${cat.streak > 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                                    {getStreakText(cat.streak)}
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-muted-foreground mt-1">
                                {getCategoryRecord(cat)} Record
                              </p>
                            </div>
                            <div className="text-right">
                              <p className={`font-bold tabular-nums ${cat.units >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                                {cat.units >= 0 ? '+' : ''}{cat.units.toFixed(2)}u
                              </p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))
                  )}
                </div>
              )}

              {/* POTD Bets List */}
              <div className="space-y-3">
                <h4 className="font-semibold flex items-center gap-2">
                  {selectedPotdCategory ? (
                    <>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={() => setSelectedPotdCategory(null)}
                        className="h-auto p-1"
                      >
                        <ArrowLeft className="h-4 w-4" />
                      </Button>
                      {potdCategories.find(c => c.id === selectedPotdCategory)?.displayName}
                    </>
                  ) : (
                    "Active Plays"
                  )}
                </h4>
                
                {potdBetsLoading ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : activePotdBets.length === 0 ? (
                  <Card className="py-8 text-center">
                    <Flame className="h-10 w-10 mx-auto text-muted-foreground mb-2" />
                    <p className="text-muted-foreground">No active plays</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Mark a bet as Play of the Day from your tracker
                    </p>
                  </Card>
                ) : (
                  activePotdBets.map((bet) => (
                    <PotdBetCard
                      key={bet.id}
                      bet={bet}
                      category={potdCategories.find(c => c.id === bet.playOfDayCategory)}
                      currentUserId={user?.id}
                      onTail={handleTailClick}
                      onSettle={handleSettlePotd}
                      onViewDetails={handleViewDetails}
                      formatOdds={formatOdds}
                      getUserInitials={getUserInitials}
                      getUserDisplayName={getUserDisplayName}
                    />
                  ))
                )}

                {/* Settled POTD Bets */}
                {settledPotdBets.length > 0 && (
                  <div className="space-y-2 pt-4 border-t">
                    <h5 className="text-sm font-medium text-muted-foreground">Recently Settled</h5>
                    {settledPotdBets.slice(0, 5).map((bet) => (
                      <PotdBetCard
                        key={bet.id}
                        bet={bet}
                        category={potdCategories.find(c => c.id === bet.playOfDayCategory)}
                        currentUserId={user?.id}
                        onTail={handleTailClick}
                        onSettle={handleSettlePotd}
                        onViewDetails={handleViewDetails}
                        formatOdds={formatOdds}
                        getUserInitials={getUserInitials}
                        getUserDisplayName={getUserDisplayName}
                      />
                    ))}
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>
        )}
      </main>

      <Dialog open={tailDialogOpen} onOpenChange={setTailDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Tail This Bet</DialogTitle>
            <DialogDescription>
              Copy this bet to your tracker. Adjust your stake if needed.
            </DialogDescription>
          </DialogHeader>
          {betToTail && (
            <div className="space-y-4">
              <Card>
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <Badge variant="outline">{betToTail.sport}</Badge>
                    <span className="font-mono font-semibold">{formatOdds(betToTail.openingOdds)}</span>
                  </div>
                  <p className="font-medium">{betToTail.team}</p>
                  {betToTail.game && (
                    <p className="text-sm text-muted-foreground">{betToTail.game}</p>
                  )}
                  {betToTail.player && betToTail.market && (
                    <p className="text-sm text-muted-foreground">
                      {betToTail.player} {betToTail.overUnder} {betToTail.line} {betToTail.market}
                    </p>
                  )}
                </CardContent>
              </Card>
              <div className="space-y-2">
                <Label htmlFor="stake">Your Stake</Label>
                <Input
                  id="stake"
                  type="number"
                  placeholder="Enter stake amount"
                  value={tailStake}
                  onChange={(e) => setTailStake(e.target.value)}
                  data-testid="input-tail-stake"
                />
              </div>
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setTailDialogOpen(false)} data-testid="button-cancel-tail">
              Cancel
            </Button>
            <Button onClick={handleConfirmTail} disabled={tailMutation.isPending} data-testid="button-confirm-tail">
              {tailMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Copy className="h-4 w-4 mr-2" />
              )}
              Tail Bet
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!detailBet} onOpenChange={() => setDetailBet(null)}>
        <DialogContent className="max-w-lg max-h-[85vh] w-[95vw] sm:w-full overflow-hidden flex flex-col p-0">
          <DialogHeader className="px-3 sm:px-6 pt-3 sm:pt-6 pb-2 sm:pb-4 shrink-0">
            <DialogTitle className="flex items-center gap-2 text-base sm:text-lg">
              <Eye className="h-4 w-4 sm:h-5 sm:w-5" />
              Bet Details
            </DialogTitle>
          </DialogHeader>
          {detailBet && (
            <div className="overflow-y-auto flex-1 px-3 sm:px-6" style={{ maxHeight: 'calc(85vh - 140px)' }}>
              <div className="space-y-3 sm:space-y-4 pb-2">
                <div className="flex items-center gap-2 sm:gap-3 pb-2 sm:pb-3 border-b">
                  <Avatar className="h-8 w-8 sm:h-10 sm:w-10">
                    <AvatarImage src={detailBet.user.profileImageUrl || undefined} />
                    <AvatarFallback className="text-xs sm:text-sm">{getUserInitials(detailBet.user)}</AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-medium text-sm sm:text-base">{getUserDisplayName(detailBet.user)}</p>
                    <p className="text-xs sm:text-sm text-muted-foreground">
                      {detailBet.createdAt && new Date(detailBet.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-1 sm:gap-2 flex-wrap">
                      <Badge variant="outline" className="text-xs">{detailBet.sport}</Badge>
                      <Badge variant="secondary" className="text-xs">{detailBet.betType}</Badge>
                      {detailBet.status !== 'active' && (
                        <Badge variant={detailBet.result === 'won' ? 'default' : detailBet.result === 'lost' ? 'destructive' : 'secondary'} className="text-xs">
                          {detailBet.result || detailBet.status}
                        </Badge>
                      )}
                    </div>
                    <span className="font-mono font-bold text-base sm:text-lg">{formatOdds(detailBet.openingOdds)}</span>
                  </div>

                  <p className="font-semibold text-base sm:text-lg">{detailBet.team}</p>
                  
                  {detailBet.game && (
                    <p className="text-sm sm:text-base text-muted-foreground">{detailBet.game}</p>
                  )}

                  {detailBet.player && detailBet.market && (
                    <p className="text-sm sm:text-base text-muted-foreground">
                      {detailBet.player} {detailBet.overUnder} {detailBet.line} {detailBet.market}
                    </p>
                  )}
                </div>

                {(detailBet.betType === 'Parlay' || detailBet.betType === 'Teaser') && (
                  <div className="space-y-2">
                    <h4 className="font-semibold flex items-center gap-2 text-sm sm:text-base">
                      <Target className="h-3 w-3 sm:h-4 sm:w-4" />
                      Legs ({parseParlayLegs(detailBet.notes).length})
                    </h4>
                    <div className="space-y-2">
                      {parseParlayLegs(detailBet.notes).length > 0 ? (
                        parseParlayLegs(detailBet.notes).map((leg, idx) => (
                          <Card key={idx} className="p-2 sm:p-3">
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-1 sm:gap-2 mb-1 flex-wrap">
                                  <Badge variant="outline" className="text-xs">{leg.sport}</Badge>
                                  {leg.status && (
                                    <span className={`flex items-center gap-1 text-xs font-medium ${
                                      leg.status === 'won' ? 'text-green-600 dark:text-green-400' : 
                                      leg.status === 'lost' ? 'text-red-600 dark:text-red-400' : 
                                      'text-muted-foreground'
                                    }`}>
                                      {leg.status === 'won' && <Check className="h-3 w-3" />}
                                      {leg.status === 'lost' && <X className="h-3 w-3" />}
                                      {leg.status === 'pending' && <Clock className="h-3 w-3" />}
                                      {leg.status.charAt(0).toUpperCase() + leg.status.slice(1)}
                                    </span>
                                  )}
                                </div>
                                <p className="font-medium text-xs sm:text-sm">{leg.details}</p>
                                <div className="flex items-center gap-2 mt-1 flex-wrap">
                                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                                    <Clock className="h-3 w-3" />
                                    {leg.dateTime}
                                  </span>
                                  {leg.score && (
                                    <span className="text-xs text-muted-foreground">
                                      Score: {leg.score}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          </Card>
                        ))
                      ) : (
                        <p className="text-xs sm:text-sm text-muted-foreground text-center py-3">
                          No leg details available
                        </p>
                      )}
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-2 sm:gap-3 pt-2 sm:pt-3 border-t">
                  <div>
                    <p className="text-xs sm:text-sm text-muted-foreground">Stake</p>
                    <p className="font-semibold text-sm sm:text-base">${detailBet.stake}</p>
                  </div>
                  <div>
                    <p className="text-xs sm:text-sm text-muted-foreground">Potential Win</p>
                    <p className="font-semibold text-sm sm:text-base">${detailBet.potentialWin || '—'}</p>
                  </div>
                  {detailBet.clv && (
                    <div>
                      <p className="text-xs sm:text-sm text-muted-foreground">CLV</p>
                      <p className={`font-semibold text-sm sm:text-base ${parseFloat(detailBet.clv) >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                        {parseFloat(detailBet.clv) >= 0 ? '+' : ''}{detailBet.clv}%
                      </p>
                    </div>
                  )}
                  {detailBet.profit && detailBet.status === 'settled' && (
                    <div>
                      <p className="text-xs sm:text-sm text-muted-foreground">Profit</p>
                      <p className={`font-semibold text-sm sm:text-base ${parseFloat(detailBet.profit) >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                        {parseFloat(detailBet.profit) >= 0 ? '+' : ''}${detailBet.profit}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
          <DialogFooter className="gap-2 flex-shrink-0 px-3 sm:px-6 py-2 sm:py-4 border-t bg-background">
            <Button variant="outline" size="sm" onClick={() => setDetailBet(null)} data-testid="button-close-details" className="flex-1 sm:flex-none">
              Close
            </Button>
            {detailBet && detailBet.status === 'active' && detailBet.userId !== user?.id && (
              <Button 
                size="sm"
                onClick={() => {
                  setDetailBet(null);
                  handleTailClick(detailBet);
                }}
                data-testid="button-tail-from-details"
                className="flex-1 sm:flex-none"
              >
                <Copy className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                <span className="text-xs sm:text-sm">Tail Bet</span>
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Settle POTD Dialog */}
      <Dialog open={settleDialogOpen} onOpenChange={setSettleDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5" />
              Settle Play of the Day
            </DialogTitle>
            <DialogDescription>
              Mark this bet's result to update the category stats.
            </DialogDescription>
          </DialogHeader>
          {betToSettle && (
            <div className="space-y-4">
              <Card>
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <Badge variant="outline">{betToSettle.sport}</Badge>
                    <span className="font-mono font-semibold">{formatOdds(betToSettle.openingOdds)}</span>
                  </div>
                  <p className="font-medium">{betToSettle.team}</p>
                  {betToSettle.game && (
                    <p className="text-sm text-muted-foreground">{betToSettle.game}</p>
                  )}
                  <div className="flex items-center gap-2 pt-2 text-sm text-muted-foreground">
                    <span>Stake: ${betToSettle.stake}</span>
                    {betToSettle.potentialWin && (
                      <>
                        <span>|</span>
                        <span>To Win: ${betToSettle.potentialWin}</span>
                      </>
                    )}
                  </div>
                </CardContent>
              </Card>
              <div className="flex flex-col gap-2">
                <p className="text-sm font-medium">Result:</p>
                <div className="grid grid-cols-3 gap-2">
                  <Button
                    variant="outline"
                    className="border-green-500 text-green-600 hover:bg-green-50 dark:hover:bg-green-950/30"
                    onClick={() => handleConfirmSettle('won')}
                    disabled={settlePotdMutation.isPending}
                    data-testid="button-settle-won"
                  >
                    {settlePotdMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4 mr-1" />}
                    Won
                  </Button>
                  <Button
                    variant="outline"
                    className="border-red-500 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
                    onClick={() => handleConfirmSettle('lost')}
                    disabled={settlePotdMutation.isPending}
                    data-testid="button-settle-lost"
                  >
                    {settlePotdMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4 mr-1" />}
                    Lost
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => handleConfirmSettle('push')}
                    disabled={settlePotdMutation.isPending}
                    data-testid="button-settle-push"
                  >
                    Push
                  </Button>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setSettleDialogOpen(false)} data-testid="button-cancel-settle">
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// POTD Bet Card Component
function PotdBetCard({
  bet,
  category,
  currentUserId,
  onTail,
  onSettle,
  onViewDetails,
  formatOdds,
  getUserInitials,
  getUserDisplayName,
}: {
  bet: BetWithUser;
  category?: PotdCategory;
  currentUserId?: string;
  onTail: (bet: BetWithUser) => void;
  onSettle: (bet: BetWithUser) => void;
  onViewDetails?: (bet: BetWithUser) => void;
  formatOdds: (odds: string) => string;
  getUserInitials: (u: UserType) => string;
  getUserDisplayName: (u: UserType) => string;
}) {
  const isOwnBet = bet.userId === currentUserId;
  const isActive = bet.status === 'active';

  return (
    <Card 
      className={onViewDetails ? "hover-elevate cursor-pointer" : ""}
      onClick={() => onViewDetails?.(bet)}
      data-testid={`potd-bet-card-${bet.id}`}
    >
      <CardContent className="p-4 space-y-3">
        {/* Header with user and category */}
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <Avatar className="h-7 w-7">
              <AvatarImage src={bet.user.profileImageUrl || undefined} />
              <AvatarFallback className="text-xs">{getUserInitials(bet.user)}</AvatarFallback>
            </Avatar>
            <span className="font-medium text-sm">{getUserDisplayName(bet.user)}</span>
            {isOwnBet && <Badge variant="secondary" className="text-xs">You</Badge>}
          </div>
          {category && (
            <Badge variant="outline" className="text-xs flex items-center gap-1">
              <Flame className="h-3 w-3" />
              {category.displayName.replace(' Plays of the Day', '')}
            </Badge>
          )}
        </div>
        
        {/* Bet details */}
        <div className="space-y-1">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2">
              <Badge variant="outline">{bet.sport}</Badge>
              <Badge variant="secondary">{bet.betType}</Badge>
            </div>
            <span className="font-mono font-semibold text-sm">{formatOdds(bet.openingOdds)}</span>
          </div>
          
          <p className="font-medium">{bet.team}</p>
          
          {bet.game && (
            <p className="text-sm text-muted-foreground">{bet.game}</p>
          )}
          
          {bet.player && bet.market && (
            <p className="text-sm text-muted-foreground">
              {bet.player} {bet.overUnder} {bet.line} {bet.market}
            </p>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between pt-2 border-t">
          <div className="flex items-center gap-3 text-sm">
            <span className="text-muted-foreground">
              Stake: <span className="font-medium text-foreground">${bet.stake}</span>
            </span>
          </div>
          
          <div className="flex items-center gap-2">
            {isActive && (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={(e) => {
                    e.stopPropagation();
                    onSettle(bet);
                  }}
                  data-testid={`button-settle-potd-${bet.id}`}
                >
                  <CheckCircle2 className="h-3 w-3 mr-1" />
                  Settle
                </Button>
                {!isOwnBet && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={(e) => {
                      e.stopPropagation();
                      onTail(bet);
                    }}
                    data-testid={`button-tail-potd-${bet.id}`}
                  >
                    <Copy className="h-3 w-3 mr-1" />
                    Tail
                  </Button>
                )}
              </>
            )}
            
            {!isActive && (
              <Badge variant={bet.result === 'won' ? 'default' : bet.result === 'lost' ? 'destructive' : 'secondary'}>
                {bet.result === 'won' && <Check className="h-3 w-3 mr-1" />}
                {bet.result === 'lost' && <X className="h-3 w-3 mr-1" />}
                {bet.result || bet.status}
              </Badge>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function BetCard({
  bet,
  currentUserId,
  onTail,
  onUserClick,
  onViewDetails,
  formatOdds,
  getUserInitials,
  getUserDisplayName,
  showUser = true,
}: {
  bet: BetWithUser;
  currentUserId?: string;
  onTail: (bet: BetWithUser) => void;
  onUserClick?: (user: UserType) => void;
  onViewDetails?: (bet: BetWithUser) => void;
  formatOdds: (odds: string) => string;
  getUserInitials: (u: UserType) => string;
  getUserDisplayName: (u: UserType) => string;
  showUser?: boolean;
}) {
  const isOwnBet = bet.userId === currentUserId;
  const isActive = bet.status === 'active';
  const isParlay = bet.betType === 'Parlay' || bet.betType === 'Teaser';

  return (
    <Card 
      className={onViewDetails ? "hover-elevate cursor-pointer" : ""}
      onClick={() => onViewDetails?.(bet)}
      data-testid={`bet-card-${bet.id}`}
    >
      <CardContent className="p-4 space-y-3">
        {showUser && (
          <div
            className={`flex items-center gap-2 ${onUserClick ? 'cursor-pointer hover:opacity-80' : ''}`}
            onClick={(e) => {
              e.stopPropagation();
              onUserClick?.(bet.user);
            }}
          >
            <Avatar className="h-8 w-8">
              <AvatarImage src={bet.user.profileImageUrl || undefined} />
              <AvatarFallback className="text-xs">{getUserInitials(bet.user)}</AvatarFallback>
            </Avatar>
            <span className="font-medium text-sm">{getUserDisplayName(bet.user)}</span>
            {isOwnBet && <Badge variant="secondary" className="text-xs">You</Badge>}
          </div>
        )}
        
        <div className="space-y-1">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2">
              <Badge variant="outline">{bet.sport}</Badge>
              <Badge variant="secondary">{bet.betType}</Badge>
              {isParlay && (
                <Badge variant="outline" className="text-xs">
                  <Eye className="h-3 w-3 mr-1" />
                  View Legs
                </Badge>
              )}
            </div>
            <span className="font-mono font-semibold text-sm">{formatOdds(bet.openingOdds)}</span>
          </div>
          
          <p className="font-medium">{bet.team}</p>
          
          {bet.game && (
            <p className="text-sm text-muted-foreground">{bet.game}</p>
          )}
          
          {bet.player && bet.market && (
            <p className="text-sm text-muted-foreground">
              {bet.player} {bet.overUnder} {bet.line} {bet.market}
            </p>
          )}
        </div>

        <div className="flex items-center justify-between pt-2 border-t">
          <div className="flex items-center gap-3 text-sm">
            <span className="text-muted-foreground">
              Stake: <span className="font-medium text-foreground">${bet.stake}</span>
            </span>
            {bet.clv && (
              <span className="text-muted-foreground">
                CLV: <span className={`font-medium ${parseFloat(bet.clv) >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                  {parseFloat(bet.clv) >= 0 ? '+' : ''}{bet.clv}%
                </span>
              </span>
            )}
          </div>
          
          {isActive && !isOwnBet && (
            <Button
              size="sm"
              variant="outline"
              onClick={(e) => {
                e.stopPropagation();
                onTail(bet);
              }}
              data-testid={`button-tail-${bet.id}`}
            >
              <Copy className="h-3 w-3 mr-1" />
              Tail
            </Button>
          )}
          
          {!isActive && (
            <Badge variant={bet.result === 'won' ? 'default' : bet.result === 'lost' ? 'destructive' : 'secondary'}>
              {bet.result || bet.status}
            </Badge>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
