import { systemConfig } from "../_seed/system-config.js";

/**
 * Temporary runtime config bridge.
 * Centralizes configuration access so runtime modules avoid direct `_seed` imports.
 */
export const runtimeSystemConfig = systemConfig;
