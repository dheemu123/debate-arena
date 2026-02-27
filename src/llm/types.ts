export interface LLMCallResult {
  content: string;
  rawResponse: string;
  provider: string;
  model: string;
  tokenUsage?: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
  };
}

export interface DebaterAdapter {
  generate(prompt: string): Promise<LLMCallResult>;
  readonly provider: string;
  readonly model: string;
}

export interface JudgeAdapter {
  judge(input: {
    digest: unknown;
    rubricInstructions: string;
  }): Promise<LLMCallResult>;
  readonly name: string;
  readonly provider: string;
  readonly model: string;
}
