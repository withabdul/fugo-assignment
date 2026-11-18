import { z } from "zod";
import type { AiConfig } from "../env";

const BASE_URL = "https://generativelanguage.googleapis.com/v1beta";

export type FetchFn = (input: string, init: RequestInit) => Promise<Response>;

export type AiErrorKind = "timeout" | "http" | "blocked" | "invalid_output";

export class AiError extends Error {
  constructor(
    message: string,
    readonly kind: AiErrorKind,
  ) {
    super(message);
    this.name = "AiError";
  }
}

export interface GeminiCallContext {
  config: AiConfig;
  fetchFn: FetchFn;
  // One signal for the whole analysis, so two calls in a row share one deadline.
  signal: AbortSignal;
}

async function postJson(url: string, body: unknown, ctx: GeminiCallContext): Promise<unknown> {
  let res: Response;
  try {
    res = await ctx.fetchFn(url, {
      method: "POST",
      headers: { "content-type": "application/json", "x-goog-api-key": ctx.config.apiKey },
      body: JSON.stringify(body),
      signal: ctx.signal,
    });
  } catch (err) {
    if (ctx.signal.aborted) {
      throw new AiError(`Gemini did not answer within ${ctx.config.timeoutMs} ms`, "timeout");
    }
    throw new AiError(`Gemini request failed: ${(err as Error).message}`, "http");
  }

  if (!res.ok) {
    const detail = (await res.text().catch(() => "")).slice(0, 300);
    throw new AiError(`Gemini returned HTTP ${res.status}: ${detail}`, "http");
  }

  try {
    return await res.json();
  } catch {
    throw new AiError("Gemini returned a body that is not JSON", "invalid_output");
  }
}

// Models sometimes wrap JSON in a markdown fence even in JSON mode.
export function parseJsonText(text: string): unknown {
  const trimmed = text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "");
  try {
    return JSON.parse(trimmed);
  } catch {
    throw new AiError(`Model output is not valid JSON: ${trimmed.slice(0, 200)}`, "invalid_output");
  }
}

const generateContentResponseSchema = z.object({
  candidates: z
    .array(
      z.object({
        content: z
          .object({
            parts: z.array(z.object({ text: z.string().optional(), thought: z.boolean().optional() })),
          })
          .optional(),
        finishReason: z.string().optional(),
      }),
    )
    .optional(),
  promptFeedback: z.object({ blockReason: z.string().optional() }).optional(),
});

export async function generateJson(
  ctx: GeminiCallContext,
  request: { systemInstruction: string; prompt: string; responseJsonSchema: object },
): Promise<unknown> {
  const url = `${BASE_URL}/models/${encodeURIComponent(ctx.config.textModel)}:generateContent`;
  const raw = await postJson(
    url,
    {
      systemInstruction: { parts: [{ text: request.systemInstruction }] },
      contents: [{ role: "user", parts: [{ text: request.prompt }] }],
      generationConfig: {
        responseMimeType: "application/json",
        responseJsonSchema: request.responseJsonSchema,
        temperature: 0.2,
      },
    },
    ctx,
  );

  const parsed = generateContentResponseSchema.safeParse(raw);
  if (!parsed.success) {
    throw new AiError("Unexpected generateContent response shape", "invalid_output");
  }
  const blockReason = parsed.data.promptFeedback?.blockReason;
  if (blockReason) {
    throw new AiError(`Gemini blocked the prompt: ${blockReason}`, "blocked");
  }

  const candidate = parsed.data.candidates?.[0];
  const text = (candidate?.content?.parts ?? [])
    .filter((part) => !part.thought)
    .map((part) => part.text ?? "")
    .join("");
  if (!text) {
    throw new AiError(
      `Gemini returned no text (finishReason: ${candidate?.finishReason ?? "unknown"})`,
      "invalid_output",
    );
  }
  return parseJsonText(text);
}

// Gemini Decisions API: calibrated answers to closed-set questions.
export type DecisionQuestion =
  | { type: "choice"; instructions: string; criteria: Record<string, string> }
  | { type: "score"; instructions: string; criteria: string[] };

const decisionAnswerSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("choice"),
    choice: z.string(),
    probabilities: z.record(z.string(), z.number()),
    confidence: z.number(),
  }),
  z.object({
    type: z.literal("score"),
    score: z.number(),
    probabilities: z.record(z.string(), z.number()),
    confidence: z.number(),
  }),
  z.object({ type: z.literal("noul"), noul: z.number(), confidence: z.number() }),
]);

const decisionsResponseSchema = z.object({
  answers: z.record(z.string(), decisionAnswerSchema),
});

export type DecisionAnswer = z.infer<typeof decisionAnswerSchema>;

export async function decide(
  ctx: GeminiCallContext,
  request: { input: string; questions: Record<string, DecisionQuestion> },
): Promise<Record<string, DecisionAnswer>> {
  const raw = await postJson(
    `${BASE_URL}/decisions`,
    { model: ctx.config.decisionModel, input: request.input, questions: request.questions },
    ctx,
  );
  const parsed = decisionsResponseSchema.safeParse(raw);
  if (!parsed.success) {
    throw new AiError("Unexpected Decisions API response shape", "invalid_output");
  }
  return parsed.data.answers;
}
