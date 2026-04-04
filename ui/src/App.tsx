import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { HashRouter, Route, Routes } from "react-router-dom";

import { Layout } from "@/components/layout";
import { OnboardingGuard } from "@/components/onboarding-guard";
import { ADMIN_POLLING_INTERVAL_MS } from "@/lib/api";
import { ActivityRoute } from "@/routes/activity";
import { BudgetRoute } from "@/routes/budget";
import { DashboardRoute } from "@/routes/dashboard";
import { EmulationRoute } from "@/routes/emulation";
import { EntitiesRoute } from "@/routes/entities";
import { EvalRoute } from "@/routes/eval";
import { QueueRoute } from "@/routes/queue";
import { SchedulerRoute } from "@/routes/scheduler";
import { StateRoute } from "@/routes/state";
import { ThreadsRoute } from "@/routes/threads";
import { TopicsRoute } from "@/routes/topics";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchInterval: ADMIN_POLLING_INTERVAL_MS,
      refetchOnWindowFocus: false,
      staleTime: 5_000,
    },
  },
});

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <HashRouter>
        <OnboardingGuard>
          <Layout>
            <Routes>
              <Route path="/" element={<DashboardRoute />} />
              <Route path="/entities" element={<EntitiesRoute />} />
              <Route path="/threads" element={<ThreadsRoute />} />
              <Route path="/topics" element={<TopicsRoute />} />
              <Route path="/budget" element={<BudgetRoute />} />
              <Route path="/scheduler" element={<SchedulerRoute />} />
              <Route path="/queue" element={<QueueRoute />} />
              <Route path="/activity" element={<ActivityRoute />} />
              <Route path="/state" element={<StateRoute />} />
              <Route path="/eval" element={<EvalRoute />} />
              <Route path="/emulation" element={<EmulationRoute />} />
            </Routes>
          </Layout>
        </OnboardingGuard>
      </HashRouter>
    </QueryClientProvider>
  );
}
