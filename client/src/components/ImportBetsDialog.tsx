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
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { parseBetPaste, convertToAppBet, type ParsedBet, type ParseResult } from "@/lib/betParser";
import { Upload, Check, AlertCircle, AlertTriangle } from "lucide-react";

interface ImportBetsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImport: (bets: ReturnType<typeof convertToAppBet>[]) => void;
}

export function ImportBetsDialog({ open, onOpenChange, onImport }: ImportBetsDialogProps) {
  const [pasteText, setPasteText] = useState("");
  const [parseResult, setParseResult] = useState<ParseResult | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [step, setStep] = useState<'paste' | 'preview'>('paste');

  const handleParse = () => {
    try {
      const result = parseBetPaste(pasteText);
      if (result.bets.length === 0 && result.errors.length === 0) {
        setParseError("No bets could be parsed from the pasted text. Make sure you copied the full bet history.");
        return;
      }
      setParseResult(result);
      setParseError(null);
      setStep('preview');
    } catch (e) {
      setParseError("Failed to parse bets. Please check the format.");
    }
  };

  const handleImport = () => {
    if (!parseResult) return;
    const appBets = parseResult.bets.map(convertToAppBet);
    onImport(appBets);
    handleClose();
  };

  const handleClose = () => {
    setPasteText("");
    setParseResult(null);
    setParseError(null);
    setStep('paste');
    onOpenChange(false);
  };

  const parsedBets = parseResult?.bets || [];
  const parseErrors = parseResult?.errors || [];
  const betsWithWarnings = parsedBets.filter(b => b.parseWarnings && b.parseWarnings.length > 0);

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
          <div className="flex-1 flex flex-col gap-4">
            {/* Show parse errors if any */}
            {parseErrors.length > 0 && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Failed to Parse {parseErrors.length} Bet{parseErrors.length > 1 ? 's' : ''}</AlertTitle>
                <AlertDescription>
                  <div className="mt-2 space-y-2">
                    {parseErrors.map((error, idx) => (
                      <div key={idx} className="text-xs">
                        <p className="font-semibold">Block {error.blockIndex + 1}: {error.error}</p>
                        <p className="text-muted-foreground font-mono mt-1 truncate">
                          {error.rawText}...
                        </p>
                      </div>
                    ))}
                  </div>
                </AlertDescription>
              </Alert>
            )}
            
            {/* Show warning summary if any */}
            {betsWithWarnings.length > 0 && (
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>
                  {betsWithWarnings.length} Bet{betsWithWarnings.length > 1 ? 's' : ''} with Parsing Issues
                </AlertTitle>
                <AlertDescription className="text-xs">
                  Some bets have incomplete data. Review them below before importing.
                </AlertDescription>
              </Alert>
            )}

            <ScrollArea className="flex-1 max-h-[400px]">
              <div className="space-y-2 pr-4">
                {parsedBets.map((bet, index) => (
                  <div 
                    key={bet.id || index} 
                    className={`p-3 rounded-md border ${bet.parseWarnings ? 'border-amber-500 bg-amber-50 dark:bg-amber-950/20' : 'bg-card'}`}
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
                          {bet.parseWarnings && (
                            <Badge variant="destructive" className="text-xs">
                              <AlertTriangle className="h-3 w-3 mr-1" />
                              Issues
                            </Badge>
                          )}
                        </div>
                        <p className="font-medium mt-1 truncate">{bet.description}</p>
                        <p className="text-sm text-muted-foreground truncate">{bet.game}</p>
                        
                        {/* Show warnings */}
                        {bet.parseWarnings && bet.parseWarnings.length > 0 && (
                          <div className="mt-2 space-y-1">
                            {bet.parseWarnings.map((warning, idx) => (
                              <p key={idx} className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1">
                                <AlertCircle className="h-3 w-3" />
                                {warning}
                              </p>
                            ))}
                          </div>
                        )}
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
          </div>
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
