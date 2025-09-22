/**
 * HLIN static builder — builds home/UK/town pages + GLOBAL category pages
 */

const required = ["town","town_slug","county","council"];

function cleanRow(r) {
  const o = {};
  for (const k of Object.keys(r)) o[k] = (r[k] ?? "").toString().trim();
  o.town = o.town || "";
  o.town_slug = (o.town_slug || "").toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
  o.county = o.county || "";
  o.council = o.council || "";
  o.population_bucket = o.population_bucket || "M";
  o.country = o.country || "UK";
  o.timezone = o.timezone || "Europe/London";
  return o;
}
function validRow(o) { return required.every(k => o[k] && String(o[k]).trim().length); }

const fs = require("fs");
const fse = require("fs-extra");
const path = require("path");
const { parse } = require("csv-parse/sync");
const https = require("https");
const http = require("http");

function fetchUrl(url, maxRedirects = 5) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith("https") ? https : http;
    const req = client.get(url, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location && maxRedirects > 0) {
        const next = new URL(res.headers.location, url).toString();
        res.resume(); resolve(fetchUrl(next, maxRedirects - 1)); return;
      }
      if (res.statusCode !== 200) { reject(new Error(`Failed to fetch ${url}: ${res.statusCode}`)); return; }
      let data = ""; res.setEncoding("utf8");
      res.on("data", (c) => (data += c)); res.on("end", () => resolve(data));
    });
    req.on("error", reject);
  });
}

function readJSONIfExists(p) { try { if (fs.existsSync(p)) return JSON.parse(fs.readFileSync(p, "utf8")); } catch(_){} return null; }
function normalizeRecords(records){ return records.map(r => { const o={}; for(const k of Object.keys(r)) o[k]=(r[k]??"").toString().trim(); return o; }); }
function readCSV(filePath){ const csv = fs.readFileSync(filePath,"utf8"); return parse(csv,{columns:true,skip_empty_lines:true,trim:true}); }

async function loadCSVRecords(name, localFile, envVar) {
  const remoteUrl = process.env[envVar] || (CONFIG.sources ? CONFIG.sources[name] : null);
  if (remoteUrl && remoteUrl.startsWith("http")) {
    console.log(`Fetching ${name} from`, remoteUrl);
    const body = await fetchUrl(remoteUrl);
    return parse(body, { columns: true, skip_empty_lines: true, trim: true });
  } else {
    console.log(`Reading ${name} from local`, localFile);
    return readCSV(localFile);
  }
}

const now = new Date(); const YEAR = now.getFullYear();
const CONFIG = readJSONIfExists(path.join(__dirname, "config", "config.json")) || {};
const BASE_URL = (process.env.BASE_URL || CONFIG.BASE_URL || "https://local.starflow.uk").replace(/\/+$/, "");
const canonical = (p) => `${BASE_URL}${p.startsWith("/") ? p : "/" + p}`;

const DATA_DIR = path.join(__dirname, "data");
const TPL_DIR = path.join(__dirname, "templates");
const STATIC_DIR = path.join(__dirname, "static");
const DIST_DIR = path.join(__dirname, "dist");

const slugify = (s)=> s.toString().toLowerCase().trim().replace(/&/g," and ").replace(/[^a-z0-9]+/g,"-").replace(/^-+|-+$/g,"");
function loadTemplate(name){ return fs.readFileSync(path.join(TPL_DIR, name), "utf8"); }

function renderLayout(content, meta = {}) {
  const layout = loadTemplate("layout.html");
  let out = layout
    .replaceAll("{{PAGE_TITLE}}", meta.PAGE_TITLE || "Starflow Local")
    .replaceAll("{{PAGE_DESCRIPTION}}", meta.PAGE_DESCRIPTION || "Local info")
    .replaceAll("{{SITE_TITLE}}", "Starflow Local")
    .replaceAll("{{SITE_TAGLINE}}", "Helpful local info. No hype, just answers.")
    .replaceAll("{{HEAD_EXTRAS}}", meta.HEAD_EXTRAS || "")
    .replaceAll("{{PAGE_CANONICAL}}", meta.PAGE_CANONICAL || `${BASE_URL}/`)
    .replaceAll("{{YEAR}}", String(YEAR))
    .replace("{{CONTENT}}", content);
  return out;
}

