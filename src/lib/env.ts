import { z } from "zod";

const EnvSchema = z.object({
  DATABASE_URL: z.string().url(),
  OPENAI_API_KEY: z.string().optional(),
  GOOGLE_API_KEY: z.string().optional(),
  GEMINI_API_KEY: z.string().optional(),
  LOCAL_JUDGE_URL: z.string().url().optional(),
});

let _env: z.infer<typeof EnvSchema> | null = null;

export function getEnv(): z.infer<typeof EnvSchema> {
  if (_env) return _env;
  _env = EnvSchema.parse(process.env);
  return _env;
}

export function hasOpenAI(): boolean {
  const key = process.env.OPENAI_API_KEY;
  return !!key && key.length > 0 && !key.startsWith("sk-...");
}

export function hasGoogle(): boolean {
  const key = process.env.GOOGLE_API_KEY ?? process.env.GEMINI_API_KEY;
  return !!key && key.length > 0;
}

export function getGoogleApiKey(): string | undefined {
  return process.env.GOOGLE_API_KEY ?? process.env.GEMINI_API_KEY;
}
