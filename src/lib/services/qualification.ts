import type { QualificationResult } from "@/lib/types";

// ============================================================
// Lead Qualification Service
// ============================================================
//
// Server-side only. `HeuristicQualificationService` is a deterministic,
// keyword-driven implementation used during the mock-data phases (and as a
// safe fallback) so the whole pipeline can be built and tested before any
// paid AI provider is wired in. A future `AiQualificationService` can
// implement the same `LeadQualificationService` interface, calling an LLM
// with a versioned prompt — callers (the job worker) do not need to change.

export interface QualificationInput {
  name?: string | null;
  bio?: string | null;
  location?: string | null;
  language?: string | null;
  website?: string | null;
  followersCount?: number | null;
  postsCount?: number | null;
  lastActivityDaysAgo?: number | null;
}

export interface LeadQualificationService {
  readonly provider: string;
  readonly promptVersion: string;
  qualify(input: QualificationInput): Promise<QualificationResult>;
}

const NOT_A_LEAD_TERMS: Record<string, string[]> = {
  dental_student: ["dental student", "dentistry student", "طالب طب أسنان", "طالبة طب أسنان", "student dentist"],
  dental_laboratory: ["dental lab", "dental laboratory", "ceramic lab", "مختبر أسنان", "معمل أسنان"],
  dental_supplier: ["dental supply", "dental equipment", "dental distributor", "dental materials", "مستلزمات طب الأسنان"],
};

const SPECIALTY_TERMS: { specialty: string; terms: string[] }[] = [
  { specialty: "cosmetic_dentistry", terms: ["cosmetic dentist", "cosmetic dentistry", "smile makeover", "hollywood smile", "ابتسامة هوليود", "تجميل الأسنان"] },
  { specialty: "prosthodontics", terms: ["prosthodontist", "prosthodontics", "تركيبات الأسنان"] },
  { specialty: "restorative_dentistry", terms: ["restorative dentistry", "restorative dentist"] },
  { specialty: "implant_dentistry", terms: ["implant dentistry", "implantologist", "زراعة الأسنان", "השתלות שיניים"] },
  { specialty: "general_dentistry", terms: ["general dentist", "general dentistry", "طبيب أسنان عام"] },
];

const SERVICE_TERMS: Record<string, string[]> = {
  veneers: ["veneer", "veneers", "فينير", "ציפויי שיניים"],
  smile_makeover: ["smile makeover", "ابتسامة هوليود"],
  crowns_restorations: ["crown", "crowns", "تركيبات الأسنان", "تلبيسات الأسنان"],
  full_mouth_rehabilitation: ["full mouth rehabilitation", "full-mouth rehabilitation", "שיקום הפה"],
  digital_smile_design: ["digital smile design", "dsd"],
  emax_ceramic: ["e-max", "emax", "e.max", "ceramic restoration"],
};

const DENTIST_SIGNAL_TERMS = [
  "dentist",
  "dds",
  "dmd",
  "dr.",
  "doctor",
  "طبيب أسنان",
  "طبيبة أسنان",
  "دكتور أسنان",
  "دكتورة أسنان",
  "רופא שיניים",
  "רופאת שיניים",
];

const CLINIC_SIGNAL_TERMS = [
  "clinic",
  "dental center",
  "dental centre",
  "practice",
  "عيادة أسنان",
  "عيادة اسنان",
  "מרפאת שיניים",
];

const DENTAL_ADJACENT_PATTERN = /\bdent|\btooth|\bteeth|\bsmile|\boral\b|أسنان|שיניים/i;

function textIncludesAny(text: string, terms: string[]): string[] {
  const lower = text.toLowerCase();
  return terms.filter((term) => text.includes(term) || lower.includes(term.toLowerCase()));
}

export class HeuristicQualificationService implements LeadQualificationService {
  readonly provider = "heuristic-v1";
  readonly promptVersion = "n/a";

