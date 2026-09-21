#!/usr/bin/env node
/**
 * Data freshness reporter for CI.
 *
 * Reads the committed snapshots, prints a markdown report, appends it to the
 * GitHub step summary, and emits ::warning:: annotations for stale or
 * suspicious datasets.
 *
 * IMPORTANT: without --strict this exits non-zero only when a snapshot is
 * missing or unparseable. A stale-but-valid snapshot must NOT fail the job —
 * if this step fails, the "Commit updated snapshots" step is skipped and the
 * data never refreshes. That exact bug froze the live site for three months.
 *
 * With --strict (run as the final workflow step, after the commit) genuinely
 * dead datasets DO fail the run, so silent staleness turns into a red build.
 */

const fs = require("node:fs");
const path = require("node:path");

const PROJECT_ROOT = path.resolve(__dirname, "..");
const PEOPLE_PATH = path.join(PROJECT_ROOT, "app", "data", "richest_people.json");
const ITEMS_PATH = path.join(PROJECT_ROOT, "app", "data", "cpi_items.json");

const MAX_AGE_HOURS = 36; // workflow runs twice daily; anything older is suspicious
const STRICT = process.argv.includes("--strict");
const fatal = [];

function readJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (e) {
    console.error(`::error::Cannot read ${filePath}: ${e.message}`);
    process.exit(1);
  }
}

function ageHours(isoString) {
  const t = Date.parse(isoString);
  if (!Number.isFinite(t)) return null;
  return (Date.now() - t) / 36e5;
}

function fmtAge(isoString) {
  const h = ageHours(isoString);
  if (h === null) return "unknown";
  if (h < 1) return "<1h";
  if (h < 48) return `${h.toFixed(1)}h`;
  return `${(h / 24).toFixed(1)}d`;
}

function fmtMoney(n) {
  if (!Number.isFinite(n) || n <= 0) return "n/a";
  return `$${(n / 1e9).toFixed(1)}B`;
}

const lines = [];
const warnings = [];

// --- Billionaires -----------------------------------------------------------
const people = readJson(PEOPLE_PATH);
const personList = Array.isArray(people.people) ? people.people : [];
const peopleAge = ageHours(people.last_updated);

lines.push("| Dataset | Last Updated | Age | Source | Status |");
lines.push("|---------|--------------|-----|--------|--------|");
lines.push(
  `| Billionaires | ${people.last_updated || "unknown"} | ${fmtAge(people.last_updated)} | ${people.source || "unknown"} | ${
    people.stale ? "**STALE (fallback data)**" : "live"
  } |`
);

if (personList.length === 0) {
  warnings.push("Billionaire dataset has no entries.");
  fatal.push("Billionaire dataset is empty.");
} else {
  const top = personList[0];
  lines.push(`| Top-ranked | ${top.name} (#${top.rank}) ${fmtMoney(top.net_worth)} | — | — | ${personList.length} entries |`);

  if (personList.length < 10) warnings.push(`Billionaire dataset has only ${personList.length} entries (expected 10).`);

  const unordered = personList.some((p, i) => i > 0 && p.net_worth > personList[i - 1].net_worth);
  if (unordered) warnings.push("Billionaire list is not sorted by net worth descending.");

  const badRank = personList.some((p, i) => p.rank !== i + 1);
  if (badRank) warnings.push("Billionaire ranks are not sequential from 1.");

  const missingCountry = personList.filter((p) => !p.country).length;
  if (missingCountry > 0) warnings.push(`${missingCountry}/${personList.length} billionaires have no country.`);
}

if (people.stale) {
  warnings.push("Billionaire data came from the static fallback — Forbes API was unreachable.");
  fatal.push("Billionaire data is flagged stale (Forbes API unreachable).");
}
if (peopleAge !== null && peopleAge > MAX_AGE_HOURS) {
  warnings.push(`Billionaire data is ${fmtAge(people.last_updated)} old (threshold ${MAX_AGE_HOURS}h).`);
  fatal.push(`Billionaire data is ${fmtAge(people.last_updated)} old — the pipeline is not refreshing it.`);
}

