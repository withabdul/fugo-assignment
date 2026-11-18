import type { FetchFn } from "../src/ai/gemini";
import type { AiConfig } from "../src/env";
import type { BriefForAi } from "../src/ai/prompts";

export const testAiConfig: AiConfig = {
  apiKey: "test-key",
  textModel: "gemini-4-hydrogen",
  decisionModel: "gemini-decision-1",
  timeoutMs: 200,
};

export const sampleBrief: BriefForAi = {
  name: "Sari",
  email: "sari@example.com",
  company: "Kopi Senja",
  need: "Kami butuh website company profile dengan katalog menu dan halaman reservasi.",
  budgetRange: "25m_50m",
  targetDate: "2027-02-01",
};

export const decisionsOk = {
  answers: {
    service_category: {
      type: "choice",
      choice: "Website",
      probabilities: { Website: 0.9, Branding: 0.05, Lainnya: 0.05 },
      confidence: 0.9,
    },
    priority: {
      type: "score",
      score: 1.8,
      legend: { "0": "Low", "1": "Medium", "2": "High" },
      probabilities: { "0": 0.05, "1": 0.1, "2": 0.85 },
      confidence: 0.85,
    },
  },
  usage: { total_input_tokens: 300, total_output_tokens: 0, total_tokens: 300 },
};

export function generateOk(payload: unknown) {
  return {
    candidates: [
      {
        content: {
          parts: [
            { text: "thinking...", thought: true },
            { text: typeof payload === "string" ? payload : JSON.stringify(payload) },
          ],
        },
        finishReason: "STOP",
      },
    ],
  };
}

export const analysisOk = {
  summary: "Kopi Senja butuh website company profile dengan katalog menu dan reservasi.",
  priority_reason: "Kebutuhan jelas, budget sesuai, dan timeline realistis.",
  missing_info: ["Jumlah halaman", "Apakah sudah punya domain"],
};

// Answers by URL: /decisions goes to the Decisions API, anything else to generateContent.
export function fakeGemini(responses: { decisions?: unknown; generate?: unknown; status?: number }): FetchFn {
  return async (url) => {
    const body = url.endsWith("/decisions") ? responses.decisions : responses.generate;
    return new Response(JSON.stringify(body), {
      status: responses.status ?? 200,
      headers: { "content-type": "application/json" },
    });
  };
}

export function futureDate(days: number): string {
  return new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);
}
