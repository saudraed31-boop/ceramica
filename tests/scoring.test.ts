import { describe, expect, it } from "vitest";
import { scoreLead, temperatureForScore } from "@/lib/services/scoring";

describe("Lead scoring engine", () => {
  it("scores a high-value cosmetic dentist as HOT", () => {
    const result = scoreLead({
      specialty: "cosmetic_dentistry",
      contentTags: ["veneers", "smile_makeover", "emax_ceramic"],
      followersCount: 12000,
      hasWebsite: true,
      clinicIdentified: true,
      hasPublicBusinessEmail: true,
      isActiveAccount: true,
      targetMarket: "ARAB_48",
      targetMarketConfidence: 0.9,
    });
    // 30 + (15+15+10) + 15 + (5+5+5+5) + 15 = 120
    expect(result.totalScore).toBe(120);
    expect(result.temperature).toBe("HOT");
  });

  it("gives moderate Arab-48 bonus below strong-confidence threshold", () => {
    const result = scoreLead({
      specialty: "general_dentistry",
      followersCount: 1200,
      targetMarket: "ARAB_48",
      targetMarketConfidence: 0.5,
    });
    // 10 + 5 (audience) + 8 (moderate market) = 23
    expect(result.totalScore).toBe(23);
    expect(result.temperature).toBe("LOW");
  });

  it("gives zero target-market bonus for non Arab-48 markets", () => {
    const result = scoreLead({
      specialty: "implant_dentistry",
      targetMarket: "GULF",
      targetMarketConfidence: 0.95,
    });
    expect(result.breakdown.targetMarket).toBe(0);
  });

  it("applies negative scores for dental labs and disqualifies them", () => {
    const result = scoreLead({
      specialty: "general_dentistry",
      negativeFlags: { dentalLaboratory: true },
    });
    // 10 - 40 = -30
    expect(result.totalScore).toBe(-30);
    expect(result.temperature).toBe("DISQUALIFIED");
  });

  it("clearly unrelated accounts are always disqualified regardless of other signals", () => {
    const result = scoreLead({
      specialty: "cosmetic_dentistry",
      followersCount: 50000,
      negativeFlags: { clearlyUnrelated: true },
    });
    expect(result.totalScore).toBeLessThan(0);
    expect(result.temperature).toBe("DISQUALIFIED");
  });

  it.each([
    [85, "HOT"],
    [65, "WARM"],
    [45, "QUALIFIED"],
    [10, "LOW"],
    [-5, "DISQUALIFIED"],
  ])("temperature for score %i is %s", (score, expected) => {
    expect(temperatureForScore(score)).toBe(expected);
  });
});
