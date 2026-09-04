import type { NormalizedAccount, SearchJobParameters } from "@/lib/types";
import {
  ProviderTransientError,
  type DiscoveryPage,
  type LeadDiscoveryProvider,
} from "@/lib/providers/types";

// ============================================================
// Mock Discovery Provider
// ============================================================
//
// Simulates a real, cursor-paginated social discovery source: hundreds of
// generated accounts, network delay, occasional transient failures, and
// duplicate accounts re-appearing across pages/searches — everything the
// job engine's checkpoint/retry/dedup logic needs to be built and tested
// against before any real provider is connected.
//
// Determinism: the account population for a given search is derived from a
// hash of its parameters (not the job id), so re-running the *same* search
// discovers the *same* accounts — exactly like re-scraping the same public
// profiles would. This is what makes the "same search twice must not create
// duplicate leads" test meaningful.

export interface MockProviderOptions {
  pageSize?: number;
  /** Simulated per-request network delay in ms. Set to 0 in fast test runs. */
  delayMs?: number;
  /** Probability (0-1) that any given page request throws a transient error. */
  failureRate?: number;
  /** Force a transient failure the first time these specific batch numbers (1-indexed) are requested. */
  forceFailOnceAtBatch?: number[];
  /** Force a transient failure on EVERY attempt at these batch numbers, for this provider instance's lifetime — simulates a persistent outage that only a fresh instance (e.g. a worker restart) recovers from. */
  forceFailAlwaysAtBatch?: number[];
  /** Override the deterministic total-account-count for a search (tests only — keeps runs fast). */
  totalOverride?: number;
}

interface CursorEnvelope {
  op: "search" | "followers";
  offset: number;
  seed: number;
  params?: SearchJobParameters;
  seedAccountId?: string;
}

const ARABIC_NAMES: [string, string][] = [
  ["أحمد", "أبو صالح"],
  ["محمد", "خطيب"],
  ["ياسر", "خليل"],
  ["سامر", "حسون"],
  ["ليلى", "حداد"],
  ["منى", "طه"],
  ["رنا", "عثمان"],
  ["كريم", "زيدان"],
  ["سلمى", "دراوشة"],
  ["وليد", "جبارين"],
];

const HEBREW_NAMES: [string, string][] = [
  ["דוד", "כהן"],
  ["מיכל", "לוי"],
  ["יוסי", "מזרחי"],
  ["נועה", "אברהם"],
  ["רון", "פרץ"],
];

const GULF_NAMES: [string, string][] = [
  ["سالم", "المري"],
  ["فاطمة", "النعيمي"],
  ["خالد", "السويدي"],
];

const GENERIC_NAMES: [string, string][] = [
  ["John", "Smith"],
  ["Emma", "Wilson"],
  ["Marco", "Rossi"],
];

const AR_DENTAL_BIO_LINES = [
  "طبيب أسنان | تجميل الأسنان",
  "عيادة أسنان - فينير وابتسامة هوليود",
  "دكتورة أسنان مختصة بزراعة الأسنان",
  "طب الأسنان التجميلي | تركيبات الأسنان",
];

const HE_DENTAL_BIO_LINES = [
  "רופא שיניים קוסמטי",
  "מרפאת שיניים | ציפויי שיניים",
  "רופאת שיניים - השתלות שיניים",
];

const EN_DENTAL_BIO_LINES = [
  "Cosmetic dentist | veneers & smile makeovers",
  "Prosthodontist | full mouth rehabilitation",
  "General dentist serving the whole family",
  "Implant dentistry & digital smile design",
];

const NOT_A_LEAD_BIO_LINES = [
  "3rd year dental student, future dentist",
  "Dental laboratory — precision crowns & veneers for clinics",
  "Dental supply distributor | equipment & materials",
];

const UNRELATED_BIO_LINES = [
  "Travel blogger exploring the Middle East",
  "Coffee. Books. Sunsets.",
  "Fitness coach | personal training",
];

function hashString(input: string): number {
  let hash = 5381;
  for (let i = 0; i < input.length; i++) {
    hash = (hash * 33) ^ input.charCodeAt(i);
  }
  return hash >>> 0;
}

