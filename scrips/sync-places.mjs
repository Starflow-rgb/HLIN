// scripts/sync-places.mjs
import { writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Use env var if present (Cloudflare Pages), else fallback to hardcoded URL.
const url =
  process.env.PLACES_CSV ||
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vT7TA_CR3IHpl5oVVDgK7Zs-M-gu7NWEcCKf58Ltb8bDhNWApc0AV5WDM4BZrhsgQ/pub?gid=908255209&single=true&output=csv";

console.log("Fetching places CSV from:", url);
const res = await fetch(url, { cache: "no-store" });
if (!res.ok) {
  console.error(`Failed to fetch places CSV: ${res.status} ${res.statusText}`);
  process.exit(1);
}
const csv = (await res.text()).trim();

// Basic sanity check
if (!/^town\s*,\s*town_slug/i.test(csv)) {
  console.error("Unexpected CSV header. First 120 chars:\n" + csv.slice(0, 120));
  process.exit(1);
}

const outPath = resolve(__dirname, "../data/places.csv");
await writeFile(outPath, csv, "utf8");
console.log("✅ Wrote", outPath);
