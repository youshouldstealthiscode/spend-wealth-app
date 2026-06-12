#!/usr/bin/env node
/**
 * Billionaire data updater — automatic with staleness awareness.
 *
 * Data source: rtb-api (https://github.com/komed3/rtb-api)
 *   - Community-maintained mirror of Forbes Real-Time Billionaires
 *   - Updates daily via GitHub Actions bot
 *   - Free, no API key needed
 *
 * The repo stores data in dated folders: api/list/rtb/YYYY-MM-DD/latest.json
 * We use the GitHub API to find the latest date, then fetch that file.
 *
 * Fallback chain:
 *   1. rtb-api latest snapshot (primary — free, auto-updated daily)
 *   2. Static fallback (last known good values, flagged as stale)
 *
 * GitHub Actions workflow runs this twice daily (05:00, 17:00 UTC).
 */

const fs = require("node:fs");
const path = require("node:path");
const https = require("https");

const PROJECT_ROOT = path.resolve(__dirname, "..");
const OUTPUT_PATHS = [
  path.join(PROJECT_ROOT, "app", "data", "richest_people.json"),
  path.join(PROJECT_ROOT, "data", "richest_people.json"),
];

const STALE_THRESHOLD_DAYS = 30;

const FALLBACK = [
  { id: "elon-musk", rank: 1, name: "Elon Musk", net_worth: 981600000000, company: "Tesla, SpaceX", country: "United States" },
  { id: "larry-page", rank: 2, name: "Larry Page", net_worth: 296400000000, company: "Google", country: "United States" },
  { id: "sergey-brin", rank: 3, name: "Sergey Brin", net_worth: 273400000000, company: "Google", country: "United States" },
  { id: "jeff-bezos", rank: 4, name: "Jeff Bezos", net_worth: 248400000000, company: "Amazon", country: "United States" },
  { id: "larry-ellison", rank: 5, name: "Larry Ellison", net_worth: 228500000000, company: "Oracle", country: "United States" },
  { id: "michael-dell", rank: 6, name: "Michael Dell", net_worth: 228300000000, company: "Dell Technologies", country: "United States" },
  { id: "mark-zuckerberg", rank: 7, name: "Mark Zuckerberg", net_worth: 196300000000, company: "Meta", country: "United States" },
  { id: "jensen-huang", rank: 8, name: "Jensen Huang", net_worth: 178400000000, company: "Nvidia", country: "United States" },
  { id: "bernard-arnault", rank: 9, name: "Bernard Arnault & family", net_worth: 157200000000, company: "LVMH", country: "France" },
  { id: "warren-buffett", rank: 10, name: "Warren Buffett", net_worth: 144400000000, company: "Berkshire Hathaway", country: "United States" },
];

function nowIso() { return new Date().toISOString(); }

function httpGet(url, opts = {}) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, {
      headers: {
        "User-Agent": "spend-wealth-app/1.0",
        "Accept": "application/json",
        ...opts.headers,
      },
      timeout: opts.timeout || 15000,
    }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return httpGet(res.headers.location, opts).then(resolve, reject);
      }
      let data = "";
      res.on("data", (c) => (data += c));
      res.on("end", () => resolve({ status: res.statusCode, body: data }));
    });
    req.on("error", reject);
    req.on("timeout", () => { req.destroy(); reject(new Error("timeout")); });
  });
}

/** Find the latest dated snapshot by checking the most recent commit */
async function getLatestDate() {
  const { body, status } = await httpGet(
    "https://api.github.com/repos/komed3/rtb-api/commits?path=api/list/rtb&per_page=1"
  );
  if (status !== 200) throw new Error(`GitHub commits API HTTP ${status}`);
  const commits = JSON.parse(body);
  if (!Array.isArray(commits) || commits.length === 0) throw new Error("No commits found");

  // Commit message format: "update API database (YYYY-MM-DD)"
  const msg = commits[0]?.commit?.message || "";
  const match = msg.match(/(\d{4}-\d{2}-\d{2})/);
  if (!match) throw new Error(`Could not parse date from commit: "${msg}"`);

  const date = match[1];
  const commitDate = commits[0]?.commit?.author?.date || "unknown";
  console.log(`rtb-api: latest commit is ${commitDate}, data date ${date}`);
  return date;
}

async function fetchFromRtbApi() {
  // The rtb-api stores the latest data at api/list/rtb/latest (no date in path)
  // The commit message contains the date: "update API database (YYYY-MM-DD)"
  const latestDate = await getLatestDate();
  console.log(`rtb-api: latest data date is ${latestDate}`);

  const url = "https://raw.githubusercontent.com/komed3/rtb-api/main/api/list/rtb/latest";
  const { body, status } = await httpGet(url);
  if (status !== 200) throw new Error(`HTTP ${status}`);

  const data = JSON.parse(body);
  if (!data.list || !Array.isArray(data.list) || data.list.length === 0) {
    throw new Error("Empty or invalid list");
  }

  // Use the date from the commit (when the data was scraped from Forbes)
  const dataDate = data.date || latestDate;
  const ageMs = Date.now() - new Date(dataDate).getTime();
  const ageDays = Math.round(ageMs / 86400000);
  const isStale = ageDays > STALE_THRESHOLD_DAYS;

  console.log(`rtb-api: ${data.list.length} people, data dated ${dataDate} (${ageDays} days old)`);

  const top10 = data.list.slice(0, 10).map((p) => {
    const source = Array.isArray(p.source) ? p.source.join(", ") : (p.source || "");
    return {
      id: p.uri || p.id || p.name.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
      rank: p.rank || 0,
      name: p.name,
      net_worth: Math.round((p.networth || 0) * 1e6),
      company: source,
      country: (p.citizenship || "").toUpperCase(),
      daily_change_pct: (p.change?.pct && typeof p.change.pct === "number") ? p.change.pct / 100 : null,
      daily_change_usd: (p.change?.value && typeof p.change.value === "number") ? Math.round(p.change.value * 1e6) : null,
    };
  });

  const valid = top10.filter((p) => p.net_worth > 0);
  if (valid.length === 0) throw new Error("All net worths are 0");

  return {
    last_updated: nowIso(),
    source: "Forbes Real-Time Billionaires (via rtb-api)",
    source_url: "https://www.forbes.com/real-time-billionaires/",
    api_date: latestDate,
    data_age_days: ageDays,
    stale: isStale,
    staleness_warning: isStale ? `Data is ${ageDays} days old. Rankings and net worths may have changed.` : null,
    people: top10,
  };
}

async function main() {
  let dataset;

  try {
    dataset = await fetchFromRtbApi();
    console.log(`[✓] Fetched: #1 ${dataset.people[0].name} $${(dataset.people[0].net_worth / 1e9).toFixed(1)}B`);
  } catch (e) {
    console.warn(`[✗] rtb-api failed: ${e.message}`);
    console.warn("[!] Using static fallback. Data will be flagged as stale.");
    dataset = {
      last_updated: nowIso(),
      source: "Static fallback (rtb-api unavailable)",
      source_url: "https://www.forbes.com/real-time-billionaires/",
      stale: true,
      staleness_warning: "Billionaire data is from a cached snapshot and may be outdated.",
      people: FALLBACK,
    };
  }

  const json = JSON.stringify(dataset, null, 2) + "\n";
  for (const outputPath of OUTPUT_PATHS) {
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, json, "utf8");
    console.log("Wrote", outputPath);
  }

  if (dataset.stale) process.exitCode = 2;
}

main().catch((e) => { console.error("Fatal:", e); process.exit(1); });
