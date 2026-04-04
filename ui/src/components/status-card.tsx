import { Link } from "react-router-dom";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export interface StatusCardProps {
  title: string;
  value: string | number;
  to?: string;
  variant?: "default" | "success" | "warning" | "destructive";
  badge?: string;
}

export function StatusCard({ title, value, to, variant = "default", badge }: StatusCardProps) {
  const colorMap = {
    default: "border-border",
    success: "border-emerald-600/40",
    warning: "border-amber-600/40",
    destructive: "border-red-600/40",
  };

  const card = (
    <Card className={`transition-colors ${to ? "hover:bg-muted/30" : ""} ${colorMap[variant]}`}>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center justify-between text-sm font-medium text-muted-foreground">
          {title}
          {badge && (
            <Badge
              variant={
                variant === "destructive"
                  ? "destructive"
                  : variant === "warning"
                    ? "warning"
                    : "secondary"
              }
              className="text-xs"
            >
              {badge}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-bold">{value}</p>
      </CardContent>
    </Card>
  );

  if (to) {
    return <Link to={to}>{card}</Link>;
  }

  return card;
}
