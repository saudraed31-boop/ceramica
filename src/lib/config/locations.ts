export interface TargetLocation {
  name: string;
  country: string;
  arabicName?: string;
  hebrewName?: string;
  targetMarket: string;
  active: boolean;
}

// Configurable seed list of localities with a significant Arab population inside
// Israel. Location is only ONE signal among several used by the classification
// engine — it must never be treated as a determination of ethnicity on its own.
export const DEFAULT_TARGET_LOCATIONS: TargetLocation[] = [
  { name: "Nazareth", country: "Israel", arabicName: "الناصرة", hebrewName: "נצרת", targetMarket: "ARAB_48", active: true },
  { name: "Umm al-Fahm", country: "Israel", arabicName: "أم الفحم", hebrewName: "אום אל-פחם", targetMarket: "ARAB_48", active: true },
  { name: "Sakhnin", country: "Israel", arabicName: "سخنين", hebrewName: "סח'נין", targetMarket: "ARAB_48", active: true },
  { name: "Shafa-'Amr", country: "Israel", arabicName: "شفاعمرو", hebrewName: "שפרעם", targetMarket: "ARAB_48", active: true },
  { name: "Acre", country: "Israel", arabicName: "عكا", hebrewName: "עכו", targetMarket: "ARAB_48", active: true },
  { name: "Kafr Qasim", country: "Israel", arabicName: "كفر قاسم", hebrewName: "כפר קאסם", targetMarket: "ARAB_48", active: true },
  { name: "Tamra", country: "Israel", arabicName: "طمرة", hebrewName: "טמרה", targetMarket: "ARAB_48", active: true },
  { name: "Arraba", country: "Israel", arabicName: "عرابة", hebrewName: "עראבה", targetMarket: "ARAB_48", active: true },
  { name: "Baqa al-Gharbiyye", country: "Israel", arabicName: "باقة الغربية", hebrewName: "באקה אל-גרבייה", targetMarket: "ARAB_48", active: true },
  { name: "Tira", country: "Israel", arabicName: "الطيرة", hebrewName: "טירה", targetMarket: "ARAB_48", active: true },
  { name: "Rahat", country: "Israel", arabicName: "رهط", hebrewName: "רהט", targetMarket: "ARAB_48", active: true },
  { name: "Haifa", country: "Israel", arabicName: "حيفا", hebrewName: "חיפה", targetMarket: "ISRAELI_OTHER", active: true },
  { name: "Jaffa", country: "Israel", arabicName: "يافا", hebrewName: "יפו", targetMarket: "ISRAELI_OTHER", active: true },
  { name: "Tel Aviv", country: "Israel", hebrewName: "תל אביב", targetMarket: "ISRAELI_OTHER", active: true },
  { name: "Jerusalem", country: "Israel", arabicName: "القدس", hebrewName: "ירושלים", targetMarket: "ISRAELI_OTHER", active: true },

  { name: "Ramallah", country: "Palestinian Territories", arabicName: "رام الله", targetMarket: "PALESTINIAN_TERRITORIES", active: true },
  { name: "Hebron", country: "Palestinian Territories", arabicName: "الخليل", targetMarket: "PALESTINIAN_TERRITORIES", active: true },
  { name: "Nablus", country: "Palestinian Territories", arabicName: "نابلس", targetMarket: "PALESTINIAN_TERRITORIES", active: true },
  { name: "Gaza", country: "Palestinian Territories", arabicName: "غزة", targetMarket: "PALESTINIAN_TERRITORIES", active: true },
  { name: "Bethlehem", country: "Palestinian Territories", arabicName: "بيت لحم", targetMarket: "PALESTINIAN_TERRITORIES", active: true },

  { name: "Dubai", country: "UAE", arabicName: "دبي", targetMarket: "GULF", active: true },
  { name: "Abu Dhabi", country: "UAE", arabicName: "أبوظبي", targetMarket: "GULF", active: true },
  { name: "Riyadh", country: "Saudi Arabia", arabicName: "الرياض", targetMarket: "GULF", active: true },
  { name: "Jeddah", country: "Saudi Arabia", arabicName: "جدة", targetMarket: "GULF", active: true },
  { name: "Doha", country: "Qatar", arabicName: "الدوحة", targetMarket: "GULF", active: true },
  { name: "Kuwait City", country: "Kuwait", arabicName: "مدينة الكويت", targetMarket: "GULF", active: true },
  { name: "Manama", country: "Bahrain", arabicName: "المنامة", targetMarket: "GULF", active: true },
  { name: "Muscat", country: "Oman", arabicName: "مسقط", targetMarket: "GULF", active: true },

  { name: "Amman", country: "Jordan", arabicName: "عمان", targetMarket: "JORDAN", active: true },
  { name: "Irbid", country: "Jordan", arabicName: "إربد", targetMarket: "JORDAN", active: true },

  { name: "Baghdad", country: "Iraq", arabicName: "بغداد", targetMarket: "IRAQ", active: true },
  { name: "Erbil", country: "Iraq", arabicName: "أربيل", targetMarket: "IRAQ", active: true },

  { name: "London", country: "United Kingdom", targetMarket: "OTHER", active: true },
  { name: "Toronto", country: "Canada", targetMarket: "OTHER", active: true },
  { name: "Sydney", country: "Australia", targetMarket: "OTHER", active: true },
];

export function findLocationByName(name: string): TargetLocation | undefined {
  const normalized = name.trim().toLowerCase();
  return DEFAULT_TARGET_LOCATIONS.find(
    (loc) =>
      loc.active &&
      (loc.name.toLowerCase() === normalized ||
        loc.arabicName === name.trim() ||
        loc.hebrewName === name.trim()),
  );
}

export function findLocationInText(text: string): TargetLocation | undefined {
  return DEFAULT_TARGET_LOCATIONS.find((loc) => {
    if (!loc.active) return false;
    return (
      textIncludes(text, loc.name) ||
      (loc.arabicName && textIncludes(text, loc.arabicName)) ||
      (loc.hebrewName && textIncludes(text, loc.hebrewName))
    );
  });
}

function textIncludes(haystack: string, needle: string): boolean {
  return haystack.toLowerCase().includes(needle.toLowerCase());
}
