import OpenAI from "openai";
import { GoogleGenAI } from "@google/genai";
import type { DebaterAdapter, JudgeAdapter, LLMCallResult } from "./types";

const OPENAI_PROVIDER = "openai";
const GOOGLE_PROVIDER = "google";

// ---------------------------------------------------------------------------
// Stub adapters (fallback when keys missing or for tests)
// ---------------------------------------------------------------------------

export class StubDebaterAdapter implements DebaterAdapter {
  readonly provider: string;
  readonly model: string;

  constructor(provider: string, model: string) {
    this.provider = provider;
    this.model = model;
  }

  async generate(prompt: string): Promise<LLMCallResult> {
    return {
      content: `[Stub response from ${this.model}] This is a placeholder argument responding to the debate prompt. Set OPENAI_API_KEY or GOOGLE_API_KEY for real LLM calls.`,
      rawResponse: `stub:${this.model}`,
      provider: this.provider,
      model: this.model,
    };
  }
}

export class StubJudgeAdapter implements JudgeAdapter {
  readonly name: string;
  readonly provider: string;
  readonly model: string;

  constructor(name: string, provider: string, model: string) {
    this.name = name;
    this.provider = provider;
    this.model = model;
  }

  async judge(_input: {
    digest: unknown;
    rubricInstructions: string;
  }): Promise<LLMCallResult> {
    const decision = {
      winner: "A" as const,
      confidence: 0.7,
      scoresA: {
        logic: 7,
        evidence: 6,
        responsiveness: 7,
        clarity: 8,
        fairness: 7,
      },
      scoresB: {
        logic: 6,
        evidence: 7,
        responsiveness: 6,
        clarity: 7,
        fairness: 7,
      },
      reasons: [
        "Side A presented more structured arguments",
        "Side A had stronger opening framing",
      ],
    };

    return {
      content: JSON.stringify(decision),
      rawResponse: JSON.stringify(decision),
      provider: this.provider,
      model: this.model,
    };
  }
}

// ---------------------------------------------------------------------------
// OpenAI adapter
// ---------------------------------------------------------------------------

export class OpenAIDebaterAdapter implements DebaterAdapter {
  readonly provider = OPENAI_PROVIDER;
  readonly model: string;
  private client: OpenAI;

  constructor(apiKey: string, model: string) {
    this.model = model;
    this.client = new OpenAI({ apiKey });
  }

  async generate(prompt: string): Promise<LLMCallResult> {
    const completion = await this.client.chat.completions.create({
      model: this.model,
      messages: [{ role: "user", content: prompt }],
      temperature: 0.7,
      max_tokens: 1024,
    });

    const choice = completion.choices[0];
    const content = choice?.message?.content ?? "";
    const rawResponse = JSON.stringify(completion);

    return {
      content,
      rawResponse,
      provider: OPENAI_PROVIDER,
      model: this.model,
      tokenUsage: completion.usage
        ? {
            promptTokens: completion.usage.prompt_tokens,
            completionTokens: completion.usage.completion_tokens,
            totalTokens: completion.usage.total_tokens ?? undefined,
          }
        : undefined,
    };
  }
}

export class OpenAIJudgeAdapter implements JudgeAdapter {
  readonly name: string;
  readonly provider = OPENAI_PROVIDER;
  readonly model: string;
  private client: OpenAI;

  constructor(name: string, apiKey: string, model: string) {
    this.name = name;
    this.model = model;
    this.client = new OpenAI({ apiKey });
  }

  async judge(input: {
    digest: unknown;
    rubricInstructions: string;
  }): Promise<LLMCallResult> {
    const prompt = `${input.rubricInstructions}\n\nDebate digest:\n${JSON.stringify(input.digest, null, 2)}`;

    const completion = await this.client.chat.completions.create({
      model: this.model,
      messages: [{ role: "user", content: prompt }],
      temperature: 0.1,
      max_tokens: 512,
    });

    const choice = completion.choices[0];
    const content = choice?.message?.content ?? "";
    const rawResponse = JSON.stringify(completion);

    return {
      content,
      rawResponse,
      provider: OPENAI_PROVIDER,
      model: this.model,
      tokenUsage: completion.usage
        ? {
            promptTokens: completion.usage.prompt_tokens,
            completionTokens: completion.usage.completion_tokens,
            totalTokens: completion.usage.total_tokens ?? undefined,
          }
        : undefined,
    };
  }
}

// ---------------------------------------------------------------------------
// Google / Gemini adapter
// ---------------------------------------------------------------------------

export class GoogleDebaterAdapter implements DebaterAdapter {
  readonly provider = GOOGLE_PROVIDER;
  readonly model: string;
  private genAI: GoogleGenAI;

  constructor(apiKey: string, model: string) {
    this.model = model;
    this.genAI = new GoogleGenAI({ apiKey });
  }

  async generate(prompt: string): Promise<LLMCallResult> {
    const response = await this.genAI.models.generateContent({
      model: this.model,
      contents: prompt,
      config: { temperature: 0.7, maxOutputTokens: 1024 },
    });

    const content = response.text ?? "";
    const rawResponse = JSON.stringify({
      text: content,
      usageMetadata: response.usageMetadata,
    });

    return {
      content,
      rawResponse,
      provider: GOOGLE_PROVIDER,
      model: this.model,
      tokenUsage: response.usageMetadata
        ? {
            promptTokens: response.usageMetadata.promptTokenCount,
            completionTokens: response.usageMetadata.candidatesTokenCount,
            totalTokens:
              (response.usageMetadata.promptTokenCount ?? 0) +
              (response.usageMetadata.candidatesTokenCount ?? 0),
          }
        : undefined,
    };
  }
}

