import { readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { systemConfig } from "../_seed/system-config.js";
import { SamePrecedenceStrategy } from "../01-service-stack/types.js";
import { DispatchPriority } from "../types.js";
import { ConfirmationActionType } from "./08-confirmation-service/types.js";
import { fixtureQueueItem, fixtureThreadHistory } from "./test-fixtures.js";
import type {
  BudgetService,
  ConfirmationService,
  EscalationService,
  RoutingService,
  SchedulerService,
  StateService,
  TopicProfileService,
} from "./types.js";

function getServiceDirectories(): string[] {
  const root = resolve(process.cwd(), "src/02-supporting-services");
  return readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && /^\d{2}-/u.test(entry.name))
    .map((entry) => join(root, entry.name));
}

function getTypeScriptFiles(directory: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const fullPath = join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...getTypeScriptFiles(fullPath));
      continue;
    }
    if (entry.name.endsWith(".ts")) {
      files.push(fullPath);
    }
  }
  return files;
}

describe("Supporting-service contracts", () => {
  it("uses shared fixtures for queue items and thread history", () => {
    const item = fixtureQueueItem();
    const history = fixtureThreadHistory();
    expect(item.target_thread).toContain("private");
    expect(item.priority).toBe(DispatchPriority.Batched);
    expect(history.recent_messages.length).toBeGreaterThan(0);
  });

  it("keeps worker-facing service contracts stable", async () => {
    const stateService: StateService = {
      getSystemConfig: () => Promise.resolve(systemConfig),
      saveSystemConfig: () => Promise.resolve(),
      getSystemState: () => Promise.resolve({} as never),
      saveSystemState: () => Promise.resolve(),
      getThreadHistory: () => Promise.resolve(fixtureThreadHistory()),
      saveThreadHistory: () => Promise.resolve(),
      appendDispatchResult: () => Promise.resolve(),
    };
    const schedulerService: SchedulerService = {
      produceScheduledItems: () => Promise.resolve([]),
      reconcileDowntime: () => Promise.resolve([]),
      recordDigestDelivery: () => Promise.resolve(),
    };
    const topicProfileService: TopicProfileService = {
      getTopicConfig: () => Promise.resolve({} as never),
      classifyFallback: () => Promise.resolve({} as never),
      composeMessage: () => Promise.resolve("ok"),
    };
    const routingService: RoutingService = {
      getThreadDefinitions: () => Promise.resolve([]),
      resolveTargetThread: () => Promise.resolve("family"),
      resolveRoutingDecision: () => ({}) as never,
    };
    const budgetService: BudgetService = {
      getBudgetTracker: () => Promise.resolve({} as never),
      evaluateOutbound: () =>
        Promise.resolve({
          priority: DispatchPriority.Batched,
          reason: "contract fixture",
        }),
      recordDispatch: () => Promise.resolve(),
    };
    const escalationService: EscalationService = {
      getStatus: () => Promise.resolve({ active: [] }),
      evaluate: () => Promise.resolve({ should_escalate: false }),
      reconcileOnStartup: () => Promise.resolve([]),
    };
    const confirmationService: ConfirmationService = {
      getState: () => Promise.resolve({ pending: [], recent: [] }),
      requiresConfirmation: () => false,
      openConfirmation: () => Promise.resolve({} as never),
      resolveFromQueueItem: () => Promise.resolve(null),
      expirePending: () => Promise.resolve([]),
      reconcileOnStartup: () => Promise.resolve({ expired: [], notifications: [] }),
      close: () => Promise.resolve(),
    };

    const queueItem = fixtureQueueItem();
    expect(await schedulerService.produceScheduledItems(queueItem.created_at)).toEqual([]);
    expect(await stateService.getThreadHistory(queueItem.target_thread)).not.toBeNull();
    expect(
      await budgetService.evaluateOutbound(queueItem, queueItem.target_thread, {
        precedence_order: [],
        same_precedence_strategy: SamePrecedenceStrategy.Batch,
      }),
    ).toMatchObject({ priority: DispatchPriority.Batched });
    expect(await escalationService.evaluate(queueItem, queueItem.target_thread)).toMatchObject({
      should_escalate: false,
    });
    expect(confirmationService.requiresConfirmation(ConfirmationActionType.FinancialAction)).toBe(
      false,
    );
    expect(await topicProfileService.composeMessage({} as never)).toBe("ok");
    expect(await routingService.resolveTargetThread({} as never)).toBe("family");
  });

  it("has no runtime cross-service imports between supporting services", () => {
    const serviceDirectories = getServiceDirectories();
    const violations: string[] = [];
    for (const directory of serviceDirectories) {
      for (const filePath of getTypeScriptFiles(directory)) {
        const source = readFileSync(filePath, "utf8");
        const importStatements =
          source.match(/import\s+(?:type\s+)?[\s\S]*?\sfrom\s+["'][^"']+["'];/gmu) ?? [];
        for (const statement of importStatements) {
          const normalized = statement.trimStart();
          if (/^import\s+type\b/u.test(normalized)) {
            continue;
          }
          if (/from\s+["']\.\.\/\d{2}-[^/"']+\/.+["']/u.test(normalized)) {
            violations.push(`${filePath}: ${normalized}`);
          }
        }
      }
    }
    expect(violations).toEqual([]);
  });
});
