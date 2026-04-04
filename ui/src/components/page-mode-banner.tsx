import { Badge } from "@/components/ui/badge";

export interface PageModeBannerProps {
  mode: "editable" | "read-only";
  detail: string;
}

export function PageModeBanner({ mode, detail }: PageModeBannerProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Badge variant={mode === "editable" ? "secondary" : "outline"}>
        {mode === "editable" ? "Editable" : "Read only"}
      </Badge>
      <p className="text-sm text-muted-foreground">{detail}</p>
    </div>
  );
}