function mulberry32(seed: number): () => number {
  let a = seed;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick<T>(rng: () => number, arr: T[]): T {
  return arr[Math.floor(rng() * arr.length)];
}

function paramsSeed(params: SearchJobParameters): number {
  const key = JSON.stringify({
    country: params.country,
    cities: [...(params.cities ?? [])].sort(),
    targetMarket: params.targetMarket,
    specialty: params.specialty ?? null,
    minFollowers: params.minFollowers ?? null,
    maxFollowers: params.maxFollowers ?? null,
    keywords: [...(params.keywords ?? [])].sort(),
  });
  return hashString(key);
}

function totalForSeed(seed: number): number {
  // Deterministic "how many accounts exist for this search" between ~300-900.
  return 300 + (seed % 600);
}

function categoryForIndex(rng: () => number, params: SearchJobParameters): "arab48" | "israeli_other" | "gulf" | "student" | "lab" | "unrelated" {
  const israelTargeted =
    params.country?.toLowerCase() === "israel" || params.targetMarket === "ARAB_48";
  const roll = rng();
  if (israelTargeted) {
    if (roll < 0.55) return "arab48";
    if (roll < 0.72) return "israeli_other";
    if (roll < 0.82) return "student";
    if (roll < 0.9) return "lab";
    return "unrelated";
  }
  if (roll < 0.6) return "gulf";
  if (roll < 0.75) return "student";
  if (roll < 0.88) return "lab";
  return "unrelated";
}

function generateAccount(globalIndex: number, params: SearchJobParameters, rng: () => number): NormalizedAccount {
  const category = categoryForIndex(rng, params);
  const cities = params.cities?.length ? params.cities : ["Nazareth"];
  const city = pick(rng, cities);

  let firstLast: [string, string];
  let bioLines: string[];
  let language: string;
  let languages: string[];
  let country = params.country || "Israel";

  switch (category) {
    case "arab48":
      firstLast = pick(rng, ARABIC_NAMES);
      bioLines = rng() < 0.5 ? [pick(rng, AR_DENTAL_BIO_LINES), pick(rng, HE_DENTAL_BIO_LINES)] : [pick(rng, AR_DENTAL_BIO_LINES)];
      language = "ar";
      languages = ["ar", "he"];
      break;
    case "israeli_other":
      firstLast = pick(rng, HEBREW_NAMES);
      bioLines = [pick(rng, HE_DENTAL_BIO_LINES)];
      language = "he";
      languages = ["he"];
      break;
    case "gulf":
      firstLast = pick(rng, GULF_NAMES);
      bioLines = [pick(rng, AR_DENTAL_BIO_LINES)];
      language = "ar";
      languages = ["ar"];
      country = params.country || "UAE";
      break;
    case "student":
      firstLast = pick(rng, [...ARABIC_NAMES, ...GENERIC_NAMES]);
      bioLines = [NOT_A_LEAD_BIO_LINES[0]];
      language = "en";
      languages = ["en"];
      break;
    case "lab":
      firstLast = pick(rng, GENERIC_NAMES);
      bioLines = [pick(rng, NOT_A_LEAD_BIO_LINES.slice(1))];
      language = "en";
      languages = ["en"];
      break;
    default:
      firstLast = pick(rng, GENERIC_NAMES);
      bioLines = [pick(rng, UNRELATED_BIO_LINES)];
      language = "en";
      languages = ["en"];
  }

  if (category === "arab48" || category === "israeli_other" || category === "gulf") {
    if (rng() < 0.4) bioLines.push(pick(rng, EN_DENTAL_BIO_LINES));
  }

  const [first, last] = firstLast;
  const displayName = `Dr. ${first} ${last}`;
  const usernameBase = `${first}${last}`.replace(/[^a-zA-Z؀-ۿ]/g, "").toLowerCase();
  const username = `${usernameBase || "dent"}_${globalIndex}`;

  const minFollowers = params.minFollowers ?? 200;
  const maxFollowers = params.maxFollowers ?? 50000;
  const followersCount = Math.round(minFollowers + rng() * Math.max(1, maxFollowers - minFollowers));

  const hasWebsite = rng() < 0.4;
  const hasEmail = rng() < 0.35;
  const isVerified = rng() < 0.05;

  return {
    platform: "instagram",
    platformAccountId: `mock_${usernameBase || "dent"}_${globalIndex}`,
    username,
    displayName,
    profileUrl: `https://instagram.com/${username}`,
    profileImageUrl: null,
    bio: bioLines.join(" | "),
    followersCount,
    followingCount: Math.round(rng() * 2000),
    postsCount: Math.round(rng() * 500),
    verified: isVerified,
    country,
    city,
    language,
    languages,
    website: hasWebsite ? `https://${usernameBase || "dent"}${globalIndex}.example.com` : null,
    email: hasEmail ? `${usernameBase || "dent"}${globalIndex}@example.com` : null,
    phone: null,
    rawData: { mockCategory: category, generatedIndex: globalIndex },
  };
}

function encodeCursor(envelope: CursorEnvelope): string {
  return Buffer.from(JSON.stringify(envelope), "utf8").toString("base64url");
}

function decodeCursor(cursor: string): CursorEnvelope {
  return JSON.parse(Buffer.from(cursor, "base64url").toString("utf8"));
}

export class MockDiscoveryProvider implements LeadDiscoveryProvider {
  readonly name = "mock";
  private readonly pageSize: number;
  private readonly delayMs: number;
  private readonly failureRate: number;
  private readonly forceFailOnceAtBatch: Set<number>;
  private readonly forceFailAlwaysAtBatch: Set<number>;
  private readonly firedForcedFailures = new Set<number>();
  private readonly totalOverride?: number;

  constructor(options: MockProviderOptions = {}) {
    this.pageSize = options.pageSize ?? 25;
    this.delayMs = options.delayMs ?? 15;
    this.failureRate = options.failureRate ?? 0.02;
    this.forceFailOnceAtBatch = new Set(options.forceFailOnceAtBatch ?? []);
    this.forceFailAlwaysAtBatch = new Set(options.forceFailAlwaysAtBatch ?? []);
    this.totalOverride = options.totalOverride;
  }

  private async delay(): Promise<void> {
    if (this.delayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, this.delayMs));
    }
  }

  private maybeFail(batchNumber: number): void {
    if (this.forceFailAlwaysAtBatch.has(batchNumber)) {
      throw new ProviderTransientError(`Mock persistent forced failure at batch ${batchNumber}`);
    }
    if (this.forceFailOnceAtBatch.has(batchNumber) && !this.firedForcedFailures.has(batchNumber)) {
      this.firedForcedFailures.add(batchNumber);
      throw new ProviderTransientError(`Mock forced failure at batch ${batchNumber}`);
    }
    if (Math.random() < this.failureRate) {
      throw new ProviderTransientError("Mock simulated transient provider error");
    }
  }

  async searchAccounts(params: SearchJobParameters, cursor?: string | null): Promise<DiscoveryPage> {
    await this.delay();
    const seed = paramsSeed(params);
    const offset = cursor ? decodeCursor(cursor).offset : 0;
    const batchNumber = Math.floor(offset / this.pageSize) + 1;
    this.maybeFail(batchNumber);

    const total = this.totalOverride ?? totalForSeed(seed);
    const rng = mulberry32(seed + offset);
    const end = Math.min(offset + this.pageSize, total);
    const accounts: NormalizedAccount[] = [];
    for (let i = offset; i < end; i++) {
      // Re-derive each account from its own index-seeded RNG so the same
      // global index always yields the same account, regardless of page size —
      // this is what makes duplicate accounts across overlapping pages exact.
      const accountRng = mulberry32(seed + i * 7919);
      accounts.push(generateAccount(i, params, accountRng));
      void rng; // reserved for future per-page jitter
    }

    // Inject a handful of intentional duplicates (already-seen accounts
    // reappearing), mirroring how real discovery sources behave.
    if (offset > 0 && end - offset > 3) {
      const dupRng = mulberry32(seed + offset + 999);
      if (dupRng() < 0.3) {
        const dupIndex = Math.floor(dupRng() * offset);
        const dupAccountRng = mulberry32(seed + dupIndex * 7919);
        accounts[accounts.length - 1] = generateAccount(dupIndex, params, dupAccountRng);
      }
    }

    const hasMore = end < total;
    const nextCursor = hasMore ? encodeCursor({ op: "search", offset: end, seed, params }) : null;

    return { accounts, nextCursor, hasMore, totalEstimate: total };
  }

  async getAccountDetails(platformAccountId: string): Promise<NormalizedAccount | null> {
    await this.delay();
    const match = platformAccountId.match(/^mock_.*_(\d+)$/);
    if (!match) return null;
    const index = Number(match[1]);
    const rng = mulberry32(index * 7919);
    return generateAccount(index, { country: "Israel", cities: ["Nazareth"], targetMarket: "ARAB_48" }, rng);
  }

  async getFollowers(platformAccountId: string, cursor?: string | null): Promise<DiscoveryPage> {
    await this.delay();
    const seed = hashString(platformAccountId);
    const offset = cursor ? decodeCursor(cursor).offset : 0;
    const batchNumber = Math.floor(offset / this.pageSize) + 1;
    this.maybeFail(batchNumber);

    const total = 60 + (seed % 120);
    const end = Math.min(offset + this.pageSize, total);
    const fakeParams: SearchJobParameters = { country: "Israel", cities: ["Nazareth"], targetMarket: "ARAB_48" };
    const accounts: NormalizedAccount[] = [];
    for (let i = offset; i < end; i++) {
      const accountRng = mulberry32(seed + i * 104729);
      accounts.push(generateAccount(seed % 100000 + i, fakeParams, accountRng));
    }

    const hasMore = end < total;
    const nextCursor = hasMore
      ? encodeCursor({ op: "followers", offset: end, seed, seedAccountId: platformAccountId })
      : null;

    return { accounts, nextCursor, hasMore, totalEstimate: total };
  }

  async getNextPage(cursor: string): Promise<DiscoveryPage> {
    const envelope = decodeCursor(cursor);
    if (envelope.op === "search") {
      if (!envelope.params) throw new Error("Malformed search cursor: missing params");
      return this.searchAccounts(envelope.params, cursor);
    }
    if (!envelope.seedAccountId) throw new Error("Malformed followers cursor: missing seedAccountId");
    return this.getFollowers(envelope.seedAccountId, cursor);
  }
}