  async qualify(input: QualificationInput): Promise<QualificationResult> {
    const combined = [input.name, input.bio].filter(Boolean).join(" \n ");

    const redFlags: string[] = [];
    let lead_type: QualificationResult["lead_type"] = "unknown";
    let qualification_status: QualificationResult["qualification_status"] = "possible_lead";

    for (const [flag, terms] of Object.entries(NOT_A_LEAD_TERMS)) {
      if (textIncludesAny(combined, terms).length > 0) {
        redFlags.push(flag);
      }
    }

    const isInactive =
      (input.lastActivityDaysAgo ?? 0) > 180 || (input.postsCount !== null && input.postsCount === 0);
    if (isInactive) redFlags.push("inactive_account");

    const dentistSignals = textIncludesAny(combined, DENTIST_SIGNAL_TERMS);
    const clinicSignals = textIncludesAny(combined, CLINIC_SIGNAL_TERMS);
    const is_dentist = dentistSignals.length > 0 && redFlags.length === 0;
    const is_clinic = clinicSignals.length > 0 && redFlags.length === 0;
    const hasAnyDentalAdjacentTerm = DENTAL_ADJACENT_PATTERN.test(combined);
    if (!hasAnyDentalAdjacentTerm && !is_dentist && !is_clinic) {
      redFlags.push("clearly_unrelated");
    }

    if (
      redFlags.includes("dental_laboratory") ||
      redFlags.includes("dental_supplier") ||
      redFlags.includes("dental_student") ||
      redFlags.includes("clearly_unrelated")
    ) {
      lead_type = "not_a_lead";
      qualification_status = "not_a_lead";
    } else if (!is_dentist && !is_clinic) {
      lead_type = "unknown";
      qualification_status = "possible_lead";
    } else {
      lead_type = is_dentist ? "dentist" : "clinic";
      qualification_status = "qualified";
    }

    let specialty: string | null = null;
    for (const entry of SPECIALTY_TERMS) {
      if (textIncludesAny(combined, entry.terms).length > 0) {
        specialty = entry.specialty;
        break;
      }
    }
    if (!specialty && qualification_status !== "not_a_lead") {
      specialty = "general_dentistry";
    }

    const relevant_services = Object.entries(SERVICE_TERMS)
      .filter(([, terms]) => textIncludesAny(combined, terms).length > 0)
      .map(([service]) => service);

    const highValueContentCount = relevant_services.length;
    const hasStrongAudience = (input.followersCount ?? 0) >= 5000;
    if (
      qualification_status === "qualified" &&
      specialty &&
      specialty !== "general_dentistry" &&
      highValueContentCount >= 1 &&
      (hasStrongAudience || Boolean(input.website))
    ) {
      qualification_status = "high_value";
    }

    const confidence = qualification_status === "not_a_lead" ? 0.9 : is_dentist || is_clinic ? 0.75 : 0.35;

    const reasonParts: string[] = [];
    if (qualification_status === "not_a_lead") {
      reasonParts.push(`Account appears to be a ${redFlags.join(", ").replace(/_/g, " ")}, not a prospective lab client.`);
    } else if (qualification_status === "high_value") {
      reasonParts.push(
        `Dentistry/clinic account with a ${specialty?.replace(/_/g, " ")} focus, active patient-facing content (${relevant_services.join(", ")}), and a meaningful audience or web presence.`,
      );
    } else if (qualification_status === "qualified") {
      reasonParts.push(`Appears to be a ${lead_type} with a ${specialty?.replace(/_/g, " ") ?? "general"} focus.`);
    } else {
      reasonParts.push("Insufficient information to confirm this is a dentist or clinic.");
    }

    return {
      is_dentist,
      is_clinic,
      specialty,
      target_market: null,
      confidence,
      relevant_services,
      qualification_reason: reasonParts.join(" "),
      red_flags: redFlags,
      qualification_status,
      lead_type,
    };
  }
}

export const defaultQualificationService: LeadQualificationService = new HeuristicQualificationService();
