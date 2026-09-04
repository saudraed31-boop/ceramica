import { DEFAULT_TARGET_LOCATIONS, findLocationInText, type TargetLocation } from "@/lib/config/locations";
import type { Market, MarketClassificationResult } from "@/lib/types";

// ============================================================
// Arab-48 Market Classification Engine
// ============================================================
//
// Classifies a discovered account into one of the Market buckets using multiple
// independent, legitimate public signals (name script, bio language, location).
// Design rules (see master spec section 3 & 17):
//   - Never classify from a single weak signal (e.g. an Arabic-looking name alone).
//   - Combine signals; report which ones fired and why.
//   - UNKNOWN is a valid, expected outcome when evidence is insufficient.

export interface ClassificationInput {
  name?: string | null;
  bio?: string | null;
  language?: string | null;
  languages?: string[] | null;
  country?: string | null;
  city?: string | null;
  captions?: string[] | null;
}

const ARABIC_RANGE = /[؀-ۿݐ-ݿ]/;
const HEBREW_RANGE = /[֐-׿]/;

function scriptRatio(text: string, range: RegExp): number {
  const letters = text.replace(/[^\p{L}]/gu, "");
  if (letters.length === 0) return 0;
  let matches = 0;
  for (const ch of letters) {
    if (range.test(ch)) matches++;
  }
  return matches / letters.length;
}

function hasArabicScript(text: string): boolean {
  return scriptRatio(text, ARABIC_RANGE) > 0.2;
}

function hasHebrewScript(text: string): boolean {
  return scriptRatio(text, HEBREW_RANGE) > 0.2;
}

const ARABIC_DENTAL_TERMS = [
  "طبيب أسنان",
  "طبيبة أسنان",
  "دكتور أسنان",
  "دكتورة أسنان",
  "عيادة أسنان",
  "عيادة اسنان",
  "طب الأسنان",
  "تجميل الأسنان",
  "زراعة الأسنان",
  "تقويم الأسنان",
  "فينير",
  "ابتسامة هوليود",
  "تركيبات الأسنان",
  "تلبيسات الأسنان",
];

const HEBREW_DENTAL_TERMS = [
  "רופא שיניים",
  "רופאת שיניים",
  "מרפאת שיניים",
  "רפואת שיניים",
  "שיקום הפה",
  "השתלות שיניים",
  "ציפויי שיניים",
  "הלבנת שיניים",
];

function containsAny(text: string, terms: string[]): boolean {
  return terms.some((term) => text.includes(term));
}

interface Signal {
  id: string;
  label: string;
  weight: number;
}

