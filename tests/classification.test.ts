import { describe, expect, it } from "vitest";
import { classifyMarket } from "@/lib/services/classification";

describe("MarketClassificationService — Arab-48 engine", () => {
  it("1) Arabic name + Hebrew bio + Israeli (Arab-majority) city => ARAB_48", () => {
    const result = classifyMarket({
      name: "د. أحمد أبو صالح",
      bio: "רופא שיניים | מרפאת שיניים אצלנו",
      city: "Nazareth",
      country: "Israel",
    });
    expect(result.market).toBe("ARAB_48");
    expect(result.confidence).toBeGreaterThanOrEqual(0.5);
    expect(result.signals.length).toBeGreaterThan(1);
  });

  it("2) Arabic name + Arabic bio + Israeli (Arab-majority) city => ARAB_48", () => {
    const result = classifyMarket({
      name: "د. أحمد أبو صالح",
      bio: "عيادة أسنان في الناصرة - فينير وتجميل الأسنان",
      city: "Nazareth",
      country: "Israel",
    });
    expect(result.market).toBe("ARAB_48");
    expect(result.confidence).toBeGreaterThanOrEqual(0.5);
  });

  it("3) Hebrew name + Hebrew bio + Israeli city (non Arab-majority) => ISRAELI_OTHER", () => {
    const result = classifyMarket({
      name: "דוד כהן",
      bio: "רופא שיניים בחיפה",
      city: "Haifa",
      country: "Israel",
    });
    expect(result.market).toBe("ISRAELI_OTHER");
  });

  it("4) Arabic name only (no bio, no location) => UNKNOWN, not auto Arab-48", () => {
    const result = classifyMarket({ name: "أحمد محمود" });
    expect(result.market).toBe("UNKNOWN");
    expect(result.signals).toEqual(["Arabic name"]);
  });

  it("5) Israeli location only (no name/bio) => UNKNOWN, not auto Arab-48", () => {
    const result = classifyMarket({ country: "Israel" });
    expect(result.market).toBe("UNKNOWN");
  });

  it("6) Arabic + Hebrew dental clinic name/bio + Arab-majority city => strong ARAB_48", () => {
    const result = classifyMarket({
      name: "عيادة أسنان الناصرة | מרפאת שיניים נצרת",
      bio: "طبيب أسنان | رופא שיניים - عيادة أسنان تجميل الأسنان",
      city: "Nazareth",
      country: "Israel",
    });
    expect(result.market).toBe("ARAB_48");
    expect(result.confidence).toBeGreaterThan(0.7);
  });

  it("9) Palestinian dentist (Arabic name/bio + Ramallah) => PALESTINIAN_TERRITORIES, not ARAB_48", () => {
    const result = classifyMarket({
      name: "د. ياسر خليل",
      bio: "طبيب أسنان في رام الله",
      city: "Ramallah",
      country: "Palestinian Territories",
    });
    expect(result.market).toBe("PALESTINIAN_TERRITORIES");
  });

  it("10) No usable signals => UNKNOWN with zero confidence", () => {
    const result = classifyMarket({});
    expect(result.market).toBe("UNKNOWN");
    expect(result.confidence).toBe(0);
    expect(result.signals).toEqual([]);
  });

  it("Gulf dentist (Arabic name/bio + Dubai) => GULF, not ARAB_48", () => {
    const result = classifyMarket({
      name: "د. سالم المري",
      bio: "طبيب أسنان تجميلي في دبي",
      city: "Dubai",
      country: "UAE",
    });
    expect(result.market).toBe("GULF");
  });

  it("never classifies ARAB_48 from a single weak signal even with high raw text volume", () => {
    const result = classifyMarket({
      name: "Ahmed",
      bio: "Ahmed Ahmed Ahmed Ahmed Ahmed Ahmed",
    });
    expect(result.market).not.toBe("ARAB_48");
  });
});
