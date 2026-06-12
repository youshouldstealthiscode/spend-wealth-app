// FILE: js/api.js — Data fetching, exchange rates, init

export async function fetchJson(path) {
  const response = await fetch(path, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Failed to load ${path}: ${response.status} ${response.statusText}`);
  }
  return response.json();
}

export async function fetchExchangeRates(state) {
  try {
    const res = await fetch("https://api.exchangerate.fun/latest?base=USD");
    if (!res.ok) throw new Error(res.status);
    const data = await res.json();
    if (data.rates) {
      state.exchangeRates = data.rates;
      state.ratesLoaded = true;
    }
  } catch (e) {
    console.warn("Exchange rates unavailable, using USD only", e);
  }
}

export async function loadData(state) {
  const [peopleData, itemsData] = await Promise.all([
    fetchJson("./data/richest_people.json"),
    fetchJson("./data/cpi_items.json"),
  ]);

  if (!Array.isArray(peopleData.people) || peopleData.people.length === 0) {
    throw new Error("People dataset is empty or invalid.");
  }
  if (!Array.isArray(itemsData.items) || itemsData.items.length === 0) {
    throw new Error("Items dataset is empty or invalid.");
  }

  state.people = peopleData.people;
  state.items = itemsData.items;
  state.selectedPerson = state.people[0];

  state.dataMeta.wealth = {
    source: peopleData.source,
    last_updated: peopleData.last_updated,
    source_url: peopleData.source_url || "",
    stale: peopleData.stale || false,
    staleness_warning: peopleData.staleness_warning || null,
  };
  state.dataMeta.items = {
    source: itemsData.source,
    last_updated: itemsData.last_updated,
    source_url: itemsData.source_url || "",
    stats: itemsData.stats || null,
  };

  return { peopleData, itemsData };
}
