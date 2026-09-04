import { createHash } from "node:crypto";
import { query, queryOne } from "@/lib/db";
import type { QualificationInput, LeadQualificationService } from "@/lib/services/qualification";
import type { QualificationResult } from "@/lib/types";

export function hashQualificationInput(input: QualificationInput): string {
  return createHash("sha256").update(JSON.stringify(input)).digest("hex");
}

export async function qualifyWithCache(
  socialAccountId: string,
  input: QualificationInput,
  service: LeadQualificationService,
): Promise<QualificationResult> {
  const inputHash = hashQualificationInput(input);

  const cached = await queryOne<{ result: QualificationResult }>(
    `select result from qualification_results
     where social_account_id = $1 and input_hash = $2 and prompt_version = $3`,
    [socialAccountId, inputHash, service.promptVersion],
  );
  if (cached) return cached.result;

  const result = await service.qualify(input);

  await query(
    `insert into qualification_results (social_account_id, input_hash, provider, prompt_version, result)
     values ($1, $2, $3, $4, $5)
     on conflict (social_account_id, input_hash, prompt_version) do nothing`,
    [socialAccountId, inputHash, service.provider, service.promptVersion, JSON.stringify(result)],
  );

  return result;
}