// --- Items ------------------------------------------------------------------
const items = readJson(ITEMS_PATH);
const itemList = Array.isArray(items.items) ? items.items : [];
const stats = items.stats || {};
const itemsAge = ageHours(items.last_updated);

lines.push(
  `| Items | ${items.last_updated || "unknown"} | ${fmtAge(items.last_updated)} | ${items.source || "unknown"} | ${
    stats.bls_fresh ? "live BLS" : "**fallback prices**"
  } |`
);
lines.push(
  `| Item stats | ${stats.total_items || itemList.length} total, ${stats.bls_live_items || 0} live BLS, ${
    stats.curated_items || 0
  } curated | — | — | ${stats.bls_mapped_items || 0} mapped series |`
);

// BLS coverage: how many mapped items actually got an official price, and how
// old the published reference month is.
const blsMapped = stats.bls_mapped_items || 0;
const blsLive = stats.bls_live_items || 0;
if (items.bls_reference_period) {
  lines.push(
    `| BLS reference period | ${items.bls_reference_period} | — | — | ${blsLive}/${blsMapped} mapped series live |`
  );
}
if (blsMapped > 0 && blsLive < blsMapped) {
  const missing = Array.isArray(stats.bls_series_unavailable) ? stats.bls_series_unavailable : [];
  warnings.push(
    `${blsMapped - blsLive} of ${blsMapped} BLS-mapped items fell back to curated prices${
      missing.length ? ": " + missing.join(", ") : ""
    }.`
  );
}

// What is NOT official is reported plainly, so the "live BLS" status on the
// line above cannot be read as "the whole dataset is sourced".
lines.push(
  `| Estimated prices | ${stats.curated_items || 0} curated | — | no official series exists | ${
    stats.estimated_grocery_items || 0
  } everyday-goods items estimated |`
);

const reviewDue = Array.isArray(stats.review_due_stale_sources) ? stats.review_due_stale_sources : [];
if (reviewDue.length > 0) {
  lines.push(
    `| Stale vintages | — | — | source label ≥2 years old | ${reviewDue.length}: ${reviewDue.join(", ")} |`
  );
}

const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
if (items.bls_reference_period) {
  const m = /^(\d{4})-([A-Za-z]+)$/.exec(items.bls_reference_period);
  if (m) {
    const mi = MONTHS.indexOf(m[2]);
    if (mi >= 0) {
      const ageMonths = (new Date().getUTCFullYear() - Number(m[1])) * 12 + (new Date().getUTCMonth() - mi);
      // BLS publishes the prior month's average price mid-month, so one month
      // behind is normal and two is the edge of acceptable.
      if (ageMonths > 2) {
        warnings.push(`BLS reference period ${items.bls_reference_period} is ${ageMonths} months old — the BLS fetch is likely failing.`);
      }
    }
  }
}

if (itemList.length === 0) {
  warnings.push("Item dataset has no entries.");
  fatal.push("Item dataset is empty.");
}
if (stats.bls_fresh === false) warnings.push("BLS price data unavailable — items are using fallback prices.");
if (itemsAge !== null && itemsAge > MAX_AGE_HOURS) {
  warnings.push(`Item data is ${fmtAge(items.last_updated)} old (threshold ${MAX_AGE_HOURS}h).`);
  fatal.push(`Item data is ${fmtAge(items.last_updated)} old — the pipeline is not refreshing it.`);
}

// --- Output -----------------------------------------------------------------
const report = ["## Data Freshness Report", "", ...lines, ""];
for (const w of warnings) report.push(`- ⚠️ ${w}`);
if (warnings.length === 0) report.push("- ✅ All datasets fresh and well-formed.");

const text = report.join("\n") + "\n";
console.log(text);

if (process.env.GITHUB_STEP_SUMMARY) {
  fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, text, "utf8");
}
for (const w of warnings) console.log(`::warning::${w}`);

if (STRICT && fatal.length > 0) {
  for (const f of fatal) console.error(`::error::${f}`);
  console.error(`::error::Data pipeline is not refreshing. ${fatal.length} fatal condition(s).`);
  process.exit(1);
}
