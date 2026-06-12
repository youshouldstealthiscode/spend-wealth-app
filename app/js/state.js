// FILE: js/state.js — Application state, defaults, localStorage persistence

const STORAGE_KEY = "spendWealthState";

const DEFAULT_CUSTOM_ITEMS = Array.from({ length: 5 }, (_, i) => ({
  id: `custom_${i + 1}`,
  name: "",
  price: 0,
}));

export function createInitialState() {
  return {
    people: [],
    items: [],
    selectedPerson: null,
    cart: {},
    activeCategory: "all",
    userFinance: { hourlyWage: 0, hoursPerWeek: 40, weeksPerYear: 52, savings: 0 },
    dataMeta: { wealth: null, items: null },
    soundEnabled: true,
    activePreset: null,
    searchText: "",
    selectedCurrency: "USD",
    exchangeRates: { USD: 1 },
    ratesLoaded: false,
    customItems: DEFAULT_CUSTOM_ITEMS.map((c) => ({ ...c })),
  };
}

export function saveState(state) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    console.warn("Failed to save state", e);
  }
}

export function loadState(state) {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    if (parsed.cart) state.cart = parsed.cart;
    if (parsed.activeCategory) state.activeCategory = parsed.activeCategory;
    if (parsed.userFinance) state.userFinance = parsed.userFinance;
    if (typeof parsed.soundEnabled === "boolean") state.soundEnabled = parsed.soundEnabled;
    if (parsed.activePreset) state.activePreset = parsed.activePreset;
    if (parsed.selectedCurrency) state.selectedCurrency = parsed.selectedCurrency;
    if (Array.isArray(parsed.customItems)) {
      // Merge saved custom items into default slots (up to 5)
      for (let i = 0; i < 5; i++) {
        const saved = parsed.customItems[i];
        state.customItems[i] = saved ? { ...saved } : { id: `custom_${i + 1}`, name: "", price: 0 };
      }
    }
  } catch (e) {
    console.warn("Failed to load state", e);
  }
}

export function resetAppState(state, people) {
  state.cart = {};
  state.activeCategory = "all";
  state.activePreset = null;
  state.userFinance = { hourlyWage: 0, hoursPerWeek: 40, weeksPerYear: 52, savings: 0 };
  state.selectedPerson = people[0] || null;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (e) {
    console.warn("Failed to clear saved state", e);
  }
}
