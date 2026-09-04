import type { NormalizedAccount, SearchJobParameters } from "@/lib/types";

export interface DiscoveryPage {
  accounts: NormalizedAccount[];
  nextCursor: string | null;
  hasMore: boolean;
  totalEstimate?: number;
}

// Abstraction the rest of the application depends on. Discovery source
// (Instagram scraping, an official API, an approved third-party data
// provider, ...) is entirely swappable behind this interface — the job
// engine, dedup, qualification, classification, and scoring code never
// know or care which provider produced an account.
export interface LeadDiscoveryProvider {
  readonly name: string;

  /** Start (cursor undefined) or continue (cursor from a previous page) a search. */
  searchAccounts(params: SearchJobParameters, cursor?: string | null): Promise<DiscoveryPage>;

  /** Fetch full public profile details for one account. */
  getAccountDetails(platformAccountId: string): Promise<NormalizedAccount | null>;

  /** Paginate an account's followers/following as an additional discovery method. */
  getFollowers(platformAccountId: string, cursor?: string | null): Promise<DiscoveryPage>;

  /**
   * Resume ANY previous paginated call from an opaque cursor, without the
   * caller needing to know whether it was mid-search or mid-follower-crawl.
   * This is what the job worker calls when resuming from a checkpoint.
   */
  getNextPage(cursor: string): Promise<DiscoveryPage>;
}

export class ProviderRateLimitError extends Error {
  constructor(message = "Provider rate limit exceeded") {
    super(message);
    this.name = "ProviderRateLimitError";
  }
}

export class ProviderTransientError extends Error {
  constructor(message = "Transient provider error") {
    super(message);
    this.name = "ProviderTransientError";
  }
}
