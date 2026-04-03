import type { SystemConfig } from "../index.js";
import { systemConfig } from "../_seed/system-config.js";

function replaceValueInPlace(target: unknown, source: unknown): unknown {
  if (Array.isArray(target) && Array.isArray(source)) {
    target.length = 0;
    for (const item of source) {
      target.push(structuredClone(item));
    }
    return target;
  }

  if (
    target !== null &&
    source !== null &&
    typeof target === "object" &&
    typeof source === "object" &&
    !Array.isArray(target) &&
    !Array.isArray(source)
  ) {
    const targetRecord = target as Record<string, unknown>;
    const sourceRecord = source as Record<string, unknown>;

    for (const key of Object.keys(targetRecord)) {
      if (!(key in sourceRecord)) {
        delete targetRecord[key];
      }
    }

    for (const [key, value] of Object.entries(sourceRecord)) {
      const existing = targetRecord[key];

      if (Array.isArray(value)) {
        if (Array.isArray(existing)) {
          replaceValueInPlace(existing, value);
        } else {
          targetRecord[key] = structuredClone(value);
        }
        continue;
      }

      if (value !== null && typeof value === "object") {
        if (existing !== null && typeof existing === "object" && !Array.isArray(existing)) {
          replaceValueInPlace(existing, value);
        } else {
          targetRecord[key] = structuredClone(value);
        }
        continue;
      }

      targetRecord[key] = value;
    }

    return targetRecord;
  }

  return structuredClone(source);
}

/**
 * Runtime config stays mutable so long-lived services can observe admin edits
 * through existing object references without being rebuilt.
 */
export const runtimeSystemConfig: SystemConfig = structuredClone(systemConfig);

export function applyRuntimeSystemConfig(nextConfig: SystemConfig): SystemConfig {
  replaceValueInPlace(runtimeSystemConfig, nextConfig);
  return runtimeSystemConfig;
}
