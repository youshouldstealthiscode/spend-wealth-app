#!/usr/bin/env node
/**
 * Billionaire data updater — fully automatic, zero manual intervention.
 *
 * Primary source: Forbes Real-Time Billionaires API
 *   https://www.forbes.com/forbesapi/person/rtb/0/-estWorthPrev/true.json
 *   - Official Forbes endpoint, no API key required
 *   - Returns complete ranking (3000+ people) with rank, name, net worth
 *   - Net worth in millions USD, updated in real-time
 *
 * Fallback: static snapshot (last known good values, flagged as stale)
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

function nowIso() { return new Date().toISOString(); }

function httpGet(url, opts = {}) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "application/json,*/*",
        "Accept-Language": "en-US,en;q=0.5",
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

/**
 * Fetch from Forbes Real-Time Billionaires API.
 * Returns the full ranked list with net worth in millions USD.
 *
 * API documentation (reverse-engineered):
 *   GET /forbesapi/person/rtb/0/-estWorthPrev/true.json
 *     ?fields=rank,personName,finalWorth,city,country,state,headshot,industries
 *     &limit=N
 *
 * We request top 50 to safely cover the top 10.
 */
async function fetchFromForbesApi() {
  const fields = "rank,personName,finalWorth,country,industries,source";
  const url = `https://www.forbes.com/forbesapi/person/rtb/0/-estWorthPrev/true.json?fields=${fields}&limit=50`;

  const { body, status } = await httpGet(url);
  if (status !== 200) throw new Error(`HTTP ${status}`);

  const data = JSON.parse(body);

  // The API returns: { personList: "<JSON string>" }
  // where the inner JSON has: { personsLists: [...], totalCount: N }
  let list;
  if (data.personList) {
    const inner = typeof data.personList === "string" ? JSON.parse(data.personList) : data.personList;
    list = inner.personsLists || inner.personList || inner.persons || [];
  } else if (Array.isArray(data)) {
    list = data;
  } else {
    throw new Error("Unexpected response shape");
  }

  if (list.length === 0) throw new Error("Empty billionaire list");

  const top10 = list.slice(0, 10).map((p) => {
    const netWorthMillions = p.finalWorth || p.netWorth || p.net_worth || 0;
    const name = p.personName || p.name || "Unknown";
    return {
      id: name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/-$/, ""),
      rank: p.rank || 0,
      name: name,
      net_worth: Math.round(netWorthMillions * 1e6), // Convert millions to dollars
      country: p.country || "",
      company: p.source || p.industries?.[0] || p.company || "",
    };
  });

  const valid = top10.filter((p) => p.net_worth > 0);
  if (valid.length === 0) throw new Error("All net worths are 0");

  console.log(`[✓] Forbes API: ${list.length} people fetched, #1 ${valid[0].name} $${(valid[0].net_worth / 1e12).toFixed(2)}T`);

  return {
    last_updated: nowIso(),
    source: "Forbes Real-Time Billionaires (official API)",
    source_url: "https://www.forbes.com/real-time-billionaires/",
    stale: false,
    people: top10,
  };
}

// Static fallback when API is unreachable (updated 2026-06-12 from Forbes API)
const FALLBACK = [
  { id: "elon-musk", rank: 1, name: "Elon Musk", net_worth: 1132799000000, company: "Tesla, SpaceX", country: "United States" },
  { id: "larry-page", rank: 2, name: "Larry Page", net_worth: 295606000000, company: "Google", country: "United States" },
  { id: "sergey-brin", rank: 3, name: "Sergey Brin", net_worth: 272652000000, company: "Google", country: "United States" },
  { id: "jeff-bezos", rank: 4, name: "Jeff Bezos", net_worth: 246800000000, company: "Amazon", country: "United States" },
  { id: "larry-ellison", rank: 5, name: "Larry Ellison", net_worth: 228000000000, company: "Oracle", country: "United States" },
  { id: "michael-dell", rank: 6, name: "Michael Dell", net_worth: 226000000000, company: "Dell Technologies", country: "United States" },
  { id: "mark-zuckerberg", rank: 7, name: "Mark Zuckerberg", net_worth: 196000000000, company: "Meta", country: "United States" },
  { id: "jensen-huang", rank: 8, name: "Jensen Huang", net_worth: 177000000000, company: "Nvidia", country: "United States" },
  { id: "bernard-arnault-family", rank: 9, name: "Bernard Arnault & family", net_worth: 157000000000, company: "LVMH", country: "France" },
  { id: "warren-buffett", rank: 10, name: "Warren Buffett", net_worth: 144000000000, company: "Berkshire Hathaway", country: "United States" },
];

async function main() {
  let dataset;

  try {
    dataset = await fetchFromForbesApi();
  } catch (e) {
    console.warn(`[✗] Forbes API failed: ${e.message}`);
    console.warn("[!] Using static fallback. Data will be flagged as stale.");
    dataset = {
      last_updated: nowIso(),
      source: "Static fallback (Forbes API unavailable)",
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
