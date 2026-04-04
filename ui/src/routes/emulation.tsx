import { DeviceCard } from "@/components/device-card";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  useClearEmulationMessages,
  useEmulationSession,
  useStartEmulationSession,
  useStopEmulationSession,
} from "@/hooks/use-emulation";
import { useEntities } from "@/hooks/use-entities";

export function EmulationRoute() {
  const { data: sessionData } = useEmulationSession();
  const { data: entitiesData, isLoading: entitiesLoading } = useEntities();
  const startSession = useStartEmulationSession();
  const stopSession = useStopEmulationSession();
  const clearMessages = useClearEmulationMessages();

  const sessionActive = sessionData?.active ?? false;

  const messagingEntities = (entitiesData?.entities ?? []).filter(
    (e) => e.messaging_identity !== null,
  );
  const allThreads = entitiesData?.threads ?? [];

  if (entitiesLoading) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Emulation"
          description="Interactive messaging simulation for all participants."
        />
        <p className="text-sm text-muted-foreground">Loading…</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Emulation"
        description="Interactive messaging simulation for all participants."
      />

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-3 text-sm">
              Session
              <Badge variant={sessionActive ? "success" : "secondary"}>
                {sessionActive ? "Active" : "Inactive"}
              </Badge>
            </CardTitle>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={clearMessages.isPending}
                onClick={() => clearMessages.mutate()}
              >
                Clear Messages
              </Button>
              {sessionActive ? (
                <Button
                  variant="outline"
                  size="sm"
                  disabled={stopSession.isPending}
                  onClick={() => stopSession.mutate()}
                >
                  Stop Session
                </Button>
              ) : (
                <Button
                  size="sm"
                  disabled={startSession.isPending}
                  onClick={() => startSession.mutate()}
                >
                  Start Session
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        {sessionActive && (
          <CardContent className="pt-0">
            <p className="text-xs text-muted-foreground">
              Outbound SMS is suppressed while the session is active. All messages flow through the
              real pipeline — queue, worker, classifier, routing — but responses appear here instead
              of being sent via the messaging provider.
            </p>
          </CardContent>
        )}
      </Card>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {messagingEntities.map((entity) => {
          const entityThreads = allThreads.filter((t) => t.participants.includes(entity.id));

          return (
            <DeviceCard
              key={entity.id}
              entity={entity}
              threads={entityThreads}
              sessionActive={sessionActive}
            />
          );
        })}
      </div>
    </div>
  );
}
