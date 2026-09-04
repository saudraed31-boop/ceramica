import {
  AUDIENCE_THRESHOLDS,
  BUSINESS_SIGNAL_SCORES,
  CONTENT_SCORES,
  NEGATIVE_SCORES,
  SCORING_VERSION,
  SPECIALTY_SCORES,
  TARGET_MARKET_SCORES,
  TEMPERATURE_THRESHOLDS,
} from "@/lib/config/scoring";
import type { LeadTemperature, Market, ScoreBreakdown, ScoringResult } from "@/lib/types";

export interface ScoringInput {
  specialty?: string | null;
  contentTags?: string[];
  followersCount?: number | null;
  hasWebsite?: boolean;
  clinicIdentified?: boolean;
  hasPublicBusinessEmail?: boolean;
  isActiveAccount?: boolean;
  targetMarket?: Market | null;
  targetMarketConfidence?: number;
  negativeFlags?: {
    dentalStudent?: boolean;
    dentalLaboratory?: boolean;
    dentalSupplier?: boolean;
    inactive?: boolean;
    clearlyUnrelated?: boolean;
  };
}

function specialtyKey(specialty?: string | null): string | null {
  if (!specialty) return null;
  return specialty.toLowerCase().replace(/[\s-]+/g, "_");
}

function scoreSpecialty(specialty?: string | null): number {
  const key = specialtyKey(specialty);
  if (!key) return 0;
  return SPECIALTY_SCORES[key] ?? 0;
}

function scoreContent(tags: string[] = []): number {
  return tags.reduce((sum, tag) => {
    const key = tag.toLowerCase().replace(/[\s-]+/g, "_");
    return sum + (CONTENT_SCORES[key] ?? 0);
  }, 0);
}

function scoreAudience(followersCount?: number | null): number {
  if (!followersCount) return 0;
  const tier = AUDIENCE_THRESHOLDS.find((t) => followersCount >= t.min);
  return tier?.score ?? 0;
}

function scoreBusiness(input: ScoringInput): number {
  let score = 0;
  if (input.hasWebsite) score += BUSINESS_SIGNAL_SCORES.website;
  if (input.clinicIdentified) score += BUSINESS_SIGNAL_SCORES.clinicIdentified;
  if (input.hasPublicBusinessEmail) score += BUSINESS_SIGNAL_SCORES.publicBusinessEmail;
  if (input.isActiveAccount) score += BUSINESS_SIGNAL_SCORES.activeAccount;
  return score;
}

function scoreTargetMarket(market?: Market | null, confidence = 0): number {
  if (market !== "ARAB_48") return 0;
  if (confidence >= 0.7) return TARGET_MARKET_SCORES.strongArab48;
  if (confidence >= 0.4) return TARGET_MARKET_SCORES.moderateArab48;
  return 0;
}

function scoreNegative(flags: ScoringInput["negativeFlags"]): number {
  if (!flags) return 0;
  let score = 0;
  if (flags.dentalStudent) score += NEGATIVE_SCORES.dentalStudent;
  if (flags.dentalLaboratory) score += NEGATIVE_SCORES.dentalLaboratory;
  if (flags.dentalSupplier) score += NEGATIVE_SCORES.dentalSupplier;
  if (flags.inactive) score += NEGATIVE_SCORES.inactive;
  if (flags.clearlyUnrelated) score += NEGATIVE_SCORES.clearlyUnrelated;
  return score;
}

export function temperatureForScore(score: number): LeadTemperature {
  if (score < 0) return "DISQUALIFIED";
  const tier = TEMPERATURE_THRESHOLDS.find((t) => score >= t.min);
  return (tier?.temperature as LeadTemperature) ?? "LOW";
}

export function scoreLead(input: ScoringInput): ScoringResult {
  const breakdown: ScoreBreakdown = {
    specialty: scoreSpecialty(input.specialty),
    content: scoreContent(input.contentTags),
    audience: scoreAudience(input.followersCount),
    business: scoreBusiness(input),
    targetMarket: scoreTargetMarket(input.targetMarket, input.targetMarketConfidence),
    negative: scoreNegative(input.negativeFlags),
  };

  const totalScore =
    breakdown.specialty +
    breakdown.content +
    breakdown.audience +
    breakdown.business +
    breakdown.targetMarket +
    breakdown.negative;

  return {
    totalScore,
    breakdown,
    temperature: temperatureForScore(totalScore),
    version: SCORING_VERSION,
  };
}
