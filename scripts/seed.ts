import { config } from "dotenv";
config({ path: ".env.local" });
import { query } from "../src/lib/db";
import { DEFAULT_KEYWORD_GROUPS } from "../src/lib/config/keywords";
import { DEFAULT_TARGET_LOCATIONS } from "../src/lib/config/locations";

async function main() {
  console.log("Seeding keyword_groups...");
  for (const group of DEFAULT_KEYWORD_GROUPS) {
    await query(
      `insert into keyword_groups (name, language, category, keywords, active)
       values ($1, $2, $3, $4, $5)
       on conflict do nothing`,
      [group.name, group.language, group.category, JSON.stringify(group.keywords), group.active],
    );
  }

  console.log("Seeding target_locations...");
  for (const loc of DEFAULT_TARGET_LOCATIONS) {
    await query(
      `insert into target_locations (name, country, arabic_name, hebrew_name, target_market, active)
       values ($1, $2, $3, $4, $5, $6)
       on conflict do nothing`,
      [loc.name, loc.country, loc.arabicName ?? null, loc.hebrewName ?? null, loc.targetMarket, loc.active],
    );
  }

  console.log("Seeding demo user...");
  await query(
    `insert into users (email, name, role) values ($1, $2, 'admin') on conflict (email) do nothing`,
    ["saudraed31@gmail.com", "Saud"],
  );

  console.log("Seed complete.");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
