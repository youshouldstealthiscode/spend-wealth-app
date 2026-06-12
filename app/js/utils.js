// FILE: js/utils.js — Pure helper functions, no DOM, no side effects

export const numberFormatter = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });

export const CURRENCY_SYMBOLS = {
  USD: "$", EUR: "€", GBP: "£", JPY: "¥", CAD: "$",
  AUD: "$", INR: "₹", BRL: "R$", CHF: "CHF ", MXN: "$",
};

export function formatCurrency(amount, currency, exchangeRates) {
  const cur = currency || "USD";
  const symbol = CURRENCY_SYMBOLS[cur] || cur + " ";
  const rate = (exchangeRates && exchangeRates[cur]) || 1;
  const converted = amount * rate;

  if (cur === "JPY") {
    return symbol + Math.round(converted).toLocaleString("en-US");
  }

  // Use 2 decimal places for small amounts so sub-$1 prices don't show as $0
  const useCents = converted < 10;
  return symbol + converted.toLocaleString("en-US", {
    minimumFractionDigits: useCents ? 2 : 0,
    maximumFractionDigits: useCents ? 2 : 0,
  });
}

export function fuzzyMatch(query, text) {
  if (!query) return true;
  const q = query.toLowerCase();
  const t = text.toLowerCase();
  if (t.includes(q)) return true;
  let qi = 0;
  for (let ti = 0; ti < t.length && qi < q.length; ti++) {
    if (t[ti] === q[qi]) qi++;
  }
  return qi === q.length;
}

export function getDenominations(amount) {
  const denoms = [100, 50, 20, 10, 5, 1];
  const result = {};
  let remaining = Math.round(amount);
  for (const d of denoms) {
    result[d] = Math.floor(remaining / d);
    remaining %= d;
  }
  return result;
}

export function encodeShareState(state) {
  const payload = {
    selectedPersonId: state.selectedPerson ? state.selectedPerson.id : null,
    cart: state.cart,
    activeCategory: state.activeCategory,
    activePreset: state.activePreset,
    customItems: state.customItems,
    userFinance: state.userFinance,
  };
  return btoa(encodeURIComponent(JSON.stringify(payload)));
}

export function applySharedState(encoded, state, people) {
  try {
    const decoded = JSON.parse(decodeURIComponent(atob(encoded)));
    if (decoded.cart) state.cart = decoded.cart;
    if (decoded.activeCategory) state.activeCategory = decoded.activeCategory;
    if (decoded.activePreset) state.activePreset = decoded.activePreset;
    if (decoded.userFinance) state.userFinance = decoded.userFinance;
    if (decoded.selectedPersonId && Array.isArray(people)) {
      const matched = people.find((p) => p.id === decoded.selectedPersonId);
      if (matched) state.selectedPerson = matched;
    }
  } catch (e) {
    console.warn("Failed to apply shared state", e);
  }
}

export function formatChange(pct) {
  if (typeof pct !== "number") return "";
  const sign = pct >= 0 ? "↑" : "↓";
  return ` ${sign}${(pct * 100).toFixed(2)}%`;
}
