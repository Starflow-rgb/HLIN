// scrips/sync-places.mjs
import fs from "node:fs/promises";

const SHEET =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vT7TA_CR3IHpl5oVVDgK7Zs-M-gu7NWEcCKf58Ltb8bDhNWApc0AV5WDM4BZrhsgQ/pub?output=csv";

// Always fetch a fresh copy from Sheets (avoid edge/browser caches)
const fetchUrl = `${SHEET}&t=${Date.now()}`;

const res = await fetch(fetchUrl, { cache: "no-store" });
if (!res.ok) {
  throw new Error(`Places fetch failed: ${res.status} ${res.statusText}`);
}

const csv = await res.text();

// Overwrite the local CSV used by build.js
await fs.writeFile("./data/places.csv", csv, "utf8");
console.log("✅ Wrote", process.cwd() + "/data/places.csv");
