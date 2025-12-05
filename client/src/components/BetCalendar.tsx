import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, CalendarDays } from "lucide-react";
import { format, isSameDay, startOfDay, isToday, addMonths, subMonths } from "date-fns";
import type { Bet } from "@shared/schema";
import { useMemo, useState } from "react";

interface BetCalendarProps {
  bets: Bet[];
  selectedDate: Date | null;
  onSelectDate: (date: Date | null) => void;
}

export function BetCalendar({ bets, selectedDate, onSelectDate }: BetCalendarProps) {
  const [currentMonth, setCurrentMonth] = useState<Date>(new Date());

  const betsByDate = useMemo(() => {
    const map = new Map<string, { count: number; hasActive: boolean; totalProfit: number }>();
    
    bets.forEach(bet => {
      const betDate = bet.gameStartTime ? new Date(bet.gameStartTime) : new Date(bet.createdAt);
      const dateKey = format(startOfDay(betDate), 'yyyy-MM-dd');
      
      const existing = map.get(dateKey) || { count: 0, hasActive: false, totalProfit: 0 };
      existing.count++;
      if (bet.status === 'active') existing.hasActive = true;
      if (bet.profit) existing.totalProfit += parseFloat(bet.profit);
      
      map.set(dateKey, existing);
    });
    
    return map;
  }, [bets]);

  const daysWithBets = useMemo(() => {
    return Array.from(betsByDate.keys()).map(dateStr => new Date(dateStr + 'T12:00:00'));
  }, [betsByDate]);

  const handleSelect = (date: Date | undefined) => {
    if (!date) {
      onSelectDate(null);
      return;
    }
    
    if (selectedDate && isSameDay(date, selectedDate)) {
      onSelectDate(null);
    } else {
      onSelectDate(date);
    }
  };

  const handleToday = () => {
    const today = new Date();
    setCurrentMonth(today);
    onSelectDate(today);
  };

  const getBetInfo = (date: Date) => {
    const dateKey = format(startOfDay(date), 'yyyy-MM-dd');
    return betsByDate.get(dateKey);
  };

  const selectedDateInfo = selectedDate ? getBetInfo(selectedDate) : null;
  const todayInfo = getBetInfo(new Date());

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <CardTitle className="text-base flex items-center gap-2">
            <CalendarDays className="h-4 w-4" />
            Bet Calendar
          </CardTitle>
          <div className="flex items-center gap-1">
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
              data-testid="button-prev-month"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleToday}
              className="text-xs"
              data-testid="button-today"
            >
              Today
            </Button>
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
              data-testid="button-next-month"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <Calendar
          mode="single"
          selected={selectedDate ?? undefined}
          onSelect={handleSelect}
          month={currentMonth}
          onMonthChange={setCurrentMonth}
          className="rounded-md"
          modifiers={{
            hasBets: daysWithBets,
          }}
          modifiersClassNames={{
            hasBets: "relative font-semibold after:absolute after:bottom-1 after:left-1/2 after:-translate-x-1/2 after:h-1 after:w-1 after:rounded-full after:bg-primary",
          }}
          data-testid="bet-calendar"
        />
        
        <div className="mt-3 pt-3 border-t space-y-2">
          {selectedDate ? (
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <span className="text-sm font-medium" data-testid="text-selected-date">
                {isToday(selectedDate) ? 'Today' : format(selectedDate, 'MMM d, yyyy')}
              </span>
              {selectedDateInfo ? (
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="text-xs" data-testid="badge-bet-count">
                    {selectedDateInfo.count} bet{selectedDateInfo.count !== 1 ? 's' : ''}
                  </Badge>
                  {selectedDateInfo.hasActive && (
                    <Badge variant="default" className="text-xs bg-blue-500">Active</Badge>
                  )}
                </div>
              ) : (
                <span className="text-xs text-muted-foreground">No bets</span>
              )}
            </div>
          ) : (
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <span className="text-sm text-muted-foreground">
                Select a day to view bets
              </span>
              {todayInfo && (
                <Badge variant="outline" className="text-xs">
                  {todayInfo.count} today
                </Badge>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
