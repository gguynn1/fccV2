import { useCallback } from "react";

import { EditableCell } from "@/components/editable-cell";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useBudget, useUpdateBudget, type BudgetResponse } from "@/hooks/use-budget";

export function BudgetRoute() {
  const { data, isLoading } = useBudget();
  const mutation = useUpdateBudget();

  const saveBudgetField = useCallback(
    (field: string, value: number) => {
      if (!data) return;
      const payload: BudgetResponse = {
        dispatch: {
          ...data.dispatch,
          outbound_budget: {
            ...data.dispatch.outbound_budget,
            [field]: value,
          },
        },
      };
      mutation.mutate(payload);
    },
    [data, mutation],
  );

  if (isLoading || !data) {
    return <p className="text-sm text-muted-foreground">Loading budget…</p>;
  }

  const budget = data.dispatch.outbound_budget;
  const collision = data.dispatch.collision_avoidance;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Budget</h2>
        <p className="text-sm text-muted-foreground">
          Outbound budget limits and collision precedence.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Outbound Budget</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <p className="text-xs text-muted-foreground mb-1">Max unprompted / person / day</p>
              <EditableCell
                value={String(budget.max_unprompted_per_person_per_day)}
                type="number"
                onSave={(v) => {
                  const n = Number.parseInt(v, 10);
                  if (!Number.isNaN(n) && n > 0)
                    saveBudgetField("max_unprompted_per_person_per_day", n);
                }}
              />
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Max messages / thread / hour</p>
              <EditableCell
                value={String(budget.max_messages_per_thread_per_hour)}
                type="number"
                onSave={(v) => {
                  const n = Number.parseInt(v, 10);
                  if (!Number.isNaN(n) && n > 0)
                    saveBudgetField("max_messages_per_thread_per_hour", n);
                }}
              />
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Batch window (minutes)</p>
              <EditableCell
                value={String(budget.batch_window_minutes)}
                type="number"
                onSave={(v) => {
                  const n = Number.parseInt(v, 10);
                  if (!Number.isNaN(n) && n > 0) saveBudgetField("batch_window_minutes", n);
                }}
              />
            </div>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">{budget.description}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Collision Avoidance</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">{collision.description}</p>
          <div>
            <p className="text-xs text-muted-foreground mb-2">Precedence Order</p>
            <ol className="space-y-1">
              {collision.precedence_order.map((item, idx) => (
                <li key={item} className="flex items-center gap-2">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-medium">
                    {idx + 1}
                  </span>
                  <Badge variant="outline" className="text-xs">
                    {item.replace(/_/g, " ")}
                  </Badge>
                </li>
              ))}
            </ol>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Same precedence strategy</p>
            <p className="text-sm">{collision.same_precedence_strategy}</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
