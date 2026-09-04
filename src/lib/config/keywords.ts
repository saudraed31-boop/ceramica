export interface KeywordGroup {
  name: string;
  language: "ar" | "he" | "en" | "mixed";
  category: "dental" | "specialty" | "content" | "location";
  keywords: string[];
  active: boolean;
}

// Configurable keyword groups used by discovery search-string construction and by
// the classification/qualification heuristics. Stored here as the default seed —
// production should read these from the `keyword_groups` table so the marketing
// team can edit them without a deploy.
export const DEFAULT_KEYWORD_GROUPS: KeywordGroup[] = [
  {
    name: "Arabic dental terms",
    language: "ar",
    category: "dental",
    active: true,
    keywords: [
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
      "فينير الأسنان",
      "ابتسامة هوليود",
      "تركيبات الأسنان",
      "تلبيسات الأسنان",
    ],
  },
  {
    name: "Hebrew dental terms",
    language: "he",
    category: "dental",
    active: true,
    keywords: [
      "רופא שיניים",
      "רופאת שיניים",
      "רופא שיניים קוסמטי",
      "מרפאת שיניים",
      "רפואת שיניים",
      "שיקום הפה",
      "השתלות שיניים",
      "ציפויי שיניים",
      "הלבנת שיניים",
    ],
  },
  {
    name: "English dental / cosmetic terms",
    language: "en",
    category: "specialty",
    active: true,
    keywords: [
      "cosmetic dentist",
      "cosmetic dentistry",
      "prosthodontist",
      "restorative dentistry",
      "implant dentistry",
      "smile makeover",
      "veneers",
      "e-max",
      "emax",
      "digital smile design",
      "full mouth rehabilitation",
      "crowns",
      "hollywood smile",
    ],
  },
];

export function allKeywords(groups: KeywordGroup[] = DEFAULT_KEYWORD_GROUPS): string[] {
  return groups.filter((g) => g.active).flatMap((g) => g.keywords);
}
