// scrips/sync-places.mjs
// Build-time fetcher for Google Sheets CSVs -> writes to /data/*.csv
// Runs in Node 18+ on Cloudflare Pages.

import fs from "node:fs/promises";
import path from "node:path";

const OUT_DIR = path.join(process.cwd(), "data");

// Your published CSV URLs (one per tab)
const SOURCES = {
  places: "https://docs.google.com/spreadsheets/d/e/2PACX-1vRlgg8rRwLuicnlI_1KVZALa-BUG82JLQ3zAgLB3-q7A02EE3mA_JLzdU9_iodIdyjwMjk_Tjquy7bN/pub?gid=908255209&single=true&output=csv",
  term_dates: "https://docs.google.com/spreadsheets/d/e/2PACX-1vRlgg8rRwLuicnlI_1KVZALa-BUG82JLQ3zAgLB3-q7A02EE3mA_JLzdU9_iodIdyjwMjk_Tjquy7bN/pub?gid=1940374553&single=true&output=csv",
  bins: "https://docs.google.com/spreadsheets/d/e/2PACX-1vRlgg8rRwLuicnlI_1KVZALa-BUG82JLQ3zAgLB3-q7A02EE3mA_JLzdU9_iodIdyjwMjk_Tjquy7bN/pub?gid=195184624&single=true&output=csv",
  venues: "https://docs.google.com/spreadsheets/d/e/2PACX-1vRlgg8rRwLuicnlI_1KVZALa-BUG82JLQ3zAgLB3-q7A02EE3mA_JLzdU9_iodIdyjwMjk_Tjquy7bN/pub?gid=2025559599&single=true&output=csv",
  events_free: "https://docs.google.com/spreadsheets/d/e/2PACX-1vRlgg8rRwLuicnlI_1KVZALa-BUG82JLQ3zAgLB3-q7A02EE3mA_JLzdU9_iodIdyjwMjk_Tjquy7bN/pub?gid=753392860&single=true&output=csv",
  pharmacy_late: "https://docs.google.com/spreadsheets/d/e/2PACX-1vRlgg8rRwLuicnlI_1KVZALa-BUG82JLQ3zAgLB3-q7A02EE3mA_JLzdU9_iodIdyjwMjk_Tjquy7bN/pub?gid=1582879353&single=true&output=csv",
  pools_family: "https://docs.google.com/spreadsheets/d/e/2PACX-1vRlgg8rRwLuicnlI_1KVZALa-BUG82JLQ3zAgLB3-q7A02EE3mA_JLzdU9_iodIdyjwMjk_Tjquy7bN/pub?gid=1108610723&single=true&output=csv",
};

async function ensureDir(dir) {
  try { await fs.mkdir(dir, { recursive: true }); } catch {}
}

async function fetchCsv(name, url) {
  const res = await fetch(url, { redirect: "follow" });
  if (!res.ok) throw new Error(`Fetch failed for ${name}: ${res.status} ${res.statusText}`);
  return await res.text();
}

async function main() {
  await ensureDir(OUT_DIR);

  for (const [name, url] of Object.entries(SOURCES)) {
    console.log(`Downloading ${name} from ${url}`);
    const csv = await fetchCsv(name, url);
    const dest = path.join(OUT_DIR, `${name}.csv`);
    await fs.writeFile(dest, csv, "utf8");
    console.log(`✅ Wrote ${dest}`);
  }
}

main().catch((err) => {
  console.error("❌ fetch-sheets failed:", err);
  process.exit(1);
});
