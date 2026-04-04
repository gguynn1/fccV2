import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useDomainState, useMutateDomainState } from "@/hooks/use-domain-state";
import { cn } from "@/lib/utils";

function formatDate(d: string | Date | undefined | null): string {
  if (!d) return "—";
  const date = new Date(d as string);
  return isNaN(date.getTime()) ? String(d) : date.toLocaleString();
}

function formatValue(v: unknown): string {
  if (v === null || v === undefined) return "—";
  if (typeof v === "boolean") return v ? "yes" : "no";
  if (typeof v === "number") return v.toLocaleString();
  if (typeof v === "string") {
    const asDate = new Date(v);
    if (v.length > 10 && !isNaN(asDate.getTime()) && v.includes("T")) {
      return asDate.toLocaleString();
    }
    return v;
  }
  if (Array.isArray(v)) return `[${v.length} items]`;
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

function itemCount(arr: unknown[] | undefined): number {
  return arr?.length ?? 0;
}

interface CollapsibleSectionProps {
  title: string;
  count?: number;
  badge?: string;
  defaultOpen?: boolean;
  headerActions?: React.ReactNode;
  children: React.ReactNode;
}

function CollapsibleSection({
  title,
  count,
  badge,
  defaultOpen = false,
  headerActions,
  children,
}: CollapsibleSectionProps) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <Card>
      <CardHeader
        className="cursor-pointer select-none"
        onClick={() => setOpen((prev) => !prev)}
      >
        <CardTitle className="flex items-center gap-2 text-base">
          <span className={cn("text-xs transition-transform", open && "rotate-90")}>▶</span>
          {title}
          {count !== undefined && (
            <Badge variant="secondary" className="ml-1 text-xs">
              {count}
            </Badge>
          )}
          {badge && (
            <Badge variant="outline" className="ml-1 text-xs">
              {badge}
            </Badge>
          )}
          {headerActions && (
            <span
              className="ml-auto"
              onClick={(event) => {
                event.stopPropagation();
              }}
            >
              {headerActions}
            </span>
          )}
        </CardTitle>
      </CardHeader>
      {open && <CardContent className="overflow-x-auto pt-0">{children}</CardContent>}
    </Card>
  );
}

interface GenericTableProps {
  rows: Array<Record<string, unknown>>;
  columns?: string[];
  emptyMessage?: string;
  onClearRow?: (row: Record<string, unknown>) => void;
  rowKeyField?: string;
  isBusy?: boolean;
}

