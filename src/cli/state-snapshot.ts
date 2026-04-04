import { readFileSync, writeFileSync } from "node:fs";

import "dotenv/config";

import {
  createStateService,
  type ExportedSnapshotEnvelope,
} from "../02-supporting-services/03-state-service/index.js";
import { loadEnv } from "../env.js";

const env = loadEnv(process.env as Record<string, string | undefined>);

async function main(): Promise<void> {
  const [command, ...rest] = process.argv.slice(2);

  if (command === "export") {
    const stateService = createStateService(env.DATABASE_PATH);
    const snapshot = await stateService.exportSnapshot();
    const outPath = rest[0] ?? `data/state-export-${Date.now()}.json`;
    writeFileSync(outPath, JSON.stringify(snapshot, null, 2), "utf8");
    process.stdout.write(`Exported state snapshot to ${outPath}\n`);
    stateService.close();
    return;
  }

  if (command === "import") {
    const fileFlagIndex = rest.indexOf("--file");
    const filePath = fileFlagIndex >= 0 ? rest[fileFlagIndex + 1] : rest[0];
    if (!filePath) {
      throw new Error("Usage: state-snapshot import --file <path>");
    }
    const raw = readFileSync(filePath, "utf8");
    const envelope = JSON.parse(raw) as ExportedSnapshotEnvelope;
    const stateService = createStateService(env.DATABASE_PATH);
    await stateService.importSnapshot(envelope);
    process.stdout.write(`Imported state snapshot from ${filePath}\n`);
    stateService.close();
    return;
  }

  throw new Error(`Unknown command: ${command}. Use "export" or "import".`);
}

void main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
