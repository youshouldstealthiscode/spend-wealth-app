#!/usr/bin/env node
const fs = require("node:fs");
const path = require("node:path");

const PROJECT_ROOT = path.resolve(__dirname, "..");
const OUTPUT_PATHS = [
  path.join(PROJECT_ROOT, "app", "data", "cpi_items.json"),
  path.join(PROJECT_ROOT, "data", "cpi_items.json"),
];

function nowIso() {
  return new Date().toISOString();
}

function buildDataset() {
  return {
    last_updated: nowIso(),
    source: "Hybrid dataset: BLS food prices + EIA/AAA energy estimates + curated essentials",
    source_url:
      "https://www.bls.gov/regions/mid-atlantic/data/AverageRetailFoodAndEnergyPrices_USandWest_Table.htm",
    freshness: "monthly | estimated | market",
    items: [
      { id: "bread_white_pan", name: "White Bread (1 lb)", price: 1.85, category: "essentials", source_type: "bls_average_price", unit: "per lb" },
      { id: "eggs_dozen", name: "Eggs, Grade A Large (1 dozen)", price: 2.5, category: "essentials", source_type: "bls_average_price", unit: "per dozen" },
      { id: "milk_gallon", name: "Whole Milk (1 gallon)", price: 4.03, category: "essentials", source_type: "bls_average_price", unit: "per gallon" },
      { id: "rice_long_grain", name: "White Rice (1 lb)", price: 1.07, category: "essentials", source_type: "bls_average_price", unit: "per lb" },
      { id: "bananas_lb", name: "Bananas (1 lb)", price: 0.65, category: "essentials", source_type: "bls_average_price", unit: "per lb" },
      { id: "potatoes_lb", name: "Potatoes (1 lb)", price: 0.87, category: "essentials", source_type: "bls_average_price", unit: "per lb" },
      { id: "chicken_whole_lb", name: "Whole Chicken (1 lb)", price: 2.05, category: "essentials", source_type: "bls_average_price", unit: "per lb" },
      { id: "gas_regular_gallon", name: "Gasoline, Regular (1 gallon)", price: 3.65, category: "transportation", source_type: "market_estimate", unit: "per gallon" },
      { id: "electricity_kwh", name: "Electricity (1 kWh)", price: 0.23, category: "housing", source_type: "market_estimate", unit: "per kWh" },
      { id: "natural_gas_therm", name: "Natural Gas (1 therm)", price: 2.4, category: "housing", source_type: "market_estimate", unit: "per therm" },
      { id: "rent_month", name: "One Month Rent", price: 2200, category: "housing", source_type: "curated_estimate", unit: "monthly" },
      { id: "doctor_visit", name: "Doctor Visit", price: 150, category: "health", source_type: "curated_estimate", unit: "visit" },
      { id: "used_car", name: "Used Reliable Car", price: 12000, category: "stability", source_type: "curated_estimate", unit: "one-time" },
      { id: "college_semester", name: "College Semester", price: 12000, category: "education", source_type: "curated_estimate", unit: "semester" },
      { id: "private_jet", name: "Private Jet", price: 40000000, category: "luxury", source_type: "curated_estimate", unit: "one-time" }
    ]
  };
}

function write() {
  const json = JSON.stringify(buildDataset(), null, 2) + "\n";
  for (const outputPath of OUTPUT_PATHS) {
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, json, "utf8");
    console.log("Wrote", outputPath);
  }
}

console.log("Item updater running...");
write();
