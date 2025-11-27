import { ImportBetsDialog } from "../ImportBetsDialog";
import { useState } from "react";
import { Button } from "@/components/ui/button";

export default function ImportBetsDialogExample() {
  const [open, setOpen] = useState(false);

  return (
    <div className="p-6 bg-background min-h-screen">
      <div className="max-w-2xl mx-auto">
        <Button onClick={() => setOpen(true)}>Open Import Dialog</Button>
        <ImportBetsDialog
          open={open}
          onOpenChange={setOpen}
          onImport={(bets) => {
            console.log("Imported bets:", bets);
            setOpen(false);
          }}
        />
      </div>
    </div>
  );
}
