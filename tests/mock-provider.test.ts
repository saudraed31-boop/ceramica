import { describe, expect, it } from "vitest";
import { MockDiscoveryProvider } from "@/lib/providers/mock-provider";
import { ProviderTransientError } from "@/lib/providers/types";
import type { SearchJobParameters } from "@/lib/types";

const params: SearchJobParameters = {
  country: "Israel",
  cities: ["Nazareth", "Umm al-Fahm"],
  targetMarket: "ARAB_48",
  specialty: "Cosmetic Dentistry",
  minFollowers: 1000,
};

describe("MockDiscoveryProvider", () => {
  it("paginates through the full result set using cursors", async () => {
    const provider = new MockDiscoveryProvider({ pageSize: 25, delayMs: 0, failureRate: 0 });
    let cursor: string | null | undefined = undefined;
    let total = 0;
    let pages = 0;
    do {
      const page = await provider.searchAccounts(params, cursor);
      total += page.accounts.length;
      cursor = page.nextCursor;
      pages++;
    } while (cursor);
    expect(total).toBeGreaterThan(200);
    expect(pages).toBeGreaterThan(1);
  });

  it("getNextPage resumes an in-flight search from an opaque cursor", async () => {
    const provider = new MockDiscoveryProvider({ pageSize: 25, delayMs: 0, failureRate: 0 });
    const first = await provider.searchAccounts(params);
    expect(first.nextCursor).toBeTruthy();
    const second = await provider.getNextPage(first.nextCursor!);
    expect(second.accounts.length).toBeGreaterThan(0);
  });

  it("re-running the same search returns overlapping accounts (same platformAccountId)", async () => {
    const providerA = new MockDiscoveryProvider({ pageSize: 25, delayMs: 0, failureRate: 0 });
    const providerB = new MockDiscoveryProvider({ pageSize: 25, delayMs: 0, failureRate: 0 });
    const pageA = await providerA.searchAccounts(params);
    const pageB = await providerB.searchAccounts(params);
    const idsA = pageA.accounts.map((a) => a.platformAccountId);
    const idsB = pageB.accounts.map((a) => a.platformAccountId);
    expect(idsA).toEqual(idsB);
  });

  it("forces a transient failure once at a given batch, then succeeds on retry", async () => {
    const provider = new MockDiscoveryProvider({
      pageSize: 25,
      delayMs: 0,
      failureRate: 0,
      forceFailOnceAtBatch: [2],
    });
    await provider.searchAccounts(params); // batch 1 ok
    let firstAttemptCursor = encodeSearchCursor(params, 25);
    await expect(provider.getNextPage(firstAttemptCursor)).rejects.toThrow(ProviderTransientError);
    // retry from the SAME checkpoint cursor succeeds
    const retry = await provider.getNextPage(firstAttemptCursor);
    expect(retry.accounts.length).toBeGreaterThan(0);
  });
});

function encodeSearchCursor(p: SearchJobParameters, offset: number): string {
  return Buffer.from(JSON.stringify({ op: "search", offset, seed: 0, params: p }), "utf8").toString(
    "base64url",
  );
}
