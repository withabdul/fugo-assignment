import { describe, expect, test } from "bun:test";
import { analyzeBrief, draftReplyEmail, readPriority } from "../src/ai/analyze-brief";
import { AiError, parseJsonText, type FetchFn } from "../src/ai/gemini";
import {
  analysisOk,
  decisionsOk,
  fakeGemini,
  generateOk,
  sampleBrief,
  testAiConfig,
} from "./helpers";

async function expectAiError(promise: Promise<unknown>, kind: AiError["kind"]) {
  const error = await promise.then(
    () => null,
    (err: unknown) => err,
  );
  expect(error).toBeInstanceOf(AiError);
  expect((error as AiError).kind).toBe(kind);
}

describe("analyzeBrief", () => {
  test("combines decisions and text into a valid result", async () => {
    const fetchFn = fakeGemini({ decisions: decisionsOk, generate: generateOk(analysisOk) });
    const analysis = await analyzeBrief(sampleBrief, { config: testAiConfig, fetchFn });

    expect(analysis.result).toEqual({
      ...analysisOk,
      service_category: "Website",
      priority: "High",
    });
    expect(analysis.scores.priority.probabilities).toEqual({ Low: 0.05, Medium: 0.1, High: 0.85 });
    expect(analysis.scores.category.confidence).toBe(0.9);
    expect(analysis.model).toBe("gemini-decision-1 + gemini-4-hydrogen");
  });

  test("asks the text model for low thinking effort", async () => {
    const bodies: Record<string, unknown>[] = [];
    const inner = fakeGemini({ decisions: decisionsOk, generate: generateOk(analysisOk) });
    const fetchFn: FetchFn = (url, init) => {
      if (!url.endsWith("/decisions")) bodies.push(JSON.parse(String(init.body)));
      return inner(url, init);
    };
    await analyzeBrief(sampleBrief, { config: testAiConfig, fetchFn });
    expect(bodies[0]?.generationConfig).toMatchObject({ thinkingConfig: { thinkingLevel: "low" } });
  });

  test("the text model cannot override the decided category or priority", async () => {
    const fetchFn = fakeGemini({
      decisions: decisionsOk,
      generate: generateOk({ ...analysisOk, service_category: "Branding", priority: "Low" }),
    });
    const analysis = await analyzeBrief(sampleBrief, { config: testAiConfig, fetchFn });
    expect(analysis.result.service_category).toBe("Website");
    expect(analysis.result.priority).toBe("High");
  });

  test("rejects unknown extra fields from the text model", async () => {
    const fetchFn = fakeGemini({
      decisions: decisionsOk,
      generate: generateOk({ ...analysisOk, budget_estimate: "Rp 40 juta" }),
    });
    await expectAiError(analyzeBrief(sampleBrief, { config: testAiConfig, fetchFn }), "invalid_output");
  });

  test("rejects output with a missing field", async () => {
    const { missing_info: _, ...withoutMissingInfo } = analysisOk;
    const fetchFn = fakeGemini({ decisions: decisionsOk, generate: generateOk(withoutMissingInfo) });
    await expectAiError(analyzeBrief(sampleBrief, { config: testAiConfig, fetchFn }), "invalid_output");
  });

  test("rejects output that is not JSON", async () => {
    const fetchFn = fakeGemini({ decisions: decisionsOk, generate: generateOk("Sure! Here is the summary") });
    await expectAiError(analyzeBrief(sampleBrief, { config: testAiConfig, fetchFn }), "invalid_output");
  });

  test("rejects a category outside the allowed list", async () => {
    const decisions = structuredClone(decisionsOk);
    decisions.answers.service_category.choice = "Video Production";
    const fetchFn = fakeGemini({ decisions, generate: generateOk(analysisOk) });
    await expectAiError(analyzeBrief(sampleBrief, { config: testAiConfig, fetchFn }), "invalid_output");
  });

  test("reports HTTP errors", async () => {
    const fetchFn = fakeGemini({ decisions: { error: { message: "quota" } }, status: 429 });
    await expectAiError(analyzeBrief(sampleBrief, { config: testAiConfig, fetchFn }), "http");
  });

  test("reports a blocked prompt", async () => {
    const fetchFn = fakeGemini({
      decisions: decisionsOk,
      generate: { promptFeedback: { blockReason: "SAFETY" } },
    });
    await expectAiError(analyzeBrief(sampleBrief, { config: testAiConfig, fetchFn }), "blocked");
  });

  test("times out when Gemini does not answer", async () => {
    const hang: FetchFn = (_url, init) =>
      new Promise((_resolve, reject) => {
        init.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
      });
    await expectAiError(analyzeBrief(sampleBrief, { config: testAiConfig, fetchFn: hang }), "timeout");
  });
});

describe("readPriority", () => {
  const answer = (score: number) => ({
    type: "score" as const,
    score,
    probabilities: { "0": 0.4, "1": 0.2, "2": 0.4 },
    confidence: 0.4,
  });

  test("rounds the expected score to the nearest level", () => {
    expect(readPriority(answer(0.2)).priority).toBe("Low");
    expect(readPriority(answer(1.0)).priority).toBe("Medium");
    expect(readPriority(answer(1.6)).priority).toBe("High");
  });

  test("clamps scores outside the rubric", () => {
    expect(readPriority(answer(-1)).priority).toBe("Low");
    expect(readPriority(answer(5)).priority).toBe("High");
  });
});

describe("parseJsonText", () => {
  test("accepts JSON inside a markdown fence", () => {
    expect(parseJsonText('```json\n{"a":1}\n```')).toEqual({ a: 1 });
  });
});

describe("draftReplyEmail", () => {
  test("returns a validated draft", async () => {
    const draft = { subject: "Terima kasih atas brief Anda", body: "Halo Sari, ..." };
    const fetchFn = fakeGemini({ generate: generateOk(draft) });
    const result = await draftReplyEmail(sampleBrief, null, { config: testAiConfig, fetchFn });
    expect(result).toEqual(draft);
  });

  test("rejects a draft without a subject", async () => {
    const fetchFn = fakeGemini({ generate: generateOk({ body: "Halo" }) });
    await expectAiError(draftReplyEmail(sampleBrief, null, { config: testAiConfig, fetchFn }), "invalid_output");
  });
});
