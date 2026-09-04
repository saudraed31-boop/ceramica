import { query } from "@/lib/db";

export interface DashboardStats {
  totalLeads: number;
  hot: number;
  warm: number;
  qualified: number;
  contacted: number;
  interested: number;
  converted: number;
}

export async function getDashboardStats(): Promise<DashboardStats> {
  const rows = await query<{ lead_temperature: string; sales_status: string; count: string }>(
    `select lead_temperature, sales_status, count(*) as count
     from leads
     where qualification_status <> 'not_a_lead'
     group by lead_temperature, sales_status`,
  );

  let totalLeads = 0;
  let hot = 0;
  let warm = 0;
  let qualified = 0;
  let contacted = 0;
  let interested = 0;
  let converted = 0;

  for (const row of rows) {
    const count = Number(row.count);
    totalLeads += count;
    if (row.lead_temperature === "HOT") hot += count;
    if (row.lead_temperature === "WARM") warm += count;
    if (row.lead_temperature === "QUALIFIED") qualified += count;
    if (row.sales_status === "CONTACTED" || row.sales_status === "REPLIED") contacted += count;
    if (row.sales_status === "INTERESTED" || row.sales_status === "SAMPLE_REQUESTED" || row.sales_status === "NEGOTIATION")
      interested += count;
    if (row.sales_status === "CONVERTED") converted += count;
  }

  return { totalLeads, hot, warm, qualified, contacted, interested, converted };
}

export interface RecentActivityRow {
  id: string;
  action: string;
  metadata: Record<string, unknown>;
  created_at: string;
  job_id: string | null;
  lead_id: string | null;
}

export async function getRecentActivity(limit = 20): Promise<RecentActivityRow[]> {
  return query<RecentActivityRow>(`select * from activity_log order by created_at desc limit $1`, [limit]);
}
