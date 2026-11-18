import { briefInputSchema, todayInJakarta } from "@fugo/shared";
import { describe, expect, test } from "bun:test";
import { futureDate } from "./helpers";

const valid = {
  name: "Sari",
  email: "Sari@Example.com ",
  company: "Kopi Senja",
  need: "Website company profile dengan katalog menu.",
  budget_range: "25m_50m",
  target_date: futureDate(30),
};

describe("briefInputSchema", () => {
  test("accepts a valid brief and normalizes the email", () => {
    const parsed = briefInputSchema.parse(valid);
    expect(parsed.email).toBe("sari@example.com");
  });

  test("accepts today as the target date", () => {
    expect(briefInputSchema.safeParse({ ...valid, target_date: todayInJakarta() }).success).toBe(true);
  });

  test("rejects a date in the past", () => {
    const result = briefInputSchema.safeParse({ ...valid, target_date: "2020-01-01" });
    expect(result.success).toBe(false);
  });

  test("rejects a bad email and an unknown budget", () => {
    const result = briefInputSchema.safeParse({ ...valid, email: "not-an-email", budget_range: "1b" });
    expect(result.success).toBe(false);
    const paths = result.error?.issues.map((issue) => issue.path[0]);
    expect(paths).toContain("email");
    expect(paths).toContain("budget_range");
  });

  test("rejects empty required fields", () => {
    const result = briefInputSchema.safeParse({ ...valid, name: "  ", company: "" });
    expect(result.success).toBe(false);
  });
});

describe("todayInJakarta", () => {
  test("uses the WIB date, not the UTC date", () => {
    // 18:00 UTC on 18 Nov is 01:00 WIB on 19 Nov.
    expect(todayInJakarta(new Date("2026-11-18T18:00:00Z"))).toBe("2026-11-19");
  });
});
