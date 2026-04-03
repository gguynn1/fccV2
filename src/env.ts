import "dotenv/config";
import { z } from "zod";

const requiredEnvVars = [
  "ANTHROPIC_API_KEY",
  "TWILIO_ACCOUNT_SID",
  "TWILIO_AUTH_TOKEN",
  "TWILIO_MESSAGING_IDENTITY",
  "REDIS_URL",
  "DATABASE_PATH",
] as const;

const envSchema = z.object({
  ANTHROPIC_API_KEY: z.string().min(1),
  TWILIO_ACCOUNT_SID: z.string().min(1),
  TWILIO_AUTH_TOKEN: z.string().min(1),
  TWILIO_MESSAGING_IDENTITY: z.string().min(1),
  REDIS_URL: z.string().min(1),
  DATABASE_PATH: z.string().min(1),
  PORT: z.string().optional(),
});

export type AppEnv = z.infer<typeof envSchema>;
type EnvRecord = Record<string, string | undefined>;

export function loadEnv(env: EnvRecord): AppEnv {
  // Return one explicit error listing every missing key so setup fixes are one pass.
  const missing = requiredEnvVars.filter((key) => {
    const value = env[key];
    return value === undefined || value.trim().length === 0;
  });

  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(", ")}`);
  }

  const parsed = envSchema.safeParse(env);
  if (!parsed.success) {
    throw new Error(
      `Invalid environment configuration: ${parsed.error.issues
        .map((issue) => issue.path.join("."))
        .join(", ")}`,
    );
  }

  return parsed.data;
}
