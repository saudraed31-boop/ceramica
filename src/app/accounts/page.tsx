import { query } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function AccountsPage() {
  const accounts = await query<{
    id: string;
    username: string;
    city: string | null;
    followers_count: number | null;
    platform: string;
    last_seen_at: string;
  }>(`select id, username, city, followers_count, platform, last_seen_at from social_accounts order by last_seen_at desc limit 200`);

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Discovered Accounts</h1>
      <p className="text-sm text-[var(--text-muted)]">
        Every raw account seen by discovery jobs, before qualification/scoring — deduplicated by (platform,
        platform_account_id).
      </p>
      <div className="overflow-x-auto rounded-lg border border-[var(--border)]">
        <table className="w-full text-left text-sm">
          <thead className="bg-[var(--bg-panel)] text-xs uppercase text-[var(--text-muted)]">
            <tr>
              <th className="px-3 py-2">Username</th>
              <th className="px-3 py-2">Platform</th>
              <th className="px-3 py-2">City</th>
              <th className="px-3 py-2">Followers</th>
              <th className="px-3 py-2">Last Seen</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border)]">
            {accounts.map((a) => (
              <tr key={a.id}>
                <td className="px-3 py-2">@{a.username}</td>
                <td className="px-3 py-2">{a.platform}</td>
                <td className="px-3 py-2">{a.city ?? "—"}</td>
                <td className="px-3 py-2">{a.followers_count?.toLocaleString() ?? "—"}</td>
                <td className="px-3 py-2 text-[var(--text-muted)]">{new Date(a.last_seen_at).toLocaleString()}</td>
              </tr>
            ))}
            {accounts.length === 0 && (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-[var(--text-muted)]">
                  No accounts discovered yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
