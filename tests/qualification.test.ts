import { describe, expect, it } from "vitest";
import { HeuristicQualificationService } from "@/lib/services/qualification";

const service = new HeuristicQualificationService();

describe("LeadQualificationService (heuristic)", () => {
  it("7) classifies a dental student as NOT A LEAD", async () => {
    const result = await service.qualify({
      name: "Sara K.",
      bio: "3rd year dental student | future cosmetic dentist",
    });
    expect(result.qualification_status).toBe("not_a_lead");
    expect(result.lead_type).toBe("not_a_lead");
    expect(result.red_flags).toContain("dental_student");
  });

  it("8) classifies a dental laboratory as NOT A LEAD", async () => {
    const result = await service.qualify({
      name: "Precision Dental Laboratory",
      bio: "Full-service dental lab producing crowns and veneers for clinics",
    });
    expect(result.qualification_status).toBe("not_a_lead");
    expect(result.red_flags).toContain("dental_laboratory");
  });

  it("classifies a dental supplier as NOT A LEAD", async () => {
    const result = await service.qualify({
      name: "GulfDent Supplies",
      bio: "Dental equipment and materials distributor across the GCC",
    });
    expect(result.qualification_status).toBe("not_a_lead");
    expect(result.red_flags).toContain("dental_supplier");
  });

  it("classifies a cosmetic dentist with veneer content as HIGH_VALUE", async () => {
    const result = await service.qualify({
      name: "Dr. Lina Haddad",
      bio: "Cosmetic dentist | veneers, smile makeover, e-max ceramics",
      website: "https://example-clinic.com",
      followersCount: 8000,
    });
    expect(result.is_dentist).toBe(true);
    expect(result.specialty).toBe("cosmetic_dentistry");
    expect(result.qualification_status).toBe("high_value");
    expect(result.relevant_services).toEqual(
      expect.arrayContaining(["veneers", "smile_makeover", "emax_ceramic"]),
    );
  });

  it("classifies a general dentist with no standout content as QUALIFIED, not high value", async () => {
    const result = await service.qualify({
      name: "Dr. John Smith",
      bio: "General dentist serving families",
      followersCount: 500,
    });
    expect(result.qualification_status).toBe("qualified");
  });

  it("classifies a clearly unrelated account (no dental-adjacent terms at all) as NOT A LEAD", async () => {
    const result = await service.qualify({
      name: "Traveler Blog",
      bio: "Exploring the world one city at a time",
    });
    expect(result.qualification_status).toBe("not_a_lead");
    expect(result.red_flags).toContain("clearly_unrelated");
  });

  it("classifies an ambiguous account with a weak dental-adjacent hint as possible_lead", async () => {
    const result = await service.qualify({
      name: "Bright Smile Studio",
      bio: "Making people feel good about themselves",
    });
    expect(result.qualification_status).toBe("possible_lead");
    expect(result.lead_type).toBe("unknown");
  });

  it("flags a long-inactive account", async () => {
    const result = await service.qualify({
      name: "Dr. Old Account",
      bio: "Dentist",
      lastActivityDaysAgo: 400,
    });
    expect(result.red_flags).toContain("inactive_account");
  });
});
