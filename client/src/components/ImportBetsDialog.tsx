import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { parseBetPaste, convertToAppBet, type ParsedBet } from "@/lib/betParser";
import { Upload, Check, AlertCircle } from "lucide-react";

interface ImportBetsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImport: (bets: ReturnType<typeof convertToAppBet>[]) => void;
}

export function ImportBetsDialog({ open, onOpenChange, onImport }: ImportBetsDialogProps) {
  const [pasteText, setPasteText] = useState("");
  const [parsedBets, setParsedBets] = useState<ParsedBet[]>([]);
  const [parseError, setParseError] = useState<string | null>(null);
  const [step, setStep] = useState<'paste' | 'preview'>('paste');

  const handleParse = () => {
    try {
      const bets = parseBetPaste(pasteText);
      if (bets.length === 0) {
        setParseError("No bets could be parsed from the pasted text. Make sure you copied the full bet history.");
        return;
      }
      setParsedBets(bets);
      setParseError(null);
      setStep('preview');
    } catch (e) {
      setParseError("Failed to parse bets. Please check the format.");
    }
  };

  const handleImport = () => {
    const appBets = parsedBets.map(convertToAppBet);
    onImport(appBets);
    handleClose();
  };

  const handleClose = () => {
    setPasteText("");
    setParsedBets([]);
    setParseError(null);
    setStep('paste');
    onOpenChange(false);
  };

  const formatCurrency = (value: number) => {
    return value >= 0 ? `$${value.toFixed(2)}` : `-$${Math.abs(value).toFixed(2)}`;
  };

  const formatOdds = (odds: number) => {
    return odds > 0 ? `+${odds}` : odds.toString();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>
            {step === 'paste' ? 'Import Bets' : `Preview Import (${parsedBets.length} bets)`}
          </DialogTitle>
          <DialogDescription>
            {step === 'paste' 
              ? 'Paste your bet history from your bookie site below.' 
              : 'Review the parsed bets before importing.'}
          </DialogDescription>
        </DialogHeader>

        {step === 'paste' ? (
          <div className="space-y-4 flex-1">
            <Textarea
              placeholder="Paste your bet history here..."
              value={pasteText}
              onChange={(e) => setPasteText(e.target.value)}
              className="min-h-[300px] font-mono text-sm"
              data-testid="textarea-paste-bets"
            />
            {parseError && (
              <div className="flex items-center gap-2 text-destructive text-sm">
                <AlertCircle className="h-4 w-4" />
                {parseError}
              </div>
            )}
          </div>
        ) : (
          <ScrollArea className="flex-1 max-h-[400px]">
            <div className="space-y-2 pr-4">
              {parsedBets.map((bet, index) => (
                <div 
                  key={bet.id || index} 
                  className="p-3 rounded-md border bg-card"
                  data-testid={`preview-bet-${index}`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="secondary" className="text-xs">
                          {bet.sport}
                        </Badge>
                        <Badge variant="outline" className="text-xs">
                          {bet.betType.replace('_', ' ')}
                        </Badge>
                        {bet.isFreePlay && (
                          <Badge className="text-xs bg-green-600">FREE PLAY</Badge>
                        )}
                      </div>
                      <p className="font-medium mt-1 truncate">{bet.description}</p>
                      <p className="text-sm text-muted-foreground truncate">{bet.game}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-semibold tabular-nums">{formatCurrency(bet.stake)}</p>
                      <p className="text-sm text-muted-foreground tabular-nums">
                        To win: {formatCurrency(bet.potentialWin)}
                      </p>
                      <p className="text-xs text-muted-foreground tabular-nums">
                        {formatOdds(bet.odds)}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}

        <DialogFooter className="gap-2">
          {step === 'preview' && (
            <Button variant="ghost" onClick={() => setStep('paste')}>
              Back
            </Button>
          )}
          <Button variant="ghost" onClick={handleClose}>
            Cancel
          </Button>
          {step === 'paste' ? (
            <Button 
              onClick={handleParse} 
              disabled={!pasteText.trim()}
              data-testid="button-parse-bets"
            >
              <Upload className="h-4 w-4 mr-2" />
              Parse Bets
            </Button>
          ) : (
            <Button onClick={handleImport} data-testid="button-import-bets">
              <Check className="h-4 w-4 mr-2" />
              Import {parsedBets.length} Bets
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
