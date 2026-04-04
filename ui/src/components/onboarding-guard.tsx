import { useState, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { useConfig, useUpdateConfig, type ConfigPayload } from "@/hooks/use-config";

export interface OnboardingGuardProps {
  children: ReactNode;
}

const TIMEZONES = Intl.supportedValuesOf("timeZone");

function detectTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return "America/Chicago";
  }
}

function detectLocale(): string {
  try {
    return navigator.language;
  } catch {
    return "en-US";
  }
}

interface LocaleStepProps {
  config: ConfigPayload;
  onComplete: () => void;
}

function LocaleStep({ config, onComplete }: LocaleStepProps) {
  const [timezone, setTimezone] = useState(detectTimezone);
  const [locale, setLocale] = useState(detectLocale);
  const updateConfig = useUpdateConfig();

  function handleContinue() {
    updateConfig.mutate(
      {
        ...config,
        system: { ...config.system, timezone, locale },
      },
      { onSuccess: onComplete },
    );
  }

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle>System Locale</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1">
          <label htmlFor="onboard-tz" className="text-xs text-muted-foreground">
            Timezone
          </label>
          <Select id="onboard-tz" value={timezone} onChange={(e) => setTimezone(e.target.value)}>
            {TIMEZONES.map((tz) => (
              <option key={tz} value={tz}>
                {tz.replaceAll("_", " ")}
              </option>
            ))}
          </Select>
        </div>
        <div className="space-y-1">
          <label htmlFor="onboard-locale" className="text-xs text-muted-foreground">
            Locale
          </label>
          <Input
            id="onboard-locale"
            value={locale}
            onChange={(e) => setLocale(e.target.value)}
            placeholder="en-US"
          />
        </div>
        <div className="flex justify-end pt-2">
          <Button
            onClick={handleContinue}
            disabled={updateConfig.isPending || timezone.length === 0 || locale.length === 0}
          >
            {updateConfig.isPending ? "Saving..." : "Continue"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export function OnboardingGuard({ children }: OnboardingGuardProps) {
  const { data, isLoading, isError } = useConfig();
  const [step, setStep] = useState(0);

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
        <div className="flex flex-col items-center gap-6">
          <div className="text-center">
            <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Setup</p>
            <h1 className="mt-1 text-2xl font-semibold">Family Command Center</h1>
          </div>

          {step === 0 && <LocaleStep config={data} onComplete={() => setStep(1)} />}

          {step >= 1 && (
            <Card className="w-full max-w-sm">
              <CardContent className="p-6 text-center">
                <p className="text-sm text-muted-foreground">
                  Locale saved. Next step coming soon.
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
