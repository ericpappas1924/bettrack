import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

const betFormSchema = z.object({
  sport: z.string().min(1, "Sport is required"),
  betType: z.string().min(1, "Bet type is required"),
  team: z.string().min(1, "Team/player is required"),
  openingOdds: z.string().min(1, "Opening odds are required"),
  stake: z.string().min(1, "Stake is required"),
  projectionSource: z.string().optional(),
  notes: z.string().optional(),
});

type BetFormValues = z.infer<typeof betFormSchema>;

interface AddBetDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: BetFormValues) => void;
}

export function AddBetDialog({ open, onOpenChange, onSubmit }: AddBetDialogProps) {
  const form = useForm<BetFormValues>({
    resolver: zodResolver(betFormSchema),
    defaultValues: {
      sport: "",
      betType: "",
      team: "",
      openingOdds: "",
      stake: "",
      projectionSource: "",
      notes: "",
    },
  });

  const handleSubmit = (data: BetFormValues) => {
    console.log("Bet submitted:", data);
    onSubmit(data);
    form.reset();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add New Bet</DialogTitle>
          <DialogDescription>
            Enter the details of your bet from Unabated or your bookie.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
            <div className="space-y-4">
              <FormField
                control={form.control}
                name="sport"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Sport</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-sport">
                          <SelectValue placeholder="Select sport" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="NBA">NBA</SelectItem>
                        <SelectItem value="NCAAF">NCAAF</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="betType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Bet Type</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="e.g., Moneyline, Spread -7, Over 225.5"
                        {...field}
                        data-testid="input-bet-type"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="team"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Team/Player</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="e.g., Lakers, Alabama, Celtics vs Heat"
                        {...field}
                        data-testid="input-team"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="openingOdds"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Opening Odds</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="e.g., -150, +200"
                          {...field}
                          data-testid="input-opening-odds"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="stake"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Stake ($)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.01"
                          placeholder="100.00"
                          {...field}
                          data-testid="input-stake"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="projectionSource"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Projection Source (Optional)</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="e.g., Unabated"
                        {...field}
                        data-testid="input-projection-source"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Notes (Optional)</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Add any notes about this bet..."
                        className="resize-none"
                        rows={3}
                        {...field}
                        data-testid="input-notes"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="ghost"
                onClick={() => onOpenChange(false)}
                data-testid="button-cancel"
              >
                Cancel
              </Button>
              <Button type="submit" data-testid="button-submit-bet">
                Add Bet
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
