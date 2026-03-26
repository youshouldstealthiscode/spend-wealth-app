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
  { id: "elon_musk", rank: 1, name: "Elon Musk", net_worth: 839000000000, company: "SpaceX, Tesla, xAI", country: "United States" },
  { id: "larry_page", rank: 2, name: "Larry Page", net_worth: 257000000000, company: "Google", country: "United States" },
  { id: "sergey_brin", rank: 3, name: "Sergey Brin", net_worth: 237000000000, company: "Google", country: "United States" },
  { id: "jeff_bezos", rank: 4, name: "Jeff Bezos", net_worth: 224000000000, company: "Amazon", country: "United States" },
  { id: "mark_zuckerberg", rank: 5, name: "Mark Zuckerberg", net_worth: 222000000000, company: "Meta", country: "United States" },
  { id: "larry_ellison", rank: 6, name: "Larry Ellison", net_worth: 190000000000, company: "Oracle", country: "United States" },
  { id: "bernard_arnault", rank: 7, name: "Bernard Arnault & family", net_worth: 171000000000, company: "LVMH", country: "France" },
  { id: "jensen_huang", rank: 8, name: "Jensen Huang", net_worth: 154000000000, company: "Nvidia", country: "United States" },
  { id: "warren_buffett", rank: 9, name: "Warren Buffett", net_worth: 149000000000, company: "Berkshire Hathaway", country: "United States" },
  { id: "amancio_ortega", rank: 10, name: "Amancio Ortega", net_worth: 148000000000, company: "Zara / Inditex", country: "Spain" },
];

function nowIso() {
  return new Date().toISOString();
}

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { "User-Agent": "spend-wealth-app/1.0" } }, (res) => {
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

  const top10 = data.list.slice(0, 10).map((p) => {
    const source = Array.isArray(p.source) ? p.source.join(", ") : (p.source || "");
    return {
      id: p.uri,
      rank: p.rank,
      name: p.name,
      net_worth: Math.round((p.networth || 0) * 1e6),
      company: source,
      country: (p.citizenship || "").toUpperCase(),
    };
  });

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
      source: "Forbes Top 10 Richest People (fallback, static)",
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
