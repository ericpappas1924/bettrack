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
import { Trophy, TrendingUp, Users, Copy, ArrowLeft, Loader2, LogOut, User, ChevronRight } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import { Link } from "wouter";
import type { Bet, User as UserType } from "@shared/schema";

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

export default function SocialDashboard() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [selectedUser, setSelectedUser] = useState<UserType | null>(null);
  const [tailDialogOpen, setTailDialogOpen] = useState(false);
  const [betToTail, setBetToTail] = useState<BetWithUser | null>(null);
  const [tailStake, setTailStake] = useState("");

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

  const activeFeedBets = feed.filter(bet => bet.status === 'active');

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
            <TabsList className="grid w-full grid-cols-2 max-w-xs">
              <TabsTrigger value="feed" data-testid="tab-feed">
                <Users className="h-4 w-4 mr-2" />
                Feed
              </TabsTrigger>
              <TabsTrigger value="leaderboard" data-testid="tab-leaderboard">
                <Trophy className="h-4 w-4 mr-2" />
                Rankings
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
    </div>
  );
}

function BetCard({
  bet,
  currentUserId,
  onTail,
  onUserClick,
  formatOdds,
  getUserInitials,
  getUserDisplayName,
  showUser = true,
}: {
  bet: BetWithUser;
  currentUserId?: string;
  onTail: (bet: BetWithUser) => void;
  onUserClick?: (user: UserType) => void;
  formatOdds: (odds: string) => string;
  getUserInitials: (u: UserType) => string;
  getUserDisplayName: (u: UserType) => string;
  showUser?: boolean;
}) {
  const isOwnBet = bet.userId === currentUserId;
  const isActive = bet.status === 'active';

  return (
    <Card data-testid={`bet-card-${bet.id}`}>
      <CardContent className="p-4 space-y-3">
        {showUser && (
          <div
            className={`flex items-center gap-2 ${onUserClick ? 'cursor-pointer hover:opacity-80' : ''}`}
            onClick={() => onUserClick?.(bet.user)}
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
              onClick={() => onTail(bet)}
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
