import {
  aiResultSchema,
  emailDraftSchema,
  SERVICE_CATEGORIES,
  todayInJakarta,
  type AiResult,
  type AiScores,
  type EmailDraft,
  type Priority,
  type ServiceCategory,
} from "@fugo/shared";
import { z } from "zod";
import type { AiConfig } from "../env";
import {
  AiError,
  decide,
  generateJson,
  type DecisionAnswer,
  type FetchFn,
  type GeminiCallContext,
} from "./gemini";
import {
  ANALYSIS_JSON_SCHEMA,
  ANALYSIS_SYSTEM_INSTRUCTION,
  analysisPrompt,
  briefContext,
  CATEGORY_QUESTION_KEY,
  decisionQuestions,
  EMAIL_JSON_SCHEMA,
  EMAIL_SYSTEM_INSTRUCTION,
  emailPrompt,
  PRIORITY_QUESTION_KEY,
  PRIORITY_RUBRIC,
  type BriefForAi,
} from "./prompts";

export interface AiDeps {
  config: AiConfig;
  fetchFn?: FetchFn;
  now?: Date;
}

export interface BriefAnalysis {
  result: AiResult;
  scores: AiScores;
  model: string;
}

function callContext(deps: AiDeps): GeminiCallContext {
  return {
    config: deps.config,
    // Wrapped, not `fetch` itself: it is called as ctx.fetchFn(...), and on
    // Workers a global fetch called with another `this` throws "Illegal invocation".
    fetchFn: deps.fetchFn ?? ((input, init) => fetch(input, init)),
    signal: AbortSignal.timeout(deps.config.timeoutMs),
  };
}

function formatIssues(error: z.ZodError): string {
  return error.issues.map((issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`).join("; ");
}

export function readCategory(answer: DecisionAnswer | undefined): {
  category: ServiceCategory;
  scores: AiScores["category"];
} {
  if (answer?.type !== "choice") {
    throw new AiError("Decisions API did not return a category choice", "invalid_output");
  }
  const category = z.enum(SERVICE_CATEGORIES).safeParse(answer.choice);
  if (!category.success) {
    throw new AiError(`Decisions API returned an unknown category: ${answer.choice}`, "invalid_output");
  }
  return {
    category: category.data,
    scores: { confidence: answer.confidence, probabilities: answer.probabilities },
  };
}

// The rubric is ordered Low(0) < Medium(1) < High(2). The API returns the
// probability-weighted level index, so rounding it keeps the order: a brief split
// between Low and High lands on Medium, not on whichever extreme is a bit higher.
export function readPriority(answer: DecisionAnswer | undefined): {
  priority: Priority;
  scores: AiScores["priority"];
} {
  if (answer?.type !== "score") {
    throw new AiError("Decisions API did not return a priority score", "invalid_output");
  }
  const maxLevel = PRIORITY_RUBRIC.length - 1;
  const level = Math.min(maxLevel, Math.max(0, Math.round(answer.score)));
  const probabilities = Object.fromEntries(
    PRIORITY_RUBRIC.map((rubric, index) => [rubric.priority, answer.probabilities[String(index)] ?? 0]),
  ) as Record<Priority, number>;
  return {
    priority: PRIORITY_RUBRIC[level]!.priority,
    scores: { expected_score: answer.score, confidence: answer.confidence, probabilities },
  };
}

// Two steps: the Decisions API picks category and priority (calibrated, cheap),
// then the text model writes summary, reason, and missing info for those labels.
// The combined object is validated against the shared schema before it is returned.
export async function analyzeBrief(brief: BriefForAi, deps: AiDeps): Promise<BriefAnalysis> {
  const ctx = callContext(deps);
  const context = briefContext(brief, todayInJakarta(deps.now));

  const answers = await decide(ctx, { input: context, questions: decisionQuestions() });
  const category = readCategory(answers[CATEGORY_QUESTION_KEY]);
  const priority = readPriority(answers[PRIORITY_QUESTION_KEY]);

  const text = await generateJson(ctx, {
    systemInstruction: ANALYSIS_SYSTEM_INSTRUCTION,
    prompt: analysisPrompt(context, { category: category.category, priority: priority.priority }),
    responseJsonSchema: ANALYSIS_JSON_SCHEMA,
  });

  const result = aiResultSchema.safeParse({
    ...(typeof text === "object" && text !== null ? text : {}),
    service_category: category.category,
    priority: priority.priority,
  });
  if (!result.success) {
    throw new AiError(`AI output failed schema validation: ${formatIssues(result.error)}`, "invalid_output");
  }

  return {
    result: result.data,
    scores: { category: category.scores, priority: priority.scores },
    model: `${deps.config.decisionModel} + ${deps.config.textModel}`,
  };
}

export async function draftReplyEmail(
  brief: BriefForAi,
  analysis: AiResult | null,
  deps: AiDeps,
): Promise<EmailDraft> {
  const ctx = callContext(deps);
  const context = briefContext(brief, todayInJakarta(deps.now));
  const output = await generateJson(ctx, {
    systemInstruction: EMAIL_SYSTEM_INSTRUCTION,
    prompt: emailPrompt(context, analysis),
    responseJsonSchema: EMAIL_JSON_SCHEMA,
  });
  const draft = emailDraftSchema.safeParse(output);
  if (!draft.success) {
    throw new AiError(`Email draft failed schema validation: ${formatIssues(draft.error)}`, "invalid_output");
  }
  return draft.data;
}
