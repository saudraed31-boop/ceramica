export type JobStatus = "queued" | "running" | "paused" | "completed" | "failed" | "cancelled";

export type JobStage =
  | "initializing"
  | "discovering"
  | "enriching"
  | "qualifying"
  | "market_classification"
  | "scoring"
  | "deduplicating"
  | "completed";

export type Market =
  | "ARAB_48"
  | "ISRAELI_OTHER"
  | "PALESTINIAN_TERRITORIES"
  | "GULF"
  | "JORDAN"
  | "IRAQ"
  | "OTHER"
  | "UNKNOWN";

export type LeadTemperature = "HOT" | "WARM" | "QUALIFIED" | "LOW" | "DISQUALIFIED";

export type QualificationStatus = "not_a_lead" | "possible_lead" | "qualified" | "high_value";

export type SalesStatus =
  | "NEW"
  | "QUALIFIED"
  | "CONTACTED"
  | "REPLIED"
  | "INTERESTED"
  | "SAMPLE_REQUESTED"
  | "NEGOTIATION"
  | "CONVERTED"
  | "NOT_INTERESTED"
  | "LOST";

export interface SearchJobParameters {
  country: string;
  cities: string[];
  targetMarket: string;
  specialty?: string;
  minFollowers?: number;
  maxFollowers?: number;
  languages?: string[];
  keywords?: string[];
  minLeadScore?: number;
  discoveryMethods?: string[];
}

export interface SearchJobRow {
  id: string;
  user_id: string | null;
  name: string;
  status: JobStatus;
  provider: string;
  parameters: SearchJobParameters;
  stage: JobStage;
  progress_percent: string;
  total_discovered: number;
  total_processed: number;
  total_qualified: number;
  total_failed: number;
  cursor: string | null;
  retry_count: number;
  error_message: string | null;
  started_at: string | null;
  completed_at: string | null;
  last_heartbeat: string | null;
  created_at: string;
  updated_at: string;
}

export interface NormalizedAccount {
  platform: string;
  platformAccountId: string;
  username: string | null;
  displayName: string | null;
  profileUrl: string | null;
  profileImageUrl: string | null;
  bio: string | null;
  followersCount: number | null;
  followingCount: number | null;
  postsCount: number | null;
  verified: boolean;
  country: string | null;
  city: string | null;
  language: string | null;
  languages: string[];
  website: string | null;
  email: string | null;
  phone: string | null;
  rawData: Record<string, unknown>;
}

export interface SocialAccountRow {
  id: string;
  platform: string;
  platform_account_id: string;
  username: string | null;
  display_name: string | null;
  profile_url: string | null;
  profile_image_url: string | null;
  bio: string | null;
  followers_count: number | null;
  following_count: number | null;
  posts_count: number | null;
  verified: boolean;
  country: string | null;
  city: string | null;
  language: string | null;
  languages: string[];
  website: string | null;
  email: string | null;
  phone: string | null;
  raw_data: Record<string, unknown>;
  first_seen_at: string;
  last_seen_at: string;
  created_at: string;
  updated_at: string;
}

export interface MarketClassificationResult {
  market: Market;
  confidence: number;
  signals: string[];
  reason: string;
}

export interface QualificationResult {
  is_dentist: boolean;
  is_clinic: boolean;
  specialty: string | null;
  target_market: string | null;
  confidence: number;
  relevant_services: string[];
  qualification_reason: string;
  red_flags: string[];
  qualification_status: QualificationStatus;
  lead_type: "dentist" | "clinic" | "unknown" | "not_a_lead";
}

export interface ScoreBreakdown {
  specialty: number;
  content: number;
  audience: number;
  business: number;
  targetMarket: number;
  negative: number;
}

export interface ScoringResult {
  totalScore: number;
  breakdown: ScoreBreakdown;
  temperature: LeadTemperature;
  version: string;
}

export interface LeadRow {
  id: string;
  social_account_id: string;
  lead_type: string;
  person_name: string | null;
  clinic_name: string | null;
  specialty: string | null;
  country: string | null;
  city: string | null;
  target_market: Market;
  market_confidence: string;
  market_signals: string[];
  website: string | null;
  email: string | null;
  phone: string | null;
  lead_score: number;
  lead_temperature: LeadTemperature;
  qualification_status: QualificationStatus;
  sales_status: SalesStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
}
