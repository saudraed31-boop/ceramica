// Centralized, configurable lead-scoring rules (master spec section 18).
// Keep ALL scoring numbers here — nothing scattered elsewhere in the codebase.

export const SCORING_VERSION = "v1";

export const SPECIALTY_SCORES: Record<string, number> = {
  cosmetic_dentistry: 30,
  prosthodontics: 30,
  restorative_dentistry: 25,
  implant_dentistry: 20,
  general_dentistry: 10,
};

export const CONTENT_SCORES: Record<string, number> = {
  veneers: 15,
  smile_makeover: 15,
  crowns_restorations: 10,
  full_mouth_rehabilitation: 10,
  digital_smile_design: 10,
  emax_ceramic: 10,
};

export const AUDIENCE_THRESHOLDS: { min: number; score: number }[] = [
  { min: 10000, score: 15 },
  { min: 5000, score: 10 },
  { min: 1000, score: 5 },
];

export const BUSINESS_SIGNAL_SCORES = {
  website: 5,
  clinicIdentified: 5,
  publicBusinessEmail: 5,
  activeAccount: 5,
};

export const TARGET_MARKET_SCORES = {
  strongArab48: 15, // confidence >= 0.7
  moderateArab48: 8, // confidence >= 0.4
};

export const NEGATIVE_SCORES = {
  dentalStudent: -30,
  dentalLaboratory: -40,
  dentalSupplier: -40,
  inactive: -15,
  clearlyUnrelated: -100,
};

export const TEMPERATURE_THRESHOLDS: { min: number; temperature: string }[] = [
  { min: 80, temperature: "HOT" },
  { min: 60, temperature: "WARM" },
  { min: 40, temperature: "QUALIFIED" },
  { min: 0, temperature: "LOW" },
];
