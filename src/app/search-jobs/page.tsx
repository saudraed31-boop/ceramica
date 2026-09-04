import Link from "next/link";
import { listSearchJobs } from "@/lib/services/jobs";

export const dynamic = "force-dynamic";

export default async function SearchJobsPage() {
  const jobs = await listSearchJobs(100);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Search Jobs</h1>
        <Link
          href="/search-jobs/new"
          className="rounded-md bg-[var(--gold)] px-3 py-1.5 text-sm font-medium text-black hover:bg-[var(--gold-dark)] hover:text-white"
        >
          + New Search
        </Link>
      </div>

      <div className="overflow-x-auto rounded-lg border border-[var(--border)]">
        <table className="w-full text-left text-sm">
          <thead className="bg-[var(--bg-panel)] text-xs uppercase text-[var(--text-muted)]">
            <tr>
              <th className="px-3 py-2">Name</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Stage</th>
              <th className="px-3 py-2">Progress</th>
              <th className="px-3 py-2">Discovered</th>
              <th className="px-3 py-2">Qualified</th>
              <th className="px-3 py-2">Created</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border)]">
            {jobs.map((job) => (
              <tr key={job.id} className="hover:bg-[var(--ink-soft)]">
                <td className="px-3 py-2">
                  <Link href={`/search-jobs/${job.id}`} className="text-[var(--gold)]">
                    {job.name}
                  </Link>
                </td>
                <td className="px-3 py-2">{job.status}</td>
                <td className="px-3 py-2">{job.stage}</td>
                <td className="px-3 py-2">{job.progress_percent}%</td>
                <td className="px-3 py-2">{job.total_discovered}</td>
                <td className="px-3 py-2">{job.total_qualified}</td>
                <td className="px-3 py-2 text-[var(--text-muted)]">{new Date(job.created_at).toLocaleString()}</td>
              </tr>
            ))}
            {jobs.length === 0 && (
              <tr>
                <td colSpan={7} className="px-3 py-6 text-center text-[var(--text-muted)]">
                  No search jobs yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