export function classifyMarket(input: ClassificationInput): MarketClassificationResult {
  const name = (input.name ?? "").trim();
  const bio = (input.bio ?? "").trim();
  const captionsText = (input.captions ?? []).join(" ").trim();
  const combinedText = [bio, captionsText].filter(Boolean).join(" ");
  const country = (input.country ?? "").trim();
  const city = (input.city ?? "").trim();

  const signals: Signal[] = [];

  const nameHasArabic = name.length > 0 && hasArabicScript(name);
  const nameHasHebrew = name.length > 0 && hasHebrewScript(name);
  if (nameHasArabic) signals.push({ id: "name_arabic", label: "Arabic name", weight: 0.2 });
  if (nameHasHebrew) signals.push({ id: "name_hebrew", label: "Hebrew name", weight: 0.1 });

  const bioHasArabic = bio.length > 0 && hasArabicScript(bio);
  const bioHasHebrew = bio.length > 0 && hasHebrewScript(bio);
  if (bioHasArabic && bioHasHebrew) {
    signals.push({ id: "bio_ar_he", label: "Arabic + Hebrew bio", weight: 0.35 });
  } else if (bioHasArabic) {
    signals.push({ id: "bio_arabic", label: "Arabic bio", weight: 0.2 });
  } else if (bioHasHebrew) {
    signals.push({ id: "bio_hebrew", label: "Hebrew bio", weight: 0.1 });
  }

  const hasArabicDentalTerm = containsAny(combinedText, ARABIC_DENTAL_TERMS);
  const hasHebrewDentalTerm = containsAny(combinedText, HEBREW_DENTAL_TERMS);
  if (hasArabicDentalTerm) {
    signals.push({ id: "arabic_dental_terms", label: "Arabic dental terminology", weight: 0.15 });
  }
  if (hasHebrewDentalTerm) {
    signals.push({ id: "hebrew_dental_terms", label: "Hebrew dental terminology", weight: 0.08 });
  }

  // Location signal — resolved against the configurable target-location database.
  let matchedLocation: TargetLocation | undefined;
  if (city) matchedLocation = findLocationInText(city) ?? matchedLocation;
  if (!matchedLocation && country) matchedLocation = findLocationInText(country);
  if (!matchedLocation && combinedText) matchedLocation = findLocationInText(combinedText);

  const isIsraeliLocation =
    matchedLocation?.country === "Israel" ||
    /israel/i.test(country) ||
    /israel/i.test(city);
  const isArabMajorityCity = matchedLocation?.targetMarket === "ARAB_48";

  if (isArabMajorityCity) {
    signals.push({ id: "location_arab_majority", label: `Arab-majority Israeli city (${matchedLocation!.name})`, weight: 0.3 });
  } else if (isIsraeliLocation) {
    signals.push({ id: "location_israeli", label: "Israeli location", weight: 0.1 });
  }

  const languages = new Set(
    [input.language, ...(input.languages ?? [])].filter(Boolean).map((l) => String(l).toLowerCase()),
  );
  if (languages.has("ar") || languages.has("arabic")) {
    signals.push({ id: "declared_language_arabic", label: "Declared language: Arabic", weight: 0.1 });
  }

  const totalWeight = signals.reduce((sum, s) => sum + s.weight, 0);
  const confidence = Math.min(1, Math.round(totalWeight * 100) / 100);

  const strongIdentitySignal = nameHasArabic || bioHasArabic || hasArabicDentalTerm;
  const strongCombination = strongIdentitySignal && (isIsraeliLocation || bioHasHebrew || hasHebrewDentalTerm);

  let market: Market = "UNKNOWN";
  let reason: string;

  if (strongCombination && isArabMajorityCity && confidence >= 0.5) {
    market = "ARAB_48";
    reason =
      "Strong combination of Arabic identity/language signals and an Arab-majority Israeli location.";
  } else if (strongCombination && isIsraeliLocation && confidence >= 0.45) {
    market = "ARAB_48";
    reason = "Strong combination of Arabic identity/language signals and Israeli location.";
  } else if (isIsraeliLocation && !strongIdentitySignal && (nameHasHebrew || bioHasHebrew)) {
    market = "ISRAELI_OTHER";
    reason = "Hebrew-only identity/language signals with an Israeli location and no Arabic signals.";
  } else if (isIsraeliLocation && confidence < 0.45) {
    market = "UNKNOWN";
    reason =
      "Israeli location detected, but identity/language signals are too weak on their own to determine the market.";
  } else if (matchedLocation?.targetMarket === "PALESTINIAN_TERRITORIES") {
    market = "PALESTINIAN_TERRITORIES";
    reason = "Location matches the Palestinian Territories.";
    signals.push({ id: "location_palestinian_territories", label: "Palestinian Territories location", weight: 0 });
  } else if (matchedLocation?.targetMarket === "GULF") {
    market = "GULF";
    reason = "Location matches a Gulf market.";
    signals.push({ id: "location_gulf", label: "Gulf location", weight: 0 });
  } else if (matchedLocation?.targetMarket === "JORDAN") {
    market = "JORDAN";
    reason = "Location matches Jordan.";
    signals.push({ id: "location_jordan", label: "Jordan location", weight: 0 });
  } else if (matchedLocation?.targetMarket === "IRAQ") {
    market = "IRAQ";
    reason = "Location matches Iraq.";
    signals.push({ id: "location_iraq", label: "Iraq location", weight: 0 });
  } else if (matchedLocation && country) {
    market = "OTHER";
    reason = `Location (${matchedLocation.name}) does not match a currently configured priority market.`;
  } else if (nameHasArabic && signals.length === 1) {
    // Explicitly the "single weak signal" case from the spec — never classify.
    market = "UNKNOWN";
    reason = "Only a single weak signal (Arabic-looking name) was found; insufficient to classify.";
  } else {
    market = "UNKNOWN";
    reason = "Insufficient public signals to confidently classify this account's target market.";
  }

  return {
    market,
    confidence: market === "UNKNOWN" ? Math.min(confidence, 0.44) : confidence,
    signals: signals.filter((s) => s.weight > 0).map((s) => s.label),
    reason,
  };
}

export function listConfiguredLocations(): TargetLocation[] {
  return DEFAULT_TARGET_LOCATIONS;
}
