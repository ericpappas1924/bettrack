import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { TrendingUp, Target, BarChart3, Zap } from "lucide-react";

export default function Landing() {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b">
        <div className="flex items-center justify-between px-4 py-4 max-w-7xl mx-auto">
          <div>
            <h1 className="text-xl font-bold">BetTrack</h1>
          </div>
          <Button asChild data-testid="button-login">
            <a href="/api/login">Sign In</a>
          </Button>
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center px-4 py-12">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <h2 className="text-4xl md:text-5xl font-bold mb-4">
            Track Your Bets
          </h2>
          <p className="text-xl text-muted-foreground mb-8">
            Import bets, monitor live performance, and analyze your edge with real-time win probability tracking.
          </p>
          <Button size="lg" asChild data-testid="button-get-started">
            <a href="/api/login">Get Started</a>
          </Button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-4xl w-full">
          <Card className="hover-elevate">
            <CardContent className="p-4 text-center">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3">
                <TrendingUp className="h-5 w-5 text-primary" />
              </div>
              <h3 className="font-semibold mb-1">P/L Tracking</h3>
              <p className="text-sm text-muted-foreground">Monitor your profit and ROI</p>
            </CardContent>
          </Card>

          <Card className="hover-elevate">
            <CardContent className="p-4 text-center">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3">
                <Target className="h-5 w-5 text-primary" />
              </div>
              <h3 className="font-semibold mb-1">Win Rate</h3>
              <p className="text-sm text-muted-foreground">Track your betting accuracy</p>
            </CardContent>
          </Card>

          <Card className="hover-elevate">
            <CardContent className="p-4 text-center">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3">
                <Zap className="h-5 w-5 text-primary" />
              </div>
              <h3 className="font-semibold mb-1">Live Odds</h3>
              <p className="text-sm text-muted-foreground">Real-time probability changes</p>
            </CardContent>
          </Card>

          <Card className="hover-elevate">
            <CardContent className="p-4 text-center">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3">
                <BarChart3 className="h-5 w-5 text-primary" />
              </div>
              <h3 className="font-semibold mb-1">Analytics</h3>
              <p className="text-sm text-muted-foreground">CLV and EV analysis</p>
            </CardContent>
          </Card>
        </div>
      </main>

      <footer className="border-t py-4">
        <div className="text-center text-sm text-muted-foreground">
          NFL, NBA, NCAAF betting tracker
        </div>
      </footer>
    </div>
  );
}
