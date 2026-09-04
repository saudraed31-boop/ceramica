import { query, queryOne } from "@/lib/db";
import type {
  LeadRow,
  Market,
  NormalizedAccount,
  QualificationResult,
  ScoringResult,
} from "@/lib/types";
import { SCORING_VERSION } from "@/lib/config/scoring";

export interface UpsertLeadParams {
  socialAccountId: string;
  account: NormalizedAccount;
  qualification: QualificationResult;
  market: { market: Market; confidence: number; signals: string[]; reason: string };
  scoring: ScoringResult;
}

export async function upsertLead(params: UpsertLeadParams): Promise<LeadRow> {
  const { account, qualification, market, scoring } = params;

  const personName = qualification.lead_type === "dentist" ? account.displayName : null;
  const clinicName = qualification.lead_type === "clinic" ? account.displayName : null;

  const row = await queryOne<LeadRow>(
    `
    insert into leads (
      social_account_id, lead_type, person_name, clinic_name, specialty,
      country, city, target_market, market_confidence, market_signals,
      website, email, phone, lead_score, lead_temperature,
      qualification_status, sales_status
    ) values (
      $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, 'NEW'
    )
    on conflict (social_account_id) do update set
      lead_type = excluded.lead_type,
      person_name = excluded.person_name,
      clinic_name = excluded.clinic_name,
      specialty = excluded.specialty,
      country = excluded.country,
      city = excluded.city,
      target_market = excluded.target_market,
      market_confidence = excluded.market_confidence,
      market_signals = excluded.market_signals,
      website = excluded.website,
      email = excluded.email,
      phone = excluded.phone,
      lead_score = excluded.lead_score,
      lead_temperature = excluded.lead_temperature,
      qualification_status = excluded.qualification_status,
      updated_at = now()
    returning *
    `,
    [
      params.socialAccountId,
      qualification.lead_type,
      personName,
      clinicName,
      qualification.specialty,
      account.country,
      account.city,
      market.market,
      market.confidence,
      JSON.stringify(market.signals),
      account.website,
      account.email,
      account.phone,
      scoring.totalScore,
      scoring.temperature,
      qualification.qualification_status,
    ],
  );
  if (!row) throw new Error("upsertLead: insert/update returned no row");

  await query(
    `insert into lead_scores (lead_id, total_score, score_breakdown, scoring_version)
     values ($1, $2, $3, $4)`,
    [row.id, scoring.totalScore, JSON.stringify(scoring.breakdown), SCORING_VERSION],
  );

  return row;
}

export interface LeadListRow extends LeadRow {
  username: string | null;
  profile_url: string | null;
  followers_count: number | null;
  bio: string | null;
}

export interface LeadDetailRow extends LeadListRow {
  display_name: string | null;
  following_count: number | null;
  posts_count: number | null;
  verified: boolean;
  language: string | null;
  languages: string[];
}

export interface LeadFilters {
  targetMarket?: string;
  minConfidence?: number;
  country?: string;
  city?: string;
  specialty?: string;
  minScore?: number;
  temperature?: string;
  salesStatus?: string;
  minFollowers?: number;
  sort?: "score" | "newest";
  limit?: number;
}

export async function listLeads(filters: LeadFilters = {}): Promise<LeadListRow[]> {
  const conditions: string[] = ["l.qualification_status <> 'not_a_lead'"];
  const values: unknown[] = [];
  let i = 1;

  if (filters.targetMarket) {
    conditions.push(`l.target_market = $${i++}`);
    values.push(filters.targetMarket);
  }
  if (filters.minConfidence !== undefined) {
    conditions.push(`l.market_confidence >= $${i++}`);
    values.push(filters.minConfidence);
  }
  if (filters.country) {
    conditions.push(`l.country = $${i++}`);
    values.push(filters.country);
  }
  if (filters.city) {
    conditions.push(`l.city = $${i++}`);
    values.push(filters.city);
  }
  if (filters.specialty) {
    conditions.push(`l.specialty = $${i++}`);
    values.push(filters.specialty);
  }
  if (filters.minScore !== undefined) {
    conditions.push(`l.lead_score >= $${i++}`);
    values.push(filters.minScore);
  }
  if (filters.temperature) {
    conditions.push(`l.lead_temperature = $${i++}`);
    values.push(filters.temperature);
  }
  if (filters.salesStatus) {
    conditions.push(`l.sales_status = $${i++}`);
    values.push(filters.salesStatus);
  }
  if (filters.minFollowers !== undefined) {
    conditions.push(`sa.followers_count >= $${i++}`);
    values.push(filters.minFollowers);
  }

  const orderBy =
    filters.sort === "newest" ? "l.created_at desc" : "l.lead_score desc, l.created_at desc";

  const limit = filters.limit ?? 200;
  values.push(limit);

  return query<LeadListRow>(
    `
    select l.*, sa.username, sa.profile_url, sa.followers_count, sa.bio
    from leads l
    join social_accounts sa on sa.id = l.social_account_id
    where ${conditions.join(" and ")}
    order by ${orderBy}
    limit $${i}
    `,
    values,
  );
}

export async function getLead(id: string): Promise<LeadDetailRow | null> {
  return queryOne<LeadDetailRow>(
    `
    select l.*, sa.username, sa.profile_url, sa.followers_count, sa.bio, sa.display_name,
           sa.following_count, sa.posts_count, sa.verified, sa.language, sa.languages
    from leads l
    join social_accounts sa on sa.id = l.social_account_id
    where l.id = $1
    `,
    [id],
  );
}

export async function getLeadCounts() {
  const rows = await query<{ lead_temperature: string; count: string }>(
    `select lead_temperature, count(*) from leads where qualification_status <> 'not_a_lead' group by lead_temperature`,
  );
  const bySalesStatus = await query<{ sales_status: string; count: string }>(
    `select sales_status, count(*) from leads where qualification_status <> 'not_a_lead' group by sales_status`,
  );
  return { byTemperature: rows, bySalesStatus };
}
