#!/usr/bin/env node
const fs = require("node:fs");
const path = require("node:path");
const https = require("node:https");

const PROJECT_ROOT = path.resolve(__dirname, "..");
const OUTPUT_PATHS = [
  path.join(PROJECT_ROOT, "app", "data", "cpi_items.json"),
  path.join(PROJECT_ROOT, "data", "cpi_items.json"),
];

function nowIso() {
  return new Date().toISOString();
}

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, {
      headers: { "User-Agent": "spend-wealth-app/1.0" },
      timeout: 10000,
    }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return fetchJson(res.headers.location).then(resolve, reject);
      }
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        try { resolve(JSON.parse(data)); }
        catch (e) { reject(new Error("Invalid JSON from " + url)); }
      });
    });
    req.on("error", reject);
    req.on("timeout", () => { req.destroy(); reject(new Error("Timeout: " + url)); });
  });
}

// BLS Average Retail Food and Energy Prices API (public, no key)
// Uses latest-month value (data[0]) — most representative of current prices.
// Fallback values below are updated manually from BLS/FRED/USDA data
// as of June 2026. They should be reviewed quarterly.
async function fetchBlsPrices() {
  try {
    const url = "https://api.bls.gov/publicAPI/v2/timeseries/data/";
    const series = [
      "APU0000708111", // Bread, white, pan, per lb.
      "APU0000709112", // Eggs, grade A, large, per doz.
      "APU0000709111", // Milk, fresh, whole, fortified, per gal.
      "APU0000701312", // Rice, white, long grain, uncooked, per lb.
      "APU0000701111", // Bananas, per lb.
      "APU0000706111", // Chicken, fresh, whole, per lb.
      "APU0000703112", // Ground beef, 100% beef, per lb.
      "APU0000717311", // Coffee, 100%, ground roast, all sizes, per lb.
      "APU0000704211", // Butter, salted, grade AA, per lb.
      "APU0000711111", // Apples, Red Delicious, per lb.
      "APU0000703212", // Cheddar cheese, natural, per lb.
      "APU0000SEHA01", // Utility (piped) gas per therm
      "APU0000FF1101", // Chicken breast, boneless, per lb.
    ];

    const body = JSON.stringify({
      seriesid: series,
      startyear: "2025",
      endyear: "2026",
      registrationkey: undefined,
    });

    const data = await new Promise((resolve, reject) => {
      const req = https.request(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(body) },
        timeout: 10000,
      }, (res) => {
        let d = "";
        res.on("data", (c) => (d += c));
        res.on("end", () => {
          try { resolve(JSON.parse(d)); }
          catch (e) { reject(e); }
        });
      });
      req.on("error", reject);
      req.write(body);
      req.end();
    });

    if (data.status !== "REQUEST_SUCCEEDED" || !data.Results) {
      throw new Error("BLS API error: " + (data.message || "unknown"));
    }

    const prices = {};
    for (const s of data.Results.series) {
      // data[0] is the latest month — most representative of current price
      const latest = s.data[0];
      if (latest) {
        const v = parseFloat(latest.value);
        if (!isNaN(v) && v > 0) {
          prices[s.seriesID] = v;
        }
      }
    }

    console.log("BLS: fetched", Object.keys(prices).length, "price series");
    return prices;
  } catch (e) {
    console.warn("BLS fetch failed, using fallback prices:", e.message);
    return null;
  }
}

