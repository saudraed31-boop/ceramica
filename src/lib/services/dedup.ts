import { queryOne } from "@/lib/db";
import type { NormalizedAccount, SocialAccountRow } from "@/lib/types";

export interface UpsertResult {
  id: string;
  isNew: boolean;
  row: SocialAccountRow;
}

// Deduplication is enforced at the database level via the
// unique(platform, platform_account_id) constraint — this upsert is what
// makes re-discovering the same account (within a job, across pages, or
// across two separate search jobs) update the existing row instead of
// creating a duplicate.
export async function upsertSocialAccount(account: NormalizedAccount): Promise<UpsertResult> {
  const row = await queryOne<SocialAccountRow & { inserted: boolean }>(
    `
    insert into social_accounts (
      platform, platform_account_id, username, display_name, profile_url,
      profile_image_url, bio, followers_count, following_count, posts_count,
      verified, country, city, language, languages, website, email, phone,
      raw_data, first_seen_at, last_seen_at
    ) values (
      $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, now(), now()
    )
    on conflict (platform, platform_account_id) do update set
      username = excluded.username,
      display_name = excluded.display_name,
      profile_url = excluded.profile_url,
      profile_image_url = excluded.profile_image_url,
      bio = excluded.bio,
      followers_count = excluded.followers_count,
      following_count = excluded.following_count,
      posts_count = excluded.posts_count,
      verified = excluded.verified,
      country = excluded.country,
      city = excluded.city,
      language = excluded.language,
      languages = excluded.languages,
      website = excluded.website,
      email = excluded.email,
      phone = excluded.phone,
      raw_data = excluded.raw_data,
      last_seen_at = now(),
      updated_at = now()
    returning *, (xmax = 0) as inserted
    `,
    [
      account.platform,
      account.platformAccountId,
      account.username,
      account.displayName,
      account.profileUrl,
      account.profileImageUrl,
      account.bio,
      account.followersCount,
      account.followingCount,
      account.postsCount,
      account.verified,
      account.country,
      account.city,
      account.language,
      JSON.stringify(account.languages),
      account.website,
      account.email,
      account.phone,
      JSON.stringify(account.rawData),
    ],
  );

  if (!row) throw new Error("upsertSocialAccount: insert/update returned no row");
  const { inserted, ...rest } = row;
  return { id: rest.id, isNew: inserted, row: rest as SocialAccountRow };
}
