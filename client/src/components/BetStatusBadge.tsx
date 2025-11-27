import { Badge } from "@/components/ui/badge";
import { CheckCircle2, XCircle, Clock, AlertCircle } from "lucide-react";

interface BetStatusBadgeProps {
  status: string;
  result?: string | null;
}

export function BetStatusBadge({ status, result }: BetStatusBadgeProps) {
  const getStatusConfig = () => {
    if (status === "settled" && result === "won") {
      return {
        variant: "default" as const,
        icon: <CheckCircle2 className="h-3 w-3" />,
        label: "Won",
        className: "bg-green-600 hover:bg-green-700 dark:bg-green-700 dark:hover:bg-green-800"
      };
    }
    if (status === "settled" && result === "lost") {
      return {
        variant: "destructive" as const,
        icon: <XCircle className="h-3 w-3" />,
        label: "Lost",
        className: ""
      };
    }
    if (status === "active") {
      return {
        variant: "default" as const,
        icon: <Clock className="h-3 w-3" />,
        label: "Active",
        className: ""
      };
    }
    return {
      variant: "secondary" as const,
      icon: <AlertCircle className="h-3 w-3" />,
      label: "Pending",
      className: ""
    };
  };

  const config = getStatusConfig();

  return (
    <Badge 
      variant={config.variant} 
      className={`gap-1 ${config.className}`}
      data-testid={`badge-status-${config.label.toLowerCase()}`}
    >
      {config.icon}
      <span>{config.label}</span>
    </Badge>
  );
}
