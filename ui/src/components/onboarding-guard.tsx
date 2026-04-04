import type { ReactNode } from "react";

import { useConfig } from "@/hooks/use-config";

export interface OnboardingGuardProps {
  children: ReactNode;
}

export function OnboardingGuard({ children }: OnboardingGuardProps) {
  const { data, isLoading, isError } = useConfig();

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-foreground">
        <p className="text-sm text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-foreground">
        <p className="text-sm text-destructive">Failed to load system configuration.</p>
      </div>
    );
  }

  if (data && !data.system.is_onboarded) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-foreground">
        <div className="max-w-md space-y-4 text-center">
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Setup</p>
          <h1 className="text-2xl font-semibold">Family Command Center</h1>
          <p className="text-sm text-muted-foreground">
            This system has not been configured yet. Onboarding will appear here.
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
