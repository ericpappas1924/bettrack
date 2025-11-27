import { AddBetDialog } from "../AddBetDialog";
import { useState } from "react";
import { Button } from "@/components/ui/button";

export default function AddBetDialogExample() {
  const [open, setOpen] = useState(false);

  return (
    <div className="p-6 bg-background min-h-screen">
      <div className="max-w-2xl mx-auto">
        <Button onClick={() => setOpen(true)}>Open Add Bet Dialog</Button>
        <AddBetDialog
          open={open}
          onOpenChange={setOpen}
          onSubmit={(data) => {
            console.log("Bet data:", data);
            setOpen(false);
          }}
        />
      </div>
    </div>
  );
}
