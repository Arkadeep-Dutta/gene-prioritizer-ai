import { z } from "zod";

const optionalString = z.string().optional().default("");

const databaseEnvironmentSchema = z.object({
  DATABASE_URL: z.string().min(1).optional(),
  DIRECT_URL: optionalString,
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  LLM_PROVIDER: optionalString,
  LLM_MODEL: optionalString,
  DISABLE_LLM: z.enum(["true", "false"]).default("true"),
  GEMINI_API_KEY: optionalString,
  OPENAI_API_KEY: optionalString,
  ANTHROPIC_API_KEY: optionalString,
  NCBI_API_KEY: optionalString,
  NCBI_EMAIL: optionalString,
  REDIS_URL: optionalString,
});

export type DatabaseEnvironment = z.infer<typeof databaseEnvironmentSchema> & {
  DATABASE_URL: string;
};

export function readDatabaseEnvironment(
  environment: NodeJS.ProcessEnv = process.env,
): DatabaseEnvironment {
  const parsed = databaseEnvironmentSchema.parse(environment);
  const databaseUrl = parsed.DATABASE_URL?.trim();

  if (!databaseUrl && parsed.NODE_ENV === "production") {
    throw new Error("DATABASE_URL must be configured in production.");
  }

  return {
    ...parsed,
    DATABASE_URL: databaseUrl || "file:./dev.db",
  };
}

export function isDatabaseConfigured(environment: NodeJS.ProcessEnv = process.env): boolean {
  return Boolean(environment.DATABASE_URL?.trim()) || environment.NODE_ENV !== "production";
}