function GenericTable({
  rows,
  columns,
  emptyMessage = "No data.",
  onClearRow,
  rowKeyField = "id",
  isBusy = false,
}: GenericTableProps) {
  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground">{emptyMessage}</p>;
  }

  const cols =
    columns ??
    Array.from(
      rows.reduce<Set<string>>((acc, row) => {
        for (const key of Object.keys(row)) acc.add(key);
        return acc;
      }, new Set()),
    );

  return (
    <Table>
      <TableHeader>
        <TableRow>
          {cols.map((col) => (
            <TableHead key={col} className="whitespace-nowrap text-xs">
              {col.replace(/_/g, " ")}
            </TableHead>
          ))}
          {onClearRow && <TableHead className="w-24 text-xs">actions</TableHead>}
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row, idx) => (
          <TableRow key={(row[rowKeyField] as string) ?? (row.id as string) ?? idx}>
            {cols.map((col) => (
              <TableCell key={col} className="max-w-64 truncate text-xs">
                {formatValue(row[col])}
              </TableCell>
            ))}
            {onClearRow && (
              <TableCell className="text-right">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={isBusy}
                  onClick={() => onClearRow(row)}
                >
                  Clear
                </Button>
              </TableCell>
            )}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

export function StateRoute() {
  const { data, isLoading } = useDomainState();
  const mutateDomainState = useMutateDomainState();
  const [filter, setFilter] = useState<"all" | "populated">("populated");

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Loading state…</p>;
  }

  if (!data) {
    return <p className="text-sm text-muted-foreground">No state data available.</p>;
  }

  const isEmpty = (arr: unknown[] | undefined) => !arr || arr.length === 0;

  const sections = [
    { key: "calendar", label: "Calendar", populated: !isEmpty(data.calendar.events) },
    { key: "chores", label: "Chores", populated: !isEmpty(data.chores.active) || !isEmpty(data.chores.completed_recent) },
    { key: "finances", label: "Finances", populated: !isEmpty(data.finances.bills) || !isEmpty(data.finances.expenses_recent) || !isEmpty(data.finances.savings_goals) },
    { key: "grocery", label: "Grocery", populated: !isEmpty(data.grocery.list) || !isEmpty(data.grocery.recently_purchased) },
    { key: "health", label: "Health", populated: !isEmpty(data.health.profiles) },
    { key: "pets", label: "Pets", populated: !isEmpty(data.pets.profiles) },
    { key: "school", label: "School", populated: !isEmpty(data.school.students) || !isEmpty(data.school.communications) },
    { key: "travel", label: "Travel", populated: !isEmpty(data.travel.trips) },
    { key: "vendors", label: "Vendors", populated: !isEmpty(data.vendors.records) },
    { key: "business", label: "Business", populated: !isEmpty(data.business.profiles) || !isEmpty(data.business.leads) },
    { key: "relationship", label: "Relationship", populated: data.relationship.nudge_history.length > 0 || !!data.relationship.last_nudge.content },
    { key: "family_status", label: "Family Status", populated: !isEmpty(data.family_status.current) },
    { key: "meals", label: "Meals", populated: !isEmpty(data.meals.planned) || !isEmpty(data.meals.dietary_notes) },
    { key: "maintenance", label: "Maintenance", populated: !isEmpty(data.maintenance.assets) || !isEmpty(data.maintenance.items) },
    { key: "budget_tracker", label: "Budget Tracker", populated: Object.keys(data.outbound_budget_tracker.by_person).length > 0 || Object.keys(data.outbound_budget_tracker.by_thread).length > 0 },
    { key: "data_ingest", label: "Data Ingest", populated: data.data_ingest_state.email_monitor.total_processed > 0 || data.data_ingest_state.calendar_sync.total_processed > 0 || data.data_ingest_state.forwarded_messages.total_processed > 0 },
    { key: "digests", label: "Digests", populated: !isEmpty(data.digests.history) },
    { key: "threads", label: "Thread History", populated: Object.keys(data.threads).length > 0 },
  ] as const;

  const visibleSections =
    filter === "all" ? sections : sections.filter((s) => s.populated);

  const populatedCount = sections.filter((s) => s.populated).length;
  const isMutating = mutateDomainState.isPending;

  const clearCategory = (category: string) => {
    mutateDomainState.mutate({ category });
  };

  const clearCollection = (category: string, collection: string) => {
    mutateDomainState.mutate({ category, collection });
  };

  const clearRow = (category: string, collection: string, rowId: string, rowKey = "id") => {
    if (!rowId) {
      return;
    }
    mutateDomainState.mutate({
      category,
      collection,
      row_id: rowId,
      row_key: rowKey,
    });
  };

  const categoryAction = (category: string) => (
    <Button
      variant="outline"
      size="sm"
      disabled={isMutating}
      onClick={() => clearCategory(category)}
    >
      Clear Category
    </Button>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <h2 className="text-lg font-semibold">Domain State</h2>
          <p className="text-sm text-muted-foreground">
            Persisted topic and operational state.
          </p>
        </div>
        <div className="flex gap-1">
          <Button
            variant={filter === "populated" ? "default" : "outline"}
            size="sm"
            onClick={() => setFilter("populated")}
          >
            Populated ({populatedCount})
          </Button>
          <Button
            variant={filter === "all" ? "default" : "outline"}
            size="sm"
            onClick={() => setFilter("all")}
          >
            All ({sections.length})
          </Button>
        </div>
      </div>

      {visibleSections.length === 0 && (
        <p className="text-sm text-muted-foreground">
          No populated state sections. Switch to "All" to see empty sections.
        </p>
      )}

      {visibleSections.map((section) => {
        switch (section.key) {
          case "calendar":
            return (
              <CollapsibleSection
                key={section.key}
                title="Calendar"
                count={itemCount(data.calendar.events)}
                defaultOpen={section.populated}
                headerActions={categoryAction("calendar")}
              >
                <GenericTable
                  rows={data.calendar.events}
                  columns={["id", "title", "date_start", "date_end", "location", "status", "topic", "concerning", "responsible", "created_by"]}
                  emptyMessage="No calendar events."
                  onClearRow={(row) => clearRow("calendar", "events", String(row.id ?? ""))}
                  isBusy={isMutating}
                />
              </CollapsibleSection>
            );

          case "chores":
            return (
              <CollapsibleSection
                key={section.key}
                title="Chores"
                count={itemCount(data.chores.active)}
                badge={
                  data.chores.completed_recent.length > 0
                    ? `${data.chores.completed_recent.length} completed`
                    : undefined
                }
                defaultOpen={section.populated}
                headerActions={categoryAction("chores")}
              >
                {data.chores.active.length > 0 && (
                  <div className="mb-4">
                    <div className="mb-2 flex items-center justify-between">
                      <p className="text-xs font-medium text-muted-foreground">Active</p>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={isMutating}
                        onClick={() => clearCollection("chores", "active")}
                      >
                        Clear All
                      </Button>
                    </div>
                    <GenericTable
                      rows={data.chores.active}
                      columns={["id", "task", "assigned_to", "assigned_by", "due", "status", "escalation_step"]}
                      onClearRow={(row) => clearRow("chores", "active", String(row.id ?? ""))}
                      isBusy={isMutating}
                    />
                  </div>
                )}
                {data.chores.completed_recent.length > 0 && (
                  <div>
                    <div className="mb-2 flex items-center justify-between">
                      <p className="text-xs font-medium text-muted-foreground">Recently Completed</p>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={isMutating}
                        onClick={() => clearCollection("chores", "completed_recent")}
                      >
                        Clear All
                      </Button>
                    </div>
                    <GenericTable
                      rows={data.chores.completed_recent}
                      columns={["id", "task", "assigned_to", "completed_at", "completed_via"]}
                      onClearRow={(row) =>
                        clearRow("chores", "completed_recent", String(row.id ?? ""))
                      }
                      isBusy={isMutating}
                    />
                  </div>
                )}
                {data.chores.active.length === 0 && data.chores.completed_recent.length === 0 && (
                  <p className="text-sm text-muted-foreground">No chores.</p>
                )}
              </CollapsibleSection>
            );

          case "finances":
            return (
              <CollapsibleSection
                key={section.key}
                title="Finances"
                count={
                  itemCount(data.finances.bills) +
                  itemCount(data.finances.expenses_recent) +
                  itemCount(data.finances.savings_goals)
                }
                defaultOpen={section.populated}
                headerActions={categoryAction("finances")}
              >
                {data.finances.bills.length > 0 && (
                  <div className="mb-4">
                    <p className="mb-2 text-xs font-medium text-muted-foreground">Bills</p>
                    <GenericTable
                      rows={data.finances.bills}
                      columns={["id", "name", "amount", "due_date", "status", "recurring", "reminder_sent"]}
                    />
                  </div>
                )}
                {data.finances.expenses_recent.length > 0 && (
                  <div className="mb-4">
                    <p className="mb-2 text-xs font-medium text-muted-foreground">Recent Expenses</p>
                    <GenericTable
                      rows={data.finances.expenses_recent}
                      columns={["id", "description", "amount", "date", "logged_by", "confirmed"]}
                    />
                  </div>
                )}
                {data.finances.savings_goals.length > 0 && (
                  <div>
                    <p className="mb-2 text-xs font-medium text-muted-foreground">Savings Goals</p>
                    <GenericTable
                      rows={data.finances.savings_goals}
                      columns={["id", "name", "target", "current", "percent", "deadline", "pace_status"]}
                    />
                  </div>
                )}
                {data.finances.bills.length === 0 &&
                  data.finances.expenses_recent.length === 0 &&
                  data.finances.savings_goals.length === 0 && (
                    <p className="text-sm text-muted-foreground">No financial data.</p>
                  )}
              </CollapsibleSection>
            );

          case "grocery":
            return (
              <CollapsibleSection
                key={section.key}
                title="Grocery"
                count={itemCount(data.grocery.list)}
                badge={
                  data.grocery.recently_purchased.length > 0
                    ? `${data.grocery.recently_purchased.length} purchased`
                    : undefined
                }
                defaultOpen={section.populated}
                headerActions={categoryAction("grocery")}
              >
                {data.grocery.list.length > 0 && (
                  <div className="mb-4">
                    <div className="mb-2 flex items-center justify-between">
                      <p className="text-xs font-medium text-muted-foreground">Current List</p>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={isMutating}
                        onClick={() => clearCollection("grocery", "list")}
                      >
                        Clear All
                      </Button>
                    </div>
                    <GenericTable
                      rows={data.grocery.list}
                      columns={["id", "item", "section", "added_by", "added_at", "purchased", "source_topic"]}
                      onClearRow={(row) => clearRow("grocery", "list", String(row.id ?? ""))}
                      isBusy={isMutating}
                    />
                  </div>
                )}
                {data.grocery.recently_purchased.length > 0 && (
                  <div>
                    <div className="mb-2 flex items-center justify-between">
                      <p className="text-xs font-medium text-muted-foreground">Recently Purchased</p>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={isMutating}
                        onClick={() => clearCollection("grocery", "recently_purchased")}
                      >
                        Clear All
                      </Button>
                    </div>
                    <GenericTable
                      rows={data.grocery.recently_purchased}
                      columns={["item", "purchased_by", "purchased_at"]}
                      onClearRow={(row) => clearRow("grocery", "recently_purchased", String(row.item ?? ""), "item")}
                      rowKeyField="item"
                      isBusy={isMutating}
                    />
                  </div>
                )}
                {data.grocery.list.length === 0 && data.grocery.recently_purchased.length === 0 && (
                  <p className="text-sm text-muted-foreground">No grocery data.</p>
                )}
              </CollapsibleSection>
            );

          case "health":
            return (
              <CollapsibleSection
                key={section.key}
                title="Health"
                count={itemCount(data.health.profiles)}
                defaultOpen={section.populated}
                headerActions={categoryAction("health")}
              >
                <GenericTable
                  rows={data.health.profiles}
                  columns={["entity", "medications", "allergies", "providers", "upcoming_appointments", "notes"]}
                  emptyMessage="No health profiles."
                />
              </CollapsibleSection>
            );

          case "pets":
            return (
              <CollapsibleSection
                key={section.key}
                title="Pets"
                count={itemCount(data.pets.profiles)}
                defaultOpen={section.populated}
                headerActions={categoryAction("pets")}
              >
                <GenericTable
                  rows={data.pets.profiles}
                  columns={["entity", "species", "responsible_adult", "vet", "last_vet_visit", "medications", "upcoming", "notes"]}
                  emptyMessage="No pet profiles."
                  onClearRow={(row) => clearRow("pets", "profiles", String(row.entity ?? ""), "entity")}
                  rowKeyField="entity"
                  isBusy={isMutating}
                />
              </CollapsibleSection>
            );

          case "school":
            return (
              <CollapsibleSection
                key={section.key}
                title="School"
                count={
                  itemCount(data.school.students) + itemCount(data.school.communications)
                }
                defaultOpen={section.populated}
                headerActions={categoryAction("school")}
              >
                {data.school.students.length > 0 && (
                  <div className="mb-4">
                    <p className="mb-2 text-xs font-medium text-muted-foreground">Students</p>
                    <GenericTable
                      rows={data.school.students}
                      columns={["entity", "parent_entity", "assignments", "completed_recent"]}
                    />
                  </div>
                )}
                {data.school.communications.length > 0 && (
                  <div>
                    <p className="mb-2 text-xs font-medium text-muted-foreground">Communications</p>
                    <GenericTable
                      rows={data.school.communications}
                      columns={["id", "student_entity", "from", "received_at", "summary", "action_needed", "source"]}
                    />
                  </div>
                )}
                {data.school.students.length === 0 && data.school.communications.length === 0 && (
                  <p className="text-sm text-muted-foreground">No school data.</p>
                )}
              </CollapsibleSection>
            );

          case "travel":
            return (
              <CollapsibleSection
                key={section.key}
                title="Travel"
                count={itemCount(data.travel.trips)}
                defaultOpen={section.populated}
                headerActions={categoryAction("travel")}
              >
                <GenericTable
                  rows={data.travel.trips}
                  columns={["id", "name", "dates", "travelers", "status", "checklist", "notes"]}
                  emptyMessage="No trips."
                />
              </CollapsibleSection>
            );

          case "vendors":
            return (
              <CollapsibleSection
                key={section.key}
                title="Vendors"
                count={itemCount(data.vendors.records)}
                defaultOpen={section.populated}
                headerActions={categoryAction("vendors")}
              >
                <GenericTable
                  rows={data.vendors.records}
                  columns={["id", "name", "type", "contact", "managed_by", "jobs", "follow_up_pending", "follow_up_stage"]}
                  emptyMessage="No vendors."
                />
              </CollapsibleSection>
            );

          case "business":
            return (
              <CollapsibleSection
                key={section.key}
                title="Business"
                count={
                  itemCount(data.business.profiles) + itemCount(data.business.leads)
                }
                defaultOpen={section.populated}
                headerActions={categoryAction("business")}
              >
                {data.business.profiles.length > 0 && (
                  <div className="mb-4">
                    <p className="mb-2 text-xs font-medium text-muted-foreground">Profiles</p>
                    <GenericTable
                      rows={data.business.profiles}
                      columns={["entity", "business_type", "business_name", "follow_up_quiet_period_days"]}
                    />
                  </div>
                )}
                {data.business.leads.length > 0 && (
                  <div>
                    <p className="mb-2 text-xs font-medium text-muted-foreground">Leads</p>
                    <GenericTable
                      rows={data.business.leads}
                      columns={["id", "owner", "client_name", "inquiry_date", "event_type", "event_date", "status", "pipeline_stage", "booking_status", "last_contact"]}
                    />
                  </div>
                )}
                {data.business.profiles.length === 0 && data.business.leads.length === 0 && (
                  <p className="text-sm text-muted-foreground">No business data.</p>
                )}
              </CollapsibleSection>
            );

          case "relationship":
            return (
              <CollapsibleSection
                key={section.key}
                title="Relationship"
                count={data.relationship.nudge_history.length}
                defaultOpen={section.populated}
                headerActions={categoryAction("relationship")}
              >
                <div className="mb-4 space-y-1">
                  <p className="text-xs font-medium text-muted-foreground">Last Nudge</p>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs sm:grid-cols-4">
                    <div>
                      <span className="text-muted-foreground">Date: </span>
                      {formatDate(data.relationship.last_nudge.date)}
                    </div>
                    <div>
                      <span className="text-muted-foreground">Thread: </span>
                      <span className="font-mono">{data.relationship.last_nudge.thread || "—"}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Response: </span>
                      {data.relationship.last_nudge.response_received ? "yes" : "no"}
                    </div>
                    <div>
                      <span className="text-muted-foreground">Next eligible: </span>
                      {formatDate(data.relationship.next_nudge_eligible)}
                    </div>
                  </div>
                  {data.relationship.last_nudge.content && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      {data.relationship.last_nudge.content}
                    </p>
                  )}
                </div>
                {data.relationship.nudge_history.length > 0 && (
                  <div>
                    <p className="mb-2 text-xs font-medium text-muted-foreground">Nudge History</p>
                    <GenericTable
                      rows={data.relationship.nudge_history}
                      columns={["date", "type", "responded", "ignored", "content"]}
                    />
                  </div>
                )}
              </CollapsibleSection>
            );

          case "family_status":
            return (
              <CollapsibleSection
                key={section.key}
                title="Family Status"
                count={itemCount(data.family_status.current)}
                defaultOpen={section.populated}
                headerActions={categoryAction("family_status")}
              >
                <GenericTable
                  rows={data.family_status.current}
                  columns={["entity", "status", "eta", "location_snapshot", "updated_at", "expires_at"]}
                  emptyMessage="No status entries."
                />
              </CollapsibleSection>
            );

          case "meals":
            return (
              <CollapsibleSection
                key={section.key}
                title="Meals"
                count={itemCount(data.meals.planned)}
                badge={
                  data.meals.dietary_notes.length > 0
                    ? `${data.meals.dietary_notes.length} dietary notes`
                    : undefined
                }
                defaultOpen={section.populated}
                headerActions={categoryAction("meals")}
              >
                {data.meals.planned.length > 0 && (
                  <div className="mb-4">
                    <div className="mb-2 flex items-center justify-between">
                      <p className="text-xs font-medium text-muted-foreground">Planned Meals</p>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={isMutating}
                        onClick={() => clearCollection("meals", "planned")}
                      >
                        Clear All
                      </Button>
                    </div>
                    <GenericTable
                      rows={data.meals.planned}
                      columns={["id", "date", "meal_type", "description", "planned_by", "status"]}
                      onClearRow={(row) => clearRow("meals", "planned", String(row.id ?? ""))}
                      isBusy={isMutating}
                    />
                  </div>
                )}
                {data.meals.dietary_notes.length > 0 && (
                  <div>
                    <div className="mb-2 flex items-center justify-between">
                      <p className="text-xs font-medium text-muted-foreground">Dietary Notes</p>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={isMutating}
                        onClick={() => clearCollection("meals", "dietary_notes")}
                      >
                        Clear All
                      </Button>
                    </div>
                    <GenericTable
                      rows={data.meals.dietary_notes}
                      columns={["entity", "note", "scope", "added_at"]}
                      onClearRow={(row) =>
                        clearRow("meals", "dietary_notes", String(row.entity ?? ""), "entity")
                      }
                      rowKeyField="entity"
                      isBusy={isMutating}
                    />
                  </div>
                )}
                {data.meals.planned.length === 0 && data.meals.dietary_notes.length === 0 && (
                  <p className="text-sm text-muted-foreground">No meal data.</p>
                )}
              </CollapsibleSection>
            );

          case "maintenance":
            return (
              <CollapsibleSection
                key={section.key}
                title="Maintenance"
                count={
                  itemCount(data.maintenance.assets) + itemCount(data.maintenance.items)
                }
                defaultOpen={section.populated}
                headerActions={categoryAction("maintenance")}
              >
                {data.maintenance.assets.length > 0 && (
                  <div className="mb-4">
                    <p className="mb-2 text-xs font-medium text-muted-foreground">Assets</p>
                    <GenericTable
                      rows={data.maintenance.assets}
                      columns={["id", "type", "name", "details"]}
                    />
                  </div>
                )}
                {data.maintenance.items.length > 0 && (
                  <div>
                    <p className="mb-2 text-xs font-medium text-muted-foreground">Items</p>
                    <GenericTable
                      rows={data.maintenance.items}
                      columns={["id", "asset_id", "task", "interval", "last_performed", "next_due", "responsible", "status"]}
                    />
                  </div>
                )}
                {data.maintenance.assets.length === 0 && data.maintenance.items.length === 0 && (
                  <p className="text-sm text-muted-foreground">No maintenance data.</p>
                )}
              </CollapsibleSection>
            );

          case "budget_tracker":
            return (
              <CollapsibleSection
                key={section.key}
                title="Budget Tracker"
                badge={`Date: ${formatDate(data.outbound_budget_tracker.date)}`}
                defaultOpen={section.populated}
              >
                <div className="space-y-4">
                  <div>
                    <p className="mb-2 text-xs font-medium text-muted-foreground">By Person</p>
                    {Object.keys(data.outbound_budget_tracker.by_person).length === 0 ? (
                      <p className="text-sm text-muted-foreground">No per-person data.</p>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="text-xs">Person</TableHead>
                            <TableHead className="text-xs">Sent</TableHead>
                            <TableHead className="text-xs">Max</TableHead>
                            <TableHead className="text-xs">Messages</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {Object.entries(data.outbound_budget_tracker.by_person).map(
                            ([person, budget]) => (
                              <TableRow key={person}>
                                <TableCell className="font-mono text-xs">{person}</TableCell>
                                <TableCell className="text-xs">{budget.unprompted_sent}</TableCell>
                                <TableCell className="text-xs">{budget.max}</TableCell>
                                <TableCell className="text-xs">{budget.messages.length}</TableCell>
                              </TableRow>
                            ),
                          )}
                        </TableBody>
                      </Table>
                    )}
                  </div>
                  <div>
                    <p className="mb-2 text-xs font-medium text-muted-foreground">By Thread</p>
                    {Object.keys(data.outbound_budget_tracker.by_thread).length === 0 ? (
                      <p className="text-sm text-muted-foreground">No per-thread data.</p>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="text-xs">Thread</TableHead>
                            <TableHead className="text-xs">Last Hour</TableHead>
                            <TableHead className="text-xs">Max / Hour</TableHead>
                            <TableHead className="text-xs">Last Sent</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {Object.entries(data.outbound_budget_tracker.by_thread).map(
                            ([thread, budget]) => (
                              <TableRow key={thread}>
                                <TableCell className="font-mono text-xs">{thread}</TableCell>
                                <TableCell className="text-xs">{budget.last_hour_count}</TableCell>
                                <TableCell className="text-xs">{budget.max_per_hour}</TableCell>
                                <TableCell className="text-xs">
                                  {formatDate(budget.last_sent_at)}
                                </TableCell>
                              </TableRow>
                            ),
                          )}
                        </TableBody>
                      </Table>
                    )}
                  </div>
                </div>
              </CollapsibleSection>
            );

          case "data_ingest":
            return (
              <CollapsibleSection
                key={section.key}
                title="Data Ingest"
                defaultOpen={section.populated}
              >
                <div className="space-y-4">
                  {(
                    [
                      ["Email Monitor", data.data_ingest_state.email_monitor],
                      ["Calendar Sync", data.data_ingest_state.calendar_sync],
                      ["Forwarded Messages", data.data_ingest_state.forwarded_messages],
                    ] as const
                  ).map(([label, source]) => (
                    <div key={label}>
                      <p className="mb-2 text-xs font-medium text-muted-foreground">
                        {label}
                        <Badge
                          variant={source.active ? "default" : "outline"}
                          className="ml-2 text-xs"
                        >
                          {source.active ? "active" : "inactive"}
                        </Badge>
                      </p>
                      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs sm:grid-cols-4">
                        <div>
                          <span className="text-muted-foreground">Last poll: </span>
                          {formatDate(source.last_poll)}
                        </div>
                        <div>
                          <span className="text-muted-foreground">Last sync: </span>
                          {formatDate(source.last_sync)}
                        </div>
                        <div>
                          <span className="text-muted-foreground">Total processed: </span>
                          {source.total_processed}
                        </div>
                        <div>
                          <span className="text-muted-foreground">Watermark: </span>
                          {formatDate(source.watermark)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CollapsibleSection>
            );

          case "digests":
            return (
              <CollapsibleSection
                key={section.key}
                title="Digests"
                count={itemCount(data.digests.history)}
                defaultOpen={section.populated}
                headerActions={categoryAction("digests")}
              >
                <GenericTable
                  rows={data.digests.history}
                  columns={["date", "morning", "evening"]}
                  emptyMessage="No digest history."
                />
              </CollapsibleSection>
            );

          case "threads":
            return (
              <CollapsibleSection
                key={section.key}
                title="Thread History"
                count={Object.keys(data.threads).length}
                defaultOpen={section.populated}
                headerActions={categoryAction("threads")}
              >
                {Object.keys(data.threads).length === 0 ? (
                  <p className="text-sm text-muted-foreground">No thread history.</p>
                ) : (
                  <div className="space-y-4">
                    {Object.entries(data.threads).map(([threadId, history]) => (
                      <div key={threadId}>
                        <p className="mb-2 text-xs font-medium text-muted-foreground">
                          <span className="font-mono">{threadId}</span>
                          <Badge variant="outline" className="ml-2 text-xs">
                            {history.active_topic_context}
                          </Badge>
                          <span className="ml-2">
                            Last activity: {formatDate(history.last_activity)}
                          </span>
                        </p>
                        {history.recent_messages.length > 0 ? (
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead className="text-xs">Time</TableHead>
                                <TableHead className="text-xs">From</TableHead>
                                <TableHead className="text-xs">Topic</TableHead>
                                <TableHead className="text-xs">Content</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {history.recent_messages.map((msg) => (
                                <TableRow key={msg.id}>
                                  <TableCell className="text-xs">{formatDate(msg.at)}</TableCell>
                                  <TableCell className="font-mono text-xs">{msg.from}</TableCell>
                                  <TableCell className="text-xs">{msg.topic_context}</TableCell>
                                  <TableCell className="max-w-xs truncate text-xs">
                                    {msg.content}
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        ) : (
                          <p className="text-sm text-muted-foreground">No recent messages.</p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CollapsibleSection>
            );
        }
      })}
    </div>
  );
}