export class GoogleJudgeAdapter implements JudgeAdapter {
  readonly name: string;
  readonly provider = GOOGLE_PROVIDER;
  readonly model: string;
  private genAI: GoogleGenAI;

  constructor(name: string, apiKey: string, model: string) {
    this.name = name;
    this.model = model;
    this.genAI = new GoogleGenAI({ apiKey });
  }

  async judge(input: {
    digest: unknown;
    rubricInstructions: string;
  }): Promise<LLMCallResult> {
    const prompt = `${input.rubricInstructions}\n\nDebate digest:\n${JSON.stringify(input.digest, null, 2)}`;

    const response = await this.genAI.models.generateContent({
      model: this.model,
      contents: prompt,
      config: { temperature: 0.1, maxOutputTokens: 512 },
    });

    const content = response.text ?? "";
    const rawResponse = JSON.stringify({
      text: content,
      usageMetadata: response.usageMetadata,
    });

    return {
      content,
      rawResponse,
      provider: GOOGLE_PROVIDER,
      model: this.model,
      tokenUsage: response.usageMetadata
        ? {
            promptTokens: response.usageMetadata.promptTokenCount,
            completionTokens: response.usageMetadata.candidatesTokenCount,
            totalTokens:
              (response.usageMetadata.promptTokenCount ?? 0) +
              (response.usageMetadata.candidatesTokenCount ?? 0),
          }
        : undefined,
    };
  }
}

// ---------------------------------------------------------------------------
// LocalJudge (optional FastAPI service)
// ---------------------------------------------------------------------------

export class LocalJudgeAdapter implements JudgeAdapter {
  readonly name = "LocalJudge";
  readonly provider = "local";
  readonly model: string;
  private baseUrl: string;

  constructor(
    baseUrl: string = process.env.LOCAL_JUDGE_URL ?? "http://localhost:8000",
    model: string = "local-judge-v1"
  ) {
    this.baseUrl = baseUrl;
    this.model = model;
  }

  async judge(input: {
    digest: unknown;
    rubricInstructions: string;
  }): Promise<LLMCallResult> {
    const response = await fetch(`${this.baseUrl}/judge`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        digest: input.digest,
        rubric_instructions: input.rubricInstructions,
      }),
    });

    if (!response.ok) {
      throw new Error(
        `LocalJudge returned ${response.status}: ${await response.text()}`
      );
    }

    const data = await response.json();
    return {
      content: JSON.stringify(data),
      rawResponse: JSON.stringify(data),
      provider: "local",
      model: this.model,
    };
  }
}

// ---------------------------------------------------------------------------
// Adapter factory
// ---------------------------------------------------------------------------

const OPENAI_MODELS = [
  "gpt-4o",
  "gpt-4o-mini",
  "gpt-4-turbo",
  "gpt-4",
  "gpt-3.5-turbo",
];

const GOOGLE_MODELS = [
  "gemini-2.5-flash",
  "gemini-2.0-flash",
  "gemini-1.5-flash",
  "gemini-1.5-pro",
  "gemini-1.0-pro",
  "gemini-pro",
];

function isOpenAIModel(model: string): boolean {
  return (
    model.startsWith("gpt-") ||
    model.startsWith("o1-") ||
    OPENAI_MODELS.some((m) => model.toLowerCase().includes(m.toLowerCase()))
  );
}

function isGoogleModel(model: string): boolean {
  return (
    model.toLowerCase().includes("gemini") ||
    GOOGLE_MODELS.some((m) => model.toLowerCase().includes(m.toLowerCase()))
  );
}

export function createDebaterAdapter(
  model: string,
  side: "A" | "B"
): DebaterAdapter {
  const openaiKey = process.env.OPENAI_API_KEY;
  const googleKey = process.env.GOOGLE_API_KEY ?? process.env.GEMINI_API_KEY;

  if (isOpenAIModel(model) && openaiKey) {
    return new OpenAIDebaterAdapter(openaiKey, model);
  }
  if (isGoogleModel(model) && googleKey) {
    return new GoogleDebaterAdapter(googleKey, model);
  }

  return new StubDebaterAdapter(
    "stub",
    `${model} (no API key — add OPENAI_API_KEY or GOOGLE_API_KEY)`
  );
}

export function createJudgeAdapter(
  name: string,
  provider: "openai" | "google",
  model: string
): JudgeAdapter {
  const openaiKey = process.env.OPENAI_API_KEY;
  const googleKey = process.env.GOOGLE_API_KEY ?? process.env.GEMINI_API_KEY;

  if (provider === "openai" && openaiKey) {
    return new OpenAIJudgeAdapter(name, openaiKey, model);
  }
  if (provider === "google" && googleKey) {
    return new GoogleJudgeAdapter(name, googleKey, model);
  }

  return new StubJudgeAdapter(
    name,
    "stub",
    `${model} (no API key — add ${provider === "openai" ? "OPENAI_API_KEY" : "GOOGLE_API_KEY"})`
  );
}
