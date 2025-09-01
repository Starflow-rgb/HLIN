# Starflow Local — HLIN Starter

Zero-cost, faceless, automated local-info site generator. **Font:** Arial, size ~12pt.

## Quick start
1. Open `/data/*.csv` and add **Hatfield** + **Barnet** entries (keep headers).
2. Install Node 18+ then run:
   ```bash
   npm install
   npm run build
   ```
   Your site outputs to `./dist/`. Preview locally:
   ```bash
   npm run serve
   ```
3. Point **Cloudflare Pages** or **Netlify** to this repo. Build command: `npm run build`, publish directory: `dist`.
4. In `templates/layout.html`, replace `YOUR-ADSENSE-ID` with your AdSense client ID (once approved).
5. Update `sitemap.xml` & `robots.txt` placeholders (`YOUR_DOMAIN`).

## Data schema (Google Sheets tabs)
Create a Google Sheet named `HLIN_Master` with **tabs** below (columns exactly as listed). You can keep working in CSVs and later migrate to Google Sheets by exporting CSV links per tab.

### `places`
```
town | town_slug | county | council | lat | lon | population_bucket | country | timezone
```

### `term_dates`
```
council | academic_year | term_name | start_date | end_date | inset_dates | source_url | last_checked
```

### `bins`
```
council | link_to_checker | general_rules | garden_waste_info | bulky_waste_info | source_url | last_checked
```

### `venues`
```
name | type | town | address | postcode | url | phone | opening_hours | price_note | tags | lat | lon | last_checked
```
`type` values: `soft_play`, `park`, `pool`, `baby_group`, `urgent_care`, `pharmacy`, `other`

### `events_free`
```
town | title | date | start_time | end_time | venue_name | venue_address | url | description | source | added_on
```

### `pharmacy_late`
```
town | name | address | postcode | days_open_late | close_time | phone | nhs_url | last_checked
```

### `pools_family`
```
town | pool_name | session_name | day_of_week | start_time | end_time | price_note | link | last_checked
```

## What gets generated
- `/index.html` — list of towns
- `/uk/index.html` — towns by county
- `/{town}/index.html` — **combined** town page
- Section pages per town:
  - `/{town}/term-dates/`
  - `/{town}/bin-collection/`
  - `/{town}/baby-groups/`
  - `/{town}/soft-play-parks/`
  - `/{town}/swimming-family-times/`
  - `/{town}/urgent-care-pharmacy/`
  - `/{town}/free-this-weekend/`

## Automations (later)
- Use GitHub Actions (below) with a daily cron to rebuild and deploy.
- Use Google Apps Script to refresh Events/venues into Google Sheets → export CSV → this builder consumes them on next build.

---

### GitHub Actions (Cloudflare Pages) — example
Set repo secrets: `CF_API_TOKEN`, `CF_ACCOUNT_ID`, `CF_PAGES_PROJECT`.


**Note:** The builder now defaults `BASE_URL` to `https://starflow.uk`. You can override at build time with `BASE_URL=https://yourdomain`.


## Remote (Google Sheets) mode
This build can auto-pull CSVs directly from **published** Google Sheets tabs.

### Step 1 — Publish each tab
In Google Sheets → File → **Share** → **Publish to web** → choose **CSV** and each sheet (places, term_dates, bins, venues, events_free, pharmacy_late, pools_family). Copy the link for each (it will look like `.../export?format=csv&gid=...`).

### Step 2 — Provide the URLs
Option A (config file): edit `config/config.json` and paste each URL under `sources`.
Option B (env vars): set these in your host (Cloudflare Pages / GitHub Actions):
```
PLACES_CSV_URL
TERM_DATES_CSV_URL
BINS_CSV_URL
VENUES_CSV_URL
EVENTS_FREE_CSV_URL
PHARMACY_LATE_CSV_URL
POOLS_FAMILY_CSV_URL
BASE_URL=https://starflow.uk   # optional override
```

Local fallback: if a URL is missing, the builder reads the local CSV from `/data`.

### Cloudflare Pages
- Set the env vars in Project → Settings → Environment variables.
- Build command: `npm run build`  ·  Output: `dist`


