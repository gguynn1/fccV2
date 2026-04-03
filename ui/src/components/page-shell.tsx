import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export interface PageShellProps {
  title: string;
  description: string;
}

export function PageShell({ title, description }: PageShellProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">
          This page is scaffolded and ready for step 43-part-2 or 43-part-3.
        </p>
      </CardContent>
    </Card>
  );
}