async function buildDataset() {
  const bls = await fetchBlsPrices();

  // Helper: get BLS latest-month price or fallback
  // Fallbacks = BLS/FRED/USDA latest known values as of June 2026
  const bp = (seriesId, fallback) => {
    return bls && bls[seriesId] ? bls[seriesId] : fallback;
  };

  // Current average rent (Zillow Observed Rent Index, early 2026: ~$2,150)
  const avgRent = 2150;
  // Current electricity avg (EIA Jan 2026: $0.17/kWh)
  const avgElectricity = 0.17;
  // Health insurance avg (KFF 2025: ~$560/mo individual)
  const avgHealthInsurance = 560;

  // Track which items need periodic manual review (no BLS series)
  // These should be verified against current retail data every ~90 days.
  const MANUAL_REVIEW_ITEMS = [
    "potatoes_lb", "apple_lb", "cheese_lb", "onions_lb", "tomatoes_lb",
    "cereal_box", "peanut_butter_jar", "water_bottle_case", "toilet_paper_12",
    "toothpaste", "soap_bar", "shampoo_bottle", "pasta_lb", "cooking_oil",
    "frozen_pizza", "fast_food_meal", "restaurant_dinner_two",
    "orange_juice_gallon", "frozen_vegetables", "canned_tuna", "canned_beans",
    "flour_5lb", "sugar_4lb", "salt_26oz", "black_pepper", "hot_dog_buns",
    "ketchup", "mustard", "mayonnaise", "soy_sauce", "olive_oil",
    "yogurt_cup", "ice_cream_half_gallon", "chocolate_bar", "chips_bag",
    "popcorn", "soda_12pack", "energy_drink", "sports_drink",
    "beer_6pack", "wine_bottle", "cigarettes_pack",
  ];

  return {
    last_updated: nowIso(),
    source: bls
      ? "Live BLS Average Retail Prices (latest month) + curated estimates"
      : "Curated estimates (BLS unavailable)",
    source_url: bls
      ? "https://www.bls.gov/regions/mid-atlantic/data/AverageRetailFoodAndEnergyPrices_USandWest_Table.htm"
      : "https://www.bls.gov/",
    freshness: bls ? "live | curated" : "curated | fallback",
    stats: {
      total_items: 0,
      bls_live_items: 0,
      curated_items: 0,
      needs_manual_review: MANUAL_REVIEW_ITEMS.length,
      manual_review_ids: MANUAL_REVIEW_ITEMS,
    },
    items: [
      // ── Essentials (food & groceries) ──
      // BLS latest-month prices (June 2026 or most recent available):
      { id: "bread_white_pan", name: "White Bread (1 loaf)", price: bp("APU0000708111", 2.19), category: "essentials", source_type: bls ? "bls_latest" : "curated_jun2026", unit: "per loaf" },
      { id: "eggs_dozen", name: "Eggs, Grade A (1 dozen)", price: bp("APU0000709112", 4.22), category: "essentials", source_type: bls ? "bls_latest" : "curated_jun2026", unit: "per dozen" },
      { id: "milk_gallon", name: "Whole Milk (1 gallon)", price: bp("APU0000709111", 4.22), category: "essentials", source_type: bls ? "bls_latest" : "curated_jun2026", unit: "per gallon" },
      { id: "rice_long_grain", name: "White Rice (1 lb)", price: bp("APU0000701312", 1.07), category: "essentials", source_type: bls ? "bls_latest" : "curated_jun2026", unit: "per lb" },
      { id: "bananas_lb", name: "Bananas (1 lb)", price: bp("APU0000701111", 0.54), category: "essentials", source_type: bls ? "bls_latest" : "curated_jun2026", unit: "per lb" },
      { id: "chicken_whole_lb", name: "Whole Chicken (1 lb)", price: bp("APU0000706111", 2.04), category: "essentials", source_type: bls ? "bls_latest" : "curated_jun2026", unit: "per lb" },
      { id: "ground_beef_lb", name: "Ground Beef (1 lb)", price: bp("APU0000703112", 6.75), category: "essentials", source_type: bls ? "bls_latest" : "curated_jun2026", unit: "per lb" },
      { id: "coffee_grounds_lb", name: "Coffee (1 lb)", price: bp("APU0000717311", 9.51), category: "essentials", source_type: bls ? "bls_latest" : "curated_jun2026", unit: "per lb" },
      { id: "butter_lb", name: "Butter (1 lb)", price: bp("APU0000704211", 4.91), category: "essentials", source_type: bls ? "bls_latest" : "curated_jun2026", unit: "per lb" },
      { id: "chicken_breast_lb", name: "Chicken Breast, Boneless (1 lb)", price: bp("APU0000FF1101", 4.17), category: "essentials", source_type: bls ? "bls_latest" : "curated_jun2026", unit: "per lb" },
      // BLS has no data for these — curated from USDA/retail surveys June 2026:
      { id: "potatoes_lb", name: "Potatoes (1 lb)", price: 0.75, category: "essentials", source_type: "usda_retail_jun2026", unit: "per lb" },
      { id: "apple_lb", name: "Apples (1 lb)", price: 1.31, category: "essentials", source_type: "usda_retail_jun2026", unit: "per lb" },
      { id: "cheese_lb", name: "Cheddar Cheese (1 lb)", price: 6.03, category: "essentials", source_type: "usda_retail_jun2026", unit: "per lb" },
      // Market estimates (no BLS series available):
      { id: "cereal_box", name: "Box of Cereal", price: 4.50, category: "essentials", source_type: "market_estimate", unit: "per box" },
      { id: "peanut_butter_jar", name: "Peanut Butter (16 oz)", price: 3.50, category: "essentials", source_type: "market_estimate", unit: "per jar" },
      { id: "water_bottle_case", name: "Bottled Water (24 pack)", price: 5.00, category: "essentials", source_type: "market_estimate", unit: "per case" },
      { id: "toilet_paper_12", name: "Toilet Paper (12 rolls)", price: 8.00, category: "essentials", source_type: "market_estimate", unit: "per pack" },
      { id: "toothpaste", name: "Toothpaste (tube)", price: 4.00, category: "essentials", source_type: "market_estimate", unit: "each" },
      { id: "soap_bar", name: "Bar of Soap", price: 1.50, category: "essentials", source_type: "market_estimate", unit: "each" },
      { id: "shampoo_bottle", name: "Shampoo (12 oz)", price: 6.00, category: "essentials", source_type: "market_estimate", unit: "per bottle" },
      { id: "pasta_lb", name: "Spaghetti / Pasta (1 lb)", price: 1.50, category: "essentials", source_type: "market_estimate", unit: "per lb" },
      { id: "cooking_oil", name: "Vegetable Cooking Oil (48 oz)", price: 4.50, category: "essentials", source_type: "market_estimate", unit: "per bottle" },
      { id: "onions_lb", name: "Onions (1 lb)", price: 1.27, category: "essentials", source_type: "usda_retail_jun2026", unit: "per lb" },
      { id: "tomatoes_lb", name: "Tomatoes (1 lb)", price: 2.50, category: "essentials", source_type: "market_estimate", unit: "per lb" },
      { id: "frozen_pizza", name: "Frozen Pizza (large)", price: 5.00, category: "essentials", source_type: "market_estimate", unit: "each" },
      { id: "fast_food_meal", name: "Fast Food Meal (combo)", price: 12.00, category: "essentials", source_type: "market_estimate", unit: "per meal" },
      { id: "restaurant_dinner_two", name: "Restaurant Dinner (mid-range, 2 people)", price: 75.00, category: "essentials", source_type: "market_estimate", unit: "per dinner" },
      { id: "orange_juice_gallon", name: "Orange Juice (1 gallon)", price: 6.50, category: "essentials", source_type: "market_estimate", unit: "per gallon" },
      { id: "frozen_vegetables", name: "Frozen Vegetables (1 lb bag)", price: 2.00, category: "essentials", source_type: "market_estimate", unit: "per bag" },
      { id: "canned_tuna", name: "Canned Tuna (5 oz)", price: 1.50, category: "essentials", source_type: "market_estimate", unit: "per can" },
      { id: "canned_beans", name: "Canned Beans (15 oz)", price: 1.20, category: "essentials", source_type: "market_estimate", unit: "per can" },
      { id: "flour_5lb", name: "All-Purpose Flour (5 lb)", price: 4.50, category: "essentials", source_type: "market_estimate", unit: "per bag" },
      { id: "sugar_4lb", name: "Granulated Sugar (4 lb)", price: 3.50, category: "essentials", source_type: "market_estimate", unit: "per bag" },
      { id: "salt_26oz", name: "Table Salt (26 oz)", price: 1.50, category: "essentials", source_type: "market_estimate", unit: "per container" },
      { id: "black_pepper", name: "Black Pepper (4 oz)", price: 5.00, category: "essentials", source_type: "market_estimate", unit: "per container" },
      { id: "hot_dog_buns", name: "Hot Dog Buns (8-pack)", price: 2.50, category: "essentials", source_type: "market_estimate", unit: "per pack" },
      { id: "ketchup", name: "Ketchup (20 oz)", price: 3.00, category: "essentials", source_type: "market_estimate", unit: "per bottle" },
      { id: "mustard", name: "Yellow Mustard (14 oz)", price: 2.00, category: "essentials", source_type: "market_estimate", unit: "per bottle" },
      { id: "mayonnaise", name: "Mayonnaise (30 oz)", price: 4.50, category: "essentials", source_type: "market_estimate", unit: "per jar" },
      { id: "soy_sauce", name: "Soy Sauce (15 oz)", price: 3.50, category: "essentials", source_type: "market_estimate", unit: "per bottle" },
      { id: "olive_oil", name: "Extra Virgin Olive Oil (16 oz)", price: 8.00, category: "essentials", source_type: "market_estimate", unit: "per bottle" },
      { id: "yogurt_cup", name: "Yogurt (32 oz tub)", price: 5.50, category: "essentials", source_type: "market_estimate", unit: "per tub" },
      { id: "ice_cream_half_gallon", name: "Ice Cream (half gallon)", price: 5.00, category: "essentials", source_type: "market_estimate", unit: "per carton" },
      { id: "chocolate_bar", name: "Chocolate Bar (Hershey's, 1.55 oz)", price: 1.50, category: "essentials", source_type: "market_estimate", unit: "per bar" },
      { id: "chips_bag", name: "Potato Chips (8 oz bag)", price: 4.50, category: "essentials", source_type: "market_estimate", unit: "per bag" },
      { id: "popcorn", name: "Microwave Popcorn (3-pack)", price: 3.50, category: "essentials", source_type: "market_estimate", unit: "per pack" },
      { id: "soda_12pack", name: "Soda (12-pack cans)", price: 6.00, category: "essentials", source_type: "market_estimate", unit: "per 12-pack" },
      { id: "energy_drink", name: "Energy Drink (16 oz can)", price: 3.00, category: "essentials", source_type: "market_estimate", unit: "per can" },
      { id: "sports_drink", name: "Sports Drink (20 oz)", price: 2.00, category: "essentials", source_type: "market_estimate", unit: "per bottle" },
      { id: "beer_6pack", name: "Beer (6-pack domestic)", price: 9.00, category: "essentials", source_type: "market_estimate", unit: "per 6-pack" },
      { id: "wine_bottle", name: "Wine (mid-range, 750ml)", price: 12.00, category: "essentials", source_type: "market_estimate", unit: "per bottle" },
      { id: "cigarettes_pack", name: "Cigarettes (1 pack)", price: 8.00, category: "essentials", source_type: "market_estimate", unit: "per pack" },

      // ── Housing & Utilities ──
      { id: "rent_month", name: "One Month Rent (avg US)", price: avgRent, category: "housing", source_type: "zillow_2026", unit: "monthly" },
      { id: "electricity_kwh", name: "Electricity (1 kWh)", price: avgElectricity, category: "housing", source_type: "eia_2026", unit: "per kWh" },
      { id: "natural_gas_therm", name: "Natural Gas (1 therm)", price: bp("APU0000SEHA01", 1.50), category: "housing", source_type: bls ? "bls_latest" : "curated_jun2026", unit: "per therm" },
      { id: "internet_monthly", name: "Home Internet (monthly)", price: 75, category: "housing", source_type: "market_estimate", unit: "monthly" },
      { id: "phone_plan_monthly", name: "Phone Plan (monthly)", price: 75, category: "housing", source_type: "market_estimate", unit: "monthly" },
      { id: "mattress_queen", name: "Queen Mattress", price: 800, category: "housing", source_type: "market_estimate", unit: "each" },
      { id: "couch", name: "Couch", price: 1200, category: "housing", source_type: "market_estimate", unit: "each" },
      { id: "washer_dryer", name: "Washer & Dryer Set", price: 1500, category: "housing", source_type: "market_estimate", unit: "per set" },
      { id: "water_sewer_monthly", name: "Water & Sewer Bill (monthly)", price: 65, category: "housing", source_type: "market_estimate", unit: "monthly" },
      { id: "home_insurance_annual", name: "Homeowner's Insurance (annual)", price: 1800, category: "housing", source_type: "market_estimate", unit: "per year" },
      { id: "property_tax_annual", name: "Property Tax (annual, avg US home)", price: 4200, category: "housing", source_type: "census_2025", unit: "per year" },
      { id: "dining_table", name: "Dining Table (seats 6)", price: 600, category: "housing", source_type: "market_estimate", unit: "each" },
      { id: "bed_frame_queen", name: "Bed Frame (queen)", price: 400, category: "housing", source_type: "market_estimate", unit: "each" },
      { id: "dresser", name: "Dresser (6-drawer)", price: 350, category: "housing", source_type: "market_estimate", unit: "each" },
      { id: "desk", name: "Office Desk", price: 300, category: "housing", source_type: "market_estimate", unit: "each" },
      { id: "office_chair", name: "Office Chair (ergonomic)", price: 250, category: "housing", source_type: "market_estimate", unit: "each" },
      { id: "vacuum_cleaner", name: "Vacuum Cleaner", price: 200, category: "housing", source_type: "market_estimate", unit: "each" },
      { id: "microwave", name: "Microwave Oven", price: 150, category: "housing", source_type: "market_estimate", unit: "each" },
      { id: "toaster", name: "Toaster", price: 40, category: "housing", source_type: "market_estimate", unit: "each" },
      { id: "coffeemaker", name: "Coffeemaker (drip, 12-cup)", price: 60, category: "housing", source_type: "market_estimate", unit: "each" },
      { id: "blender", name: "Blender", price: 50, category: "housing", source_type: "market_estimate", unit: "each" },
      { id: "iron", name: "Clothes Iron", price: 35, category: "housing", source_type: "market_estimate", unit: "each" },
      { id: "hair_dryer", name: "Hair Dryer", price: 30, category: "housing", source_type: "market_estimate", unit: "each" },

      // ── Health ──
      { id: "doctor_visit", name: "Doctor Visit (copay)", price: 150, category: "health", source_type: "curated_2026", unit: "per visit" },
      { id: "dentist_visit", name: "Dentist Cleaning", price: 200, category: "health", source_type: "curated_2026", unit: "per visit" },
      { id: "er_visit", name: "ER Visit (avg)", price: 2200, category: "health", source_type: "curated_2026", unit: "per visit" },
      { id: "prescription_monthly", name: "Monthly Prescription", price: 50, category: "health", source_type: "curated_2026", unit: "monthly" },
      { id: "health_insurance_monthly", name: "Health Insurance (monthly)", price: avgHealthInsurance, category: "health", source_type: "kff_2025", unit: "monthly" },
      { id: "glasses_pair", name: "Prescription Glasses", price: 200, category: "health", source_type: "market_estimate", unit: "per pair" },
      { id: "therapy_session", name: "Therapy Session", price: 150, category: "health", source_type: "curated_2026", unit: "per session" },
      { id: "otc_medicine", name: "OTC Pain Reliever (ibuprofen, 100ct)", price: 12, category: "health", source_type: "market_estimate", unit: "per bottle" },
      { id: "vitamins", name: "Multivitamin (60ct)", price: 15, category: "health", source_type: "market_estimate", unit: "per bottle" },
      { id: "urgent_care_visit", name: "Urgent Care Visit", price: 250, category: "health", source_type: "curated_2026", unit: "per visit" },
      { id: "ambulance_ride", name: "Ambulance Ride (avg)", price: 1200, category: "health", source_type: "curated_2026", unit: "per ride" },

      // ── Education ──
      { id: "college_semester", name: "College Semester (in-state)", price: 12000, category: "education", source_type: "curated_2026", unit: "per semester" },
      { id: "textbook", name: "College Textbook", price: 120, category: "education", source_type: "market_estimate", unit: "per book" },
      { id: "student_loan_avg", name: "Avg Student Loan Payment (monthly)", price: 500, category: "education", source_type: "curated_2026", unit: "monthly" },
      { id: "community_college_course", name: "Community College Course", price: 1500, category: "education", source_type: "curated_2026", unit: "per course" },
      { id: "coding_bootcamp", name: "Coding Bootcamp", price: 15000, category: "education", source_type: "market_estimate", unit: "total" },
      { id: "kindergarten_year", name: "Private Kindergarten (1 year)", price: 12000, category: "education", source_type: "curated_2026", unit: "per year" },

      // ── Transportation ──
      { id: "gas_regular_gallon", name: "Gasoline, Regular (1 gallon)", price: 3.55, category: "transportation", source_type: "aaa_2026_avg", unit: "per gallon" },
      { id: "car_payment_monthly", name: "Avg Car Payment (monthly)", price: 730, category: "transportation", source_type: "curated_2026", unit: "monthly" },
      { id: "car_insurance_monthly", name: "Car Insurance (monthly)", price: 200, category: "transportation", source_type: "curated_2026", unit: "monthly" },
      { id: "uber_ride", name: "Uber Ride (avg 5 mi)", price: 20, category: "transportation", source_type: "market_estimate", unit: "per ride" },
      { id: "domestic_flight", name: "Domestic Flight (avg)", price: 350, category: "transportation", source_type: "market_estimate", unit: "one-way" },
      { id: "train_pass_monthly", name: "Monthly Train Pass", price: 150, category: "transportation", source_type: "market_estimate", unit: "monthly" },
      { id: "bus_fare", name: "Bus Fare (single ride)", price: 2.50, category: "transportation", source_type: "market_estimate", unit: "per ride" },
      { id: "bicycle", name: "Bicycle (basic commuter)", price: 350, category: "transportation", source_type: "market_estimate", unit: "each" },

      // ── Stability ──
      { id: "used_car", name: "Used Reliable Car", price: 15000, category: "stability", source_type: "curated_2026", unit: "one-time" },
      { id: "new_car", name: "New Mid-Range Car", price: 38000, category: "stability", source_type: "curated_2026", unit: "one-time" },
      { id: "emergency_fund", name: "Emergency Fund (3 months)", price: 9000, category: "stability", source_type: "curated_2026", unit: "one-time" },
      { id: "down_payment_house", name: "House Down Payment (20%)", price: 80000, category: "stability", source_type: "curated_2026", unit: "one-time" },

      // ── Entertainment ──
      { id: "movie_ticket", name: "Movie Ticket", price: 15, category: "entertainment", source_type: "market_estimate", unit: "per ticket" },
      { id: "netflix_monthly", name: "Netflix (monthly)", price: 15.50, category: "entertainment", source_type: "market_price", unit: "monthly" },
      { id: "spotify_monthly", name: "Spotify (monthly)", price: 11, category: "entertainment", source_type: "market_price", unit: "monthly" },
      { id: "video_game", name: "Video Game (new release)", price: 70, category: "entertainment", source_type: "market_estimate", unit: "per game" },
      { id: "concert_ticket", name: "Concert Ticket (avg)", price: 120, category: "entertainment", source_type: "market_estimate", unit: "per ticket" },
      { id: "disney_family", name: "Disney World (family of 4)", price: 6000, category: "entertainment", source_type: "market_estimate", unit: "per trip" },
      { id: "gym_membership_monthly", name: "Gym Membership (monthly)", price: 50, category: "entertainment", source_type: "market_estimate", unit: "monthly" },
      { id: "book_paperback", name: "Paperback Book", price: 16, category: "entertainment", source_type: "market_estimate", unit: "each" },
      { id: "board_game", name: "Board Game", price: 35, category: "entertainment", source_type: "market_estimate", unit: "each" },
      { id: "hulu_monthly", name: "Hulu (monthly, no ads)", price: 18, category: "entertainment", source_type: "market_price", unit: "monthly" },
      { id: "disney_plus_monthly", name: "Disney+ (monthly)", price: 10, category: "entertainment", source_type: "market_price", unit: "monthly" },

      // ── Tech ──
      { id: "iphone_16", name: "iPhone 16", price: 800, category: "tech", source_type: "market_price", unit: "each" },
      { id: "macbook_air", name: "MacBook Air", price: 1100, category: "tech", source_type: "market_price", unit: "each" },
      { id: "ps5_console", name: "PlayStation 5", price: 500, category: "tech", source_type: "market_price", unit: "each" },
      { id: "samsung_tv_65", name: 'Samsung 65" 4K TV', price: 800, category: "tech", source_type: "market_price", unit: "each" },
      { id: "airpods_pro", name: "AirPods Pro", price: 250, category: "tech", source_type: "market_price", unit: "per pair" },
      { id: "ipad", name: "iPad (base)", price: 350, category: "tech", source_type: "market_price", unit: "each" },

      // ── Clothing ──
      { id: "jeans", name: "Pair of Jeans", price: 50, category: "clothing", source_type: "market_estimate", unit: "per pair" },
      { id: "sneakers", name: "Running Sneakers", price: 130, category: "clothing", source_type: "market_estimate", unit: "per pair" },
      { id: "winter_coat", name: "Winter Coat", price: 150, category: "clothing", source_type: "market_estimate", unit: "each" },
      { id: "dress_shirt", name: "Dress Shirt", price: 60, category: "clothing", source_type: "market_estimate", unit: "each" },
      { id: "nikes", name: "Nike Air Jordans", price: 200, category: "clothing", source_type: "market_estimate", unit: "per pair" },
      { id: "luxury_watch", name: "Rolex Submariner", price: 10000, category: "clothing", source_type: "market_estimate", unit: "each" },

      // ── Luxury ──
      { id: "rolex_daydate", name: "Rolex Day-Date", price: 40000, category: "luxury", source_type: "market_price", unit: "each" },
      { id: "tesla_model_s", name: "Tesla Model S", price: 80000, category: "luxury", source_type: "market_price", unit: "each" },
      { id: "bmw_7series", name: "BMW 7 Series", price: 115000, category: "luxury", source_type: "market_price", unit: "each" },
      { id: "lamborghini_huracan", name: "Lamborghini Huracán", price: 250000, category: "luxury", source_type: "market_price", unit: "each" },
      { id: "bugatti_chiron", name: "Bugatti Chiron", price: 3000000, category: "luxury", source_type: "market_price", unit: "each" },
      { id: "mansion_beverly_hills", name: "Beverly Hills Mansion", price: 30000000, category: "luxury", source_type: "market_estimate", unit: "each" },
      { id: "private_jet", name: "Private Jet (Gulfstream)", price: 65000000, category: "luxury", source_type: "market_estimate", unit: "each" },
      { id: "superyacht", name: "Superyacht (150 ft)", price: 150000000, category: "luxury", source_type: "market_estimate", unit: "each" },
      { id: "nba_team", name: "NBA Team (avg franchise)", price: 3500000000, category: "luxury", source_type: "forbes_estimate", unit: "each" },
      { id: "private_island", name: "Private Island (Caribbean)", price: 50000000, category: "luxury", source_type: "market_estimate", unit: "each" },
      { id: "art_masterpiece", name: "Famous Painting (auction avg)", price: 100000000, category: "luxury", source_type: "market_estimate", unit: "each" },
      { id: "skyscraper_nyc", name: "NYC Skyscraper", price: 2000000000, category: "luxury", source_type: "market_estimate", unit: "each" },

      // ── Personal & Household ──
      { id: "laundry_detergent", name: "Laundry Detergent (100 oz)", price: 12, category: "personal", source_type: "market_estimate", unit: "per bottle" },
      { id: "dish_soap", name: "Dish Soap (24 oz)", price: 4, category: "personal", source_type: "market_estimate", unit: "per bottle" },
      { id: "light_bulbs", name: "LED Light Bulbs (4-pack)", price: 8, category: "personal", source_type: "market_estimate", unit: "per pack" },
      { id: "batteries_aa", name: "AA Batteries (8-pack)", price: 7, category: "personal", source_type: "market_estimate", unit: "per pack" },
      { id: "razor_refill", name: "Razor Blade Refill (8-pack)", price: 25, category: "personal", source_type: "market_estimate", unit: "per pack" },
      { id: "sunscreen", name: "Sunscreen (SPF 50, 3 oz)", price: 12, category: "personal", source_type: "market_estimate", unit: "per bottle" },

      // ── Childcare ──
      { id: "diapers_box", name: "Diapers (box of 100)", price: 35, category: "childcare", source_type: "market_estimate", unit: "per box" },
      { id: "baby_formula", name: "Baby Formula (30 oz)", price: 32, category: "childcare", source_type: "market_estimate", unit: "per container" },
      { id: "daycare_monthly", name: "Daycare (monthly, avg US)", price: 1300, category: "childcare", source_type: "curated_2026", unit: "monthly" },
      { id: "baby_stroller", name: "Baby Stroller (mid-range)", price: 350, category: "childcare", source_type: "market_estimate", unit: "each" },
      { id: "child_car_seat", name: "Child Car Seat", price: 200, category: "childcare", source_type: "market_estimate", unit: "each" },

      // ── Pets ──
      { id: "dog_food_30lb", name: "Dog Food (30 lb bag)", price: 55, category: "pets", source_type: "market_estimate", unit: "per bag" },
      { id: "cat_food_15lb", name: "Cat Food (15 lb bag)", price: 30, category: "pets", source_type: "market_estimate", unit: "per bag" },
      { id: "pet_vet_visit", name: "Vet Visit (routine checkup)", price: 65, category: "pets", source_type: "market_estimate", unit: "per visit" },
      { id: "pet_vaccinations", name: "Pet Vaccinations (annual)", price: 120, category: "pets", source_type: "market_estimate", unit: "per year" },
      { id: "pet_flea_treatment", name: "Flea/Tick Treatment (6-month)", price: 75, category: "pets", source_type: "market_estimate", unit: "per treatment" },
      { id: "pet_toys", name: "Pet Toys (assorted)", price: 25, category: "pets", source_type: "market_estimate", unit: "per set" },
      { id: "pet_bed", name: "Pet Bed (medium)", price: 40, category: "pets", source_type: "market_estimate", unit: "each" },
      { id: "pet_crate", name: "Pet Crate (medium)", price: 50, category: "pets", source_type: "market_estimate", unit: "each" },
      { id: "pet_grooming", name: "Pet Grooming (basic bath)", price: 50, category: "pets", source_type: "market_estimate", unit: "per session" },
      { id: "pet_boarding_daily", name: "Pet Boarding (per day)", price: 40, category: "pets", source_type: "market_estimate", unit: "per day" },
      { id: "pet_adoption_fee", name: "Pet Adoption Fee (shelter)", price: 150, category: "pets", source_type: "market_estimate", unit: "one-time" },

      // ── Services ──
      { id: "haircut_men", name: "Men's Haircut", price: 30, category: "services", source_type: "market_estimate", unit: "per cut" },
      { id: "haircut_women", name: "Women's Haircut & Style", price: 65, category: "services", source_type: "market_estimate", unit: "per cut" },
      { id: "manicure", name: "Manicure", price: 30, category: "services", source_type: "market_estimate", unit: "per session" },
      { id: "massage_hour", name: "Massage (1 hour)", price: 100, category: "services", source_type: "market_estimate", unit: "per hour" },
      { id: "house_cleaning", name: "House Cleaning (one-time, 3BR)", price: 150, category: "services", source_type: "market_estimate", unit: "per visit" },
      { id: "lawn_care_monthly", name: "Lawn Care (monthly)", price: 100, category: "services", source_type: "market_estimate", unit: "monthly" },
      { id: "plumber_visit", name: "Plumber Visit (1 hour)", price: 150, category: "services", source_type: "market_estimate", unit: "per visit" },
      { id: "electrician_visit", name: "Electrician Visit (1 hour)", price: 150, category: "services", source_type: "market_estimate", unit: "per visit" },
      { id: "auto_oil_change", name: "Car Oil Change", price: 60, category: "services", source_type: "market_estimate", unit: "per change" },
      { id: "auto_tire_rotation", name: "Tire Rotation", price: 50, category: "services", source_type: "market_estimate", unit: "per service" },
      { id: "auto_brake_job", name: "Brake Job (per axle)", price: 350, category: "services", source_type: "market_estimate", unit: "per axle" },
      { id: "auto_new_tire", name: "New Tire (all-season)", price: 150, category: "services", source_type: "market_estimate", unit: "per tire" },
      { id: "dry_cleaning_suit", name: "Dry Cleaning (suit)", price: 20, category: "services", source_type: "market_estimate", unit: "per suit" },
      { id: "laundromat_load", name: "Laundromat (1 load, wash+dry)", price: 6, category: "services", source_type: "market_estimate", unit: "per load" },
      { id: "postage_stamp", name: "Postage Stamp (Forever)", price: 0.68, category: "services", source_type: "usps_2026", unit: "per stamp" },
      { id: "bank_fee_monthly", name: "Bank Monthly Maintenance Fee", price: 12, category: "services", source_type: "market_estimate", unit: "monthly" },
      { id: "credit_card_annual_fee", name: "Credit Card Annual Fee", price: 95, category: "services", source_type: "market_estimate", unit: "per year" },
      { id: "tax_preparation", name: "Tax Preparation (professional)", price: 250, category: "services", source_type: "market_estimate", unit: "per return" },
      { id: "legal_consultation", name: "Legal Consultation (1 hour)", price: 300, category: "services", source_type: "market_estimate", unit: "per hour" },
      { id: "moving_company", name: "Moving Company (local, 2BR)", price: 800, category: "services", source_type: "market_estimate", unit: "per move" },

      // ── Social Impact ──
      { id: "meal_for_one", name: "Meal for One Person", price: 3, category: "social_impact", source_type: "wfp_estimate", unit: "per meal" },
      { id: "end_hunger_1yr", name: "End World Hunger (1 year est.)", price: 33000000000, category: "social_impact", source_type: "un_estimate", unit: "one-time" },
      { id: "clean_water_africa", name: "Clean Water Access for All of Africa", price: 20000000000, category: "social_impact", source_type: "who_estimate", unit: "one-time" },
      { id: "end_homelessness_us", name: "End Homelessness in the US", price: 20000000000, category: "social_impact", source_type: "hud_estimate", unit: "one-time" },
      { id: "universal_prek_us", name: "Universal Pre-K in the US", price: 26000000000, category: "social_impact", source_type: "brookings_estimate", unit: "per year" },
      { id: "malaria_eradication", name: "Eradicate Malaria Globally", price: 5000000000, category: "social_impact", source_type: "gates_foundation", unit: "one-time" },
      { id: "reforest_earth", name: "Reforest 1 Billion Acres", price: 50000000000, category: "social_impact", source_type: "curated_estimate", unit: "one-time" },
      { id: "fund_schools_us", name: "Fully Fund US Public Schools (1 year)", price: 50000000000, category: "social_impact", source_type: "curated_estimate", unit: "per year" },
      { id: "build_hospital", name: "Build a Modern Hospital", price: 500000000, category: "social_impact", source_type: "curated_estimate", unit: "each" },
      { id: "orphan_care_year", name: "Fund Global Orphan Care (1 year)", price: 8000000000, category: "social_impact", source_type: "unicef_estimate", unit: "per year" },
      { id: "free_lunch_k12", name: "Free School Lunch for All US K-12 (1 year)", price: 26000000000, category: "social_impact", source_type: "usda_estimate", unit: "per year" },
      { id: "student_loan_forgiveness", name: "Forgive All US Student Loans", price: 1770000000000, category: "social_impact", source_type: "federal_reserve", unit: "one-time" },
      { id: "opioid_treatment_us", name: "Fund Opioid Treatment for All (US 1yr)", price: 15000000000, category: "social_impact", source_type: "curated_estimate", unit: "per year" },
      { id: "lead_pipe_replacement", name: "Replace All US Lead Pipes", price: 45000000000, category: "social_impact", source_type: "epa_estimate", unit: "one-time" },
      { id: "save_amazon", name: "Protect the Amazon Rainforest (permanent)", price: 100000000000, category: "social_impact", source_type: "curated_estimate", unit: "one-time" },
      { id: "homeless_housing_us", name: "Build Housing for Every US Homeless Person", price: 20000000000, category: "social_impact", source_type: "curated_estimate", unit: "one-time" },
      { id: "teacher_raise_us", name: "Give Every US Teacher a $10K Raise (1 year)", price: 40000000000, category: "social_impact", source_type: "curated_estimate", unit: "per year" },
      { id: "vaccinate_africa", name: "Fully Vaccinate All African Children (1 year)", price: 2000000000, category: "social_impact", source_type: "who_estimate", unit: "per year" },
      { id: "eliminate_mosquito_disease", name: "End All Mosquito-Borne Diseases", price: 12000000000, category: "social_impact", source_type: "gates_foundation", unit: "one-time" },
    ],
  };
}

async function write() {
  console.log("Item updater running...");
  const dataset = await buildDataset();

  // Fill in stats
  const blsItems = dataset.items.filter((i) => i.source_type === "bls_latest");
  dataset.stats.total_items = dataset.items.length;
  dataset.stats.bls_live_items = blsItems.length;
  dataset.stats.curated_items = dataset.items.length - blsItems.length;
  dataset.stats.bls_fresh = !!blsItems.length;

  const json = JSON.stringify(dataset, null, 2) + "\n";
  for (const outputPath of OUTPUT_PATHS) {
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, json, "utf8");
    console.log("Wrote", outputPath);
  }
  console.log(`Items: ${dataset.stats.total_items} (${dataset.stats.bls_live_items} live BLS, ${dataset.stats.curated_items} curated)`);
}

write().catch((e) => {
  console.error("Fatal error:", e);
  process.exit(1);
});