function renderTemplate(templateName, slots) {
  let tpl = loadTemplate(templateName);
  const hasLayout = tpl.startsWith("{{#layout}}");

  const meta = {};
  tpl = tpl.replace(/{{([A-Z0-9_]+)=(.*?)}}/gs, (_, key, val) => { meta[key] = val; return ""; });

  if (hasLayout) tpl = tpl.replace(/^\s*{{#layout}}\s*/i, "");

  if (slots && typeof slots === "object") {
    for (const [k, v] of Object.entries(slots)) tpl = tpl.replace(new RegExp("{{" + k + "}}","g"), v);
    if (slots.PAGE_CANONICAL) meta.PAGE_CANONICAL = slots.PAGE_CANONICAL;
    if (slots.PAGE_TITLE) meta.PAGE_TITLE = slots.PAGE_TITLE;
    if (slots.PAGE_DESCRIPTION) meta.PAGE_DESCRIPTION = slots.PAGE_DESCRIPTION;
  }
  return hasLayout ? renderLayout(tpl.trim(), meta) : tpl;
}

function ensureDir(p){ fse.ensureDirSync(p); }
function writeFile(relPath, content){ const full = path.join(DIST_DIR, relPath); ensureDir(path.dirname(full)); fs.writeFileSync(full, content); console.log("Wrote", relPath); }

function table(headers, rows){
  const thead = "<tr>" + headers.map((h)=>`<th>${h}</th>`).join("") + "</tr>";
  const tbody = rows.map((r)=>"<tr>"+r.map((c)=>`<td>${c||""}</td>`).join("")+"</tr>").join("\n");
  return `<table class="table">${thead}${tbody}</table>`;
}
function list(items){ return `<ul class="list">` + items.map(li=>`<li>${li}</li>`).join("") + `</ul>`; }

let places, termDates, bins, venues, eventsFree, pharmacyLate, poolsFamily;
let placesByTown, townsByCounty;
const eq = (a,b)=> (a||"").toString().trim().toLowerCase() === (b||"").toString().trim().toLowerCase();

async function loadAll(){
  places       = await loadCSVRecords("places",       path.join(DATA_DIR,"places.csv"),        "PLACES_CSV_URL");
  termDates    = await loadCSVRecords("term_dates",   path.join(DATA_DIR,"term_dates.csv"),    "TERM_DATES_CSV_URL");
  bins         = await loadCSVRecords("bins",         path.join(DATA_DIR,"bins.csv"),          "BINS_CSV_URL");
  venues       = await loadCSVRecords("venues",       path.join(DATA_DIR,"venues.csv"),        "VENUES_CSV_URL");
  eventsFree   = await loadCSVRecords("events_free",  path.join(DATA_DIR,"events_free.csv"),   "EVENTS_FREE_CSV_URL");
  pharmacyLate = await loadCSVRecords("pharmacy_late",path.join(DATA_DIR,"pharmacy_late.csv"), "PHARMACY_LATE_CSV_URL");
  poolsFamily  = await loadCSVRecords("pools_family", path.join(DATA_DIR,"pools_family.csv"),  "POOLS_FAMILY_CSV_URL");

  places       = normalizeRecords(places).map(cleanRow).filter(validRow);
  termDates    = normalizeRecords(termDates);
  bins         = normalizeRecords(bins);
  venues       = normalizeRecords(venues);
  eventsFree   = normalizeRecords(eventsFree);
  pharmacyLate = normalizeRecords(pharmacyLate);
  poolsFamily  = normalizeRecords(poolsFamily);

  const seen = new Set();
  places = places.filter(p => !seen.has(p.town_slug) && seen.add(p.town_slug))
                 .sort((a,b)=>a.town.localeCompare(b.town));
}

function councilTermRows(council){ return termDates.filter(t => eq(t.council, council)); }
function councilBinsRow(council){ return bins.find(b => eq(b.council, council)); }
function townVenues(town, types){ return venues.filter(v => eq(v.town, town) && types.includes(v.type)); }
function townEventsUpcoming(town, daysAhead=7){
  const today = new Date(); const max = new Date(today.getTime()+daysAhead*24*3600*1000);
  return eventsFree.filter(e => { if(!eq(e.town, town)) return false; const d = new Date(e.date); return !isNaN(d) && d>=today && d<=max; });
}
function townPools(town){ return poolsFamily.filter(p => eq(p.town, town)); }
function townLatePharmacies(town){ return pharmacyLate.filter(p => eq(p.town, town)); }

(async () => {
  await loadAll();

  placesByTown = Object.fromEntries(places.map(p => [p.town, p]));
  townsByCounty = places.reduce((acc,p)=>{ (acc[p.county] ||= []).push(p); return acc; }, {});

  // clean dist & copy static
  fse.removeSync(DIST_DIR); ensureDir(DIST_DIR);
  if (fs.existsSync(STATIC_DIR)) fse.copySync(STATIC_DIR, path.join(DIST_DIR, "static"));

  // ---- Home
  const townCards = places.map(p => {
    const u = `/${p.town_slug || slugify(p.town)}/`;
    return `<a class="card" href="${u}"><strong>${p.town}</strong><br><small>${p.county}</small></a>`;
  }).join("\n");
  writeFile("index.html", renderTemplate("index.html", {
    TOWN_CARDS: townCards,
    PAGE_CANONICAL: canonical("/")
  }));

  // ---- UK index
  const countyBlocks = Object.keys(townsByCounty).sort().map(county => {
    const links = townsByCounty[county].slice().sort((a,b)=>a.town.localeCompare(b.town))
      .map(p => `<a href="/${p.town_slug || slugify(p.town)}/">${p.town}</a>`).join(" · ");
    return `<div class="card"><h3>${county}</h3><p>${links}</p></div>`;
  }).join("\n");
  writeFile("uk/index.html", renderTemplate("uk_index.html", {
    COUNTY_BLOCKS: countyBlocks,
    PAGE_CANONICAL: canonical("/uk/")
  }));

  // ---- Static pages
  [
    { tpl:'about.html',   out:'about/index.html',   canon:'/about/'   },
    { tpl:'contact.html', out:'contact/index.html', canon:'/contact/' },
    { tpl:'updates.html', out:'updates/index.html', canon:'/updates/' },
    { tpl:'deals.html',   out:'deals/index.html',   canon:'/deals/'   }
  ].forEach(p => writeFile(p.out, renderTemplate(p.tpl, { PAGE_CANONICAL: canonical(p.canon) })));

  // ==== GLOBAL CATEGORY PAGES ====

  // Soft Play (from venues)
  (function buildSoftPlay(){
    const items = venues.filter(v => (v.type||"").toLowerCase()==="soft_play")
      .map(v => ({ name:v.name, town:v.town, address:v.address||"", price:v.price_note||"", url:v.url||"" }))
      .sort((a,b)=> a.town.localeCompare(b.town) || a.name.localeCompare(b.name));
    const rows = items.map(i => [i.name, i.town, i.address, i.price, i.url ? `<a href="${i.url}" target="_blank" rel="nofollow">Website</a>` : ""]);
    const content = `<h1>Soft play across all towns</h1>` + table(["Name","Town","Address","Price","Link"], rows);
    writeFile("soft-play/index.html", renderLayout(content, {
      PAGE_TITLE: "Soft play near you | Starflow Local",
      PAGE_DESCRIPTION: "All soft play centres across our covered towns.",
      PAGE_CANONICAL: canonical("/soft-play/")
    }));
  })();

  // Free this week (from events_free, next 7 days)
  (function buildEventsAll(){
    const today = new Date(); const max = new Date(today.getTime()+7*24*3600*1000);
    const items = eventsFree.filter(e => { const d = new Date(e.date); return !isNaN(d) && d>=today && d<=max; })
      .map(e => ({ date:e.date, town:e.town, title:e.title, url:e.url, where:[e.venue_name,e.venue_address].filter(Boolean).join(" · ") }))
      .sort((a,b)=> a.date.localeCompare(b.date) || a.town.localeCompare(b.town));
    const rows = items.map(i => [i.date, i.town, i.title ? `<a href="${i.url}" target="_blank" rel="nofollow">${i.title}</a>` : "", i.where]);
    const content = `<h1>Free this week across all towns</h1>` + table(["Date","Town","Event","Where"], rows);
    writeFile("free-this-weekend/index.html", renderLayout(content, {
      PAGE_TITLE: "Free this week | Starflow Local",
      PAGE_DESCRIPTION: "Free events happening this week across our towns.",
      PAGE_CANONICAL: canonical("/free-this-weekend/")
    }));
  })();

  // Late pharmacies (from pharmacy_late)
  (function buildPharmacyLate(){
    const items = pharmacyLate.map(p => ({ town:p.town, name:p.name, days:p.days_open_late||"", close:p.close_time||"", address:p.address||"", nhs:p.nhs_url||"" }))
      .sort((a,b)=> a.town.localeCompare(b.town) || a.name.localeCompare(b.name));
    const rows = items.map(i => [i.town, i.name, i.days, i.close, i.address, i.nhs ? `<a href="${i.nhs}" target="_blank" rel="nofollow">NHS</a>` : ""]);
    const content = `<h1>Late-opening pharmacies</h1><p class="muted">Evening and late pharmacies across our towns.</p>` + table(["Town","Pharmacy","Days open late","Closes","Address","NHS"], rows);
    writeFile("pharmacy-late/index.html", renderLayout(content, {
      PAGE_TITLE: "Late-opening pharmacies | Starflow Local",
      PAGE_DESCRIPTION: "Late-opening pharmacies across our towns.",
      PAGE_CANONICAL: canonical("/pharmacy-late/")
    }));
  })();

  // Family pools (from pools_family)
  (function buildPoolsAll(){
    const items = poolsFamily.map(s => ({ town:s.town, name:s.session_name, day:s.day_of_week, start:s.start_time||"", end:s.end_time||"", price:s.price_note||"", link:s.link||"" }))
      .sort((a,b)=> a.town.localeCompare(b.town) || a.day.localeCompare(b.day) || (a.start||"").localeCompare(b.start||""));
    const rows = items.map(i => [i.town, i.name, i.day, `${i.start}-${i.end}`, i.price, i.link ? `<a href="${i.link}" target="_blank" rel="nofollow">Timetable</a>` : ""]);
    const content = `<h1>Family swimming times</h1><p class="muted">Family sessions across our towns. Check your town page for latest.</p>` + table(["Town","Session","Day","Time","Price","Link"], rows);
    writeFile("swimming-family-times/index.html", renderLayout(content, {
      PAGE_TITLE: "Family swimming times | Starflow Local",
      PAGE_DESCRIPTION: "Family swim sessions across our towns.",
      PAGE_CANONICAL: canonical("/swimming-family-times/")
    }));
  })();

  // Bins index (by council)
  (function buildBinsIndex(){
    const townsByCouncil = places.reduce((acc,p)=>{ (acc[p.council] ||= []).push(p); return acc; }, {});
    const rows = Object.keys(townsByCouncil).sort().map(c => {
      const b = councilBinsRow(c);
      const towns = townsByCouncil[c].map(p => `<a href="/${p.town_slug}/bin-collection/">${p.town}</a>`).join(" · ");
      const checker = b && b.link_to_checker ? `<a href="${b.link_to_checker}" target="_blank" rel="nofollow">Checker</a>` : "";
      const note = (b?.general_rules || "").slice(0, 140);
      return [c, towns, checker, note];
    });
    const content = `<h1>Bin collection by council</h1><p class="muted">Find your council’s bin rules and checker. Choose your town for full details.</p>` + table(["Council","Towns","Checker","Notes"], rows);
    writeFile("bins/index.html", renderLayout(content, {
      PAGE_TITLE: "Bin collection by council | Starflow Local",
      PAGE_DESCRIPTION: "Links to bin day checkers and summaries for each council we cover.",
      PAGE_CANONICAL: canonical("/bins/")
    }));
  })();

  // Term dates index (by council)
  (function buildTermDatesIndex(){
    const councils = [...new Set(places.map(p => p.council))].sort();
    function nextTermForCouncil(c){
      const today = new Date();
      const rows = termDates.filter(t => eq(t.council, c)).slice().sort((a,b)=>(a.start_date||"").localeCompare(b.start_date||""));
      const next = rows.find(r => new Date(r.end_date) >= today);
      return next ? `${next.term_name} ${next.start_date} → ${next.end_date}` : (rows[0] ? `${rows[0].term_name} ${rows[0].start_date} → ${rows[0].end_date}` : "");
    }
    const rows = councils.map(c => {
      const towns = places.filter(p => eq(p.council,c)).map(p => `<a href="/${p.town_slug}/term-dates/">${p.town}</a>`).join(" · ");
      return [c, nextTermForCouncil(c), towns];
    });
    const content = `<h1>School term dates</h1><p class="muted">Term dates by council. Click a town for the full table.</p>` + table(["Council","Upcoming term","Towns"], rows);
    writeFile("term-dates/index.html", renderLayout(content, {
      PAGE_TITLE: "School term dates by council | Starflow Local",
      PAGE_DESCRIPTION: "Quick index of term dates across councils we cover.",
      PAGE_CANONICAL: canonical("/term-dates/")
    }));
  })();

  // ---- Per-town pages (unchanged)
  places.forEach(p => {
    const town = p.town;
    const townSlug = p.town_slug || slugify(town);
    const council = p.council;
    const county = p.county;

    const term = councilTermRows(council).slice(0,3).map(r => `${r.term_name}: ${r.start_date} → ${r.end_date}`).join("<br>") || "Add term dates";
    const binRow = councilBinsRow(council);
    const binSummary = binRow
      ? `<p>${binRow.general_rules || ""}</p><p><a href="${binRow.link_to_checker}" target="_blank" rel="nofollow">Council checker</a></p>`
      : "Add bin info";
    const baby = townVenues(town, ["baby_group"]).slice(0,3).map(v => `${v.name} <span class="muted">${v.opening_hours || ""}</span>`).join("<br>") || "Add baby groups";
    const sp = townVenues(town, ["soft_play","park"]).slice(0,3).map(v => `${v.name} <span class="muted">${v.price_note || ""}</span>`).join("<br>") || "Add soft play/parks";
    const pool = townPools(town).slice(0,3).map(s => `${s.session_name} (${s.day_of_week} ${s.start_time}-${s.end_time})`).join("<br>") || "Add family swim times";
    const urgent = [
      ...townVenues(town, ["urgent_care"]).slice(0,2).map(v => `${v.name} <span class="muted">${v.address || ""}</span>`),
      ...townLatePharmacies(town).slice(0,2).map(ph => `${ph.name} <span class="muted">late ${ph.close_time || ""}</span>`)
    ].join("<br>") || "Add urgent care/pharmacies";
    const weekend = townEventsUpcoming(town, 7).slice(0,4).map(e => `${e.date}: <a href="${e.url}" target="_blank" rel="nofollow">${e.title}</a>`).join("<br>") || "No free events added yet";

    const townHome = renderTemplate("town_home.html", {
      TOWN: town, COUNTY: county, COUNCIL: council, TOWN_SLUG: townSlug,
      TERM_SUMMARY: term, BIN_SUMMARY: binSummary, BABY_SUMMARY: baby,
      SOFTPLAY_SUMMARY: sp, POOL_SUMMARY: pool, URGENT_SUMMARY: urgent, WEEKEND_SUMMARY: weekend,
      PAGE_CANONICAL: canonical(`/${townSlug}/`)
    });
    writeFile(`${townSlug}/index.html`, townHome);

    function sectionPage(pathSuffix, title, intro, rowsHtml, descr) {
      return renderTemplate("section.html", {
        TITLE: title, TOWN: town, TOWN_SLUG: townSlug, DESCRIPTION: descr || intro, INTRO: intro, LIST_HTML: rowsHtml,
        PAGE_CANONICAL: canonical(`/${townSlug}/${pathSuffix}`)
      });
    }

    // term dates
    {
      const rows = councilTermRows(council);
      const rowsHtml = rows.length
        ? table(["Term","Start","End","Inset Days"], rows.map(r => [r.term_name, r.start_date, r.end_date, (r.inset_dates || "").replace(/;/g, ", ")]))
        : "<p>Add term_dates.csv rows for this council.</p>";
      writeFile(`${townSlug}/term-dates/index.html`, sectionPage("term-dates/", "School term dates", `Council: ${council}`, rowsHtml, `School term dates in ${town}, ${county}.`));
    }
    // bins
    {
      const b = councilBinsRow(council);
      const rowsHtml = b
        ? (`<p><strong>General rules:</strong> ${b.general_rules || ""}</p>
            <p><strong>Garden waste:</strong> ${b.garden_waste_info || ""}</p>
            <p><strong>Bulky waste:</strong> ${b.bulky_waste_info || ""}</p>
            <p><a href="${b.link_to_checker}" target="_blank" rel="nofollow">Go to council bin day checker</a></p>
            <p class="muted">Source: <a href="${b.source_url || "#"}" target="_blank" rel="nofollow">${b.source_url || ""}</a></p>`)
        : "<p>Add bins.csv row for this council.</p>";
      writeFile(`${townSlug}/bin-collection/index.html`, sectionPage("bin-collection/", "Bin collection", `Council: ${council}`, rowsHtml, `Bin collection info and checker for ${town}.`));

      }
  // baby groups (CSV-powered via templates/baby_groups.html) — with explicit meta
{
  const html = renderTemplate("baby_groups.html", {
    TOWN: town,
    TOWN_SLUG: townSlug,
    COUNTY: county,
    COUNCIL: council,
    PAGE_CANONICAL: canonical(`/${townSlug}/baby-groups/`),
    // Explicit meta so {{TOWN}} inside template meta isn't needed
    PAGE_TITLE: `Baby & toddler groups in ${town} | Starflow Local`,
    PAGE_DESCRIPTION: `Clubs, groups and sessions for babies & toddlers in ${town}.`
  });
  writeFile(`${townSlug}/baby-groups/index.html`, html);
}


    // soft play & parks
    {
      const items = townVenues(town, ["soft_play","park"]);
      const rowsHtml = items.length
        ? list(items.map(v => `<strong>${v.name}</strong> <span class="badge">${v.type}</span><br><span class="muted">${v.address || ""}</span><br>${v.price_note || ""}<br><a href="${v.url}" target="_blank" rel="nofollow">${v.url}</a>`))
        : "<p>Add soft play and parks to venues.csv (type=soft_play or park)</p>";
      writeFile(`${townSlug}/soft-play-parks/index.html`, sectionPage("soft-play-parks/", "Soft play & parks", `Town: ${town}`, rowsHtml, `Soft play centres and parks in ${town}.`));
    }
    // pools family times
    {
      const items = townPools(town);
      const rowsHtml = items.length
        ? table(["Session","Day","Start","End","Price","Link"], items.map(s =>
            [s.session_name, s.day_of_week, s.start_time, s.end_time, s.price_note || "", s.link ? `<a href="${s.link}" target="_blank" rel="nofollow">Timetable</a>` : "" ]))
        : "<p>Add pools_family.csv rows for this town.</p>";
      writeFile(`${townSlug}/swimming-family-times/index.html`, sectionPage("swimming-family-times/", "Family swimming times", `Town: ${town}`, rowsHtml, `Family swim times and sessions in ${town}.`));
    }
    // urgent care & pharmacies
    {
      const urgentCare = townVenues(town, ["urgent_care"]);
      const latePh = townLatePharmacies(town);
      const parts = [];
      if (urgentCare.length) {
        parts.push("<h3>Urgent care</h3>" + list(urgentCare.map(v =>
          `<strong>${v.name}</strong><br>${v.address || ""}<br><a href="${v.url}" target="_blank" rel="nofollow">${v.url}</a>`)));
      }
      if (latePh.length) {
        parts.push("<h3>Late pharmacies</h3>" + list(latePh.map(p =>
          `<strong>${p.name}</strong> · open late ${p.days_open_late || ""} until ${p.close_time || ""}<br>${p.address || ""}<br><a href="${p.nhs_url}" target="_blank" rel="nofollow">NHS listing</a>`)));
      }
      const rowsHtml = parts.length ? parts.join("") : "<p>Add urgent care in venues.csv (type=urgent_care) and late pharmacies in pharmacy_late.csv.</p>";
      writeFile(`${townSlug}/urgent-care-pharmacy/index.html`, sectionPage("urgent-care-pharmacy/", "Urgent care & late pharmacies", `Town: ${town}`, rowsHtml, `Urgent care and late pharmacies in ${town}.`));
    }
    // free this weekend
    {
      const items = townEventsUpcoming(town, 7);
      const rowsHtml = items.length
        ? list(items.map(e => `<strong>${e.date}</strong> — <a href="${e.url}" target="_blank" rel="nofollow">${e.title}</a><br><span class="muted">${e.venue_name || ""} · ${e.venue_address || ""}</span>`))
        : "<p>No free events added for the next 7 days.</p>";
      writeFile(`${townSlug}/free-this-weekend/index.html`, sectionPage("free-this-weekend/", "Free this weekend", `Town: ${town}`, rowsHtml, `Free events in ${town} this week.`));
    }
  });

  // robots.txt
  writeFile("robots.txt", `User-agent: *\nAllow: /\nSitemap: ${BASE_URL}/sitemap.xml\n`);

  // sitemap.xml
  (function buildSitemap(){
    const urls = [
      "/", "/uk/", "/about/", "/contact/", "/updates/",
      "/deals/", "/soft-play/", "/free-this-weekend/", "/pharmacy-late/", "/swimming-family-times/", "/bins/", "/term-dates/"
    ];
    places.forEach(p => {
      const t = `/${p.town_slug || slugify(p.town)}`;
      urls.push(`${t}/`);
      urls.push(`${t}/term-dates/`);
      urls.push(`${t}/bin-collection/`);
      urls.push(`${t}/baby-groups/`);
      urls.push(`${t}/soft-play-parks/`);
      urls.push(`${t}/swimming-family-times/`);
      urls.push(`${t}/urgent-care-pharmacy/`);
      urls.push(`${t}/free-this-weekend/`);
    });
    const today = new Date().toISOString().slice(0,10);
    const body = urls.map(u => `<url><loc>${BASE_URL}${u}</loc><changefreq>daily</changefreq><lastmod>${today}</lastmod></url>`).join("\n");
    writeFile("sitemap.xml", `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>`);
  })();

  writeFile("debug.json", JSON.stringify({
    build_time: new Date().toISOString(),
    places_count: places.length,
    places: places.map(p => p.town_slug),
    counties: Object.keys(townsByCounty).sort()
  }, null, 2));

  console.log("Build complete.");
})();
