#!/usr/bin/env node
const fs = require("node:fs");
const path = require("node:path");
const https = require("node:https");

const PROJECT_ROOT = path.resolve(__dirname, "..");
const OUTPUT_PATHS = [
  path.join(PROJECT_ROOT, "app", "data", "richest_people.json"),
  path.join(PROJECT_ROOT, "data", "richest_people.json"),
];

const FALLBACK = [
  { id: "elon-musk", rank: 1, name: "Elon Musk", net_worth: 835000000000, company: "Tesla, SpaceX", country: "United States" },
  { id: "larry-page", rank: 2, name: "Larry Page", net_worth: 309000000000, company: "Google", country: "United States" },
  { id: "sergey-brin", rank: 3, name: "Sergey Brin", net_worth: 285000000000, company: "Google", country: "United States" },
  { id: "jeff-bezos", rank: 4, name: "Jeff Bezos", net_worth: 277000000000, company: "Amazon", country: "United States" },
  { id: "larry-ellison", rank: 5, name: "Larry Ellison", net_worth: 276000000000, company: "Oracle", country: "United States" },
  { id: "michael-dell", rank: 6, name: "Michael Dell", net_worth: 244000000000, company: "Dell Technologies", country: "United States" },
  { id: "mark-zuckerberg", rank: 7, name: "Mark Zuckerberg", net_worth: 217000000000, company: "Meta", country: "United States" },
  { id: "jensen-huang", rank: 8, name: "Jensen Huang", net_worth: 182000000000, company: "Nvidia", country: "United States" },
  { id: "bernard-arnault", rank: 9, name: "Bernard Arnault & family", net_worth: 148000000000, company: "LVMH", country: "France" },
  { id: "steve-ballmer", rank: 10, name: "Steve Ballmer", net_worth: 141000000000, company: "Microsoft", country: "United States" },
];

function nowIso() {
  return new Date().toISOString();
}

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { "User-Agent": "spend-wealth-app/1.0" }, timeout: 15000 }, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(new Error("Invalid JSON from " + url));
        }
      });
    }).on("error", reject);
  });
}

async function fetchFromApi() {
  const url = "https://cdn.jsdelivr.net/gh/komed3/rtb-api@main/api/list/rtb/latest";
  const data = await fetchJson(url);

  if (!data.list || !Array.isArray(data.list)) {
    throw new Error("API returned unexpected format");
  }

  // Check API data freshness — warn if older than 7 days
  const apiDate = data.date ? new Date(data.date) : null;
  const now = new Date();
  const maxAgeMs = 7 * 24 * 60 * 60 * 1000; // 7 days
  if (apiDate) {
    const ageMs = now - apiDate;
    const ageDays = Math.round(ageMs / (24 * 60 * 60 * 1000));
    if (ageMs > maxAgeMs) {
      console.warn(`API data is ${ageDays} days old (dated ${data.date}). Data may be stale.`);
      console.warn("Consider updating manually. Proceeding with API data anyway.");
    } else {
      console.log(`API data is ${ageDays} day(s) old. Within freshness window.`);
    }
  } else {
    console.warn("API response missing date field — cannot verify freshness.");
  }

  const top10 = data.list.slice(0, 10).map((p) => {
    // Guard against zero/missing net worth
    const rawNetWorth = p.networth || 0;
    if (rawNetWorth <= 0) {
      console.warn(`Warning: ${p.name} has net_worth=0 in API response — may be a data issue.`);
    }

    const source = Array.isArray(p.source) ? p.source.join(", ") : (p.source || "");

    const entry = {
      id: p.uri,
      rank: p.rank,
      name: p.name,
      net_worth: Math.round(rawNetWorth * 1e6),
      company: source,
      country: (p.citizenship || "").toUpperCase(),
    };

    // Include daily change data if available
    if (p.change && typeof p.change === "object") {
      if (typeof p.change.pct === "number") {
        entry.daily_change_pct = p.change.pct / 100; // convert pct (e.g. 0.154) to decimal
      }
      if (typeof p.change.value === "number") {
        entry.daily_change_usd = Math.round(p.change.value * 1e6);
      }
    }

    return entry;
  });

  // Validate: abort if all net worths are 0 (API is broken)
  const allZero = top10.every((p) => p.net_worth === 0);
  if (allZero) {
    throw new Error("All billionaire net worths are 0 — API appears to be broken.");
  }

  return {
    last_updated: nowIso(),
    source: "Forbes Real-Time Billionaires (via rtb-api, auto-updated)",
    source_url: "https://realtimebillionaires.de",
    api_date: data.date,
    people: top10,
  };
}

async function write() {
  let dataset;
  let source = "live";

  try {
    dataset = await fetchFromApi();
    console.log("Fetched live data for", dataset.people.length, "billionaires");
    console.log("Top:", dataset.people[0].name, "-", "$" + (dataset.people[0].net_worth / 1e9).toFixed(1) + "B");
  } catch (e) {
    console.warn("API fetch failed, using fallback:", e.message);
    source = "fallback";
    dataset = {
      last_updated: nowIso(),
      source: "Forbes Top 10 Richest People (fallback, static — June 2026)",
      source_url: "https://www.forbes.com/",
      people: FALLBACK,
    };
  }

  const json = JSON.stringify(dataset, null, 2) + "\n";
  for (const outputPath of OUTPUT_PATHS) {
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, json, "utf8");
    console.log("Wrote", outputPath, "(" + source + ")");
  }
}

console.log("Billionaire updater running...");
write().catch((e) => {
  console.error("Fatal error:", e);
  process.exit(1);
});
