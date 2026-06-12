// FILE: js/render.js — All DOM rendering functions

import { numberFormatter, formatCurrency, fuzzyMatch, formatChange, getDenominations } from "./utils.js";

// ─── DOM element cache ───
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

const els = {
  status: $("#status"),
  meta: $("#meta"),
  personSelect: $("#personSelect"),
  personDetails: $("#personDetails"),
  itemsCount: $("#itemsCount"),
  itemsGrid: $("#itemsGrid"),
  totalBar: $("#totalBar"),
  wealthStats: $("#wealthStats"),
  receipt: $("#receipt"),
  searchInput: $("#searchInput"),
  searchSuggestions: $("#searchSuggestions"),
  workTime: $("#workTime"),
  timeEquivalents: $("#timeEquivalents"),
  annualIncomeDisplay: $("#annualIncomeDisplay"),
  yearsToWealthDisplay: $("#yearsToWealthDisplay"),
  savingsComparisonDisplay: $("#savingsComparisonDisplay"),
  cartAfterSavingsDisplay: $("#cartAfterSavingsDisplay"),
  shareStatus: $("#shareStatus"),
  wealthSourceDisplay: $("#wealthSourceDisplay"),
  itemSourceDisplay: $("#itemSourceDisplay"),
  stickyPerson: $("#stickyPerson"),
  stickyPosition: $("#stickyPosition"),
  stickyWage: $("#stickyWage"),
  stickyCart: $("#stickyCart"),
  stickyWork: $("#stickyWork"),
  // Compact stats bar
  totalCompact: $("#totalCompact"),
  percentCompact: $("#percentCompact"),
  remainingCompact: $("#remainingCompact"),
  fractionCompact: $("#fractionCompact"),
  miniProgress: $("#miniProgress"),
  // Sound & toggles
  soundToggleBtn: $("#soundToggleBtn"),
  currencySelect: $("#currencySelect"),
  stashToggle: $("#stashToggle"),
  stashPanel: $("#stashPanel"),
  stashStacks: $("#stashStacks"),
  stashRemaining: $("#stashRemaining"),
  fortuneStash: $("#fortuneStash"),
  // Gap metrics
  gapBillionaireSeconds: $("#gapBillionaireSeconds"),
  gapLifetimeRatio: $("#gapLifetimeRatio"),
  gapPeopleNeeded: $("#gapPeopleNeeded"),
  gapCountYears: $("#gapCountYears"),
  gapWorldHunger: $("#gapWorldHunger"),
  gapSchools: $("#gapSchools"),
  gapStudentLoans: $("#gapStudentLoans"),
  gapHomeless: $("#gapHomeless"),
  gapDailyIncome: $("#gapDailyIncome"),
};

// ─── Helpers ───
function moneyFmt(state) {
  return (n) => formatCurrency(n, state.selectedCurrency, state.exchangeRates);
}

// ─── Cart math ───
export function getCartTotal(state) {
  let total = 0;
  for (const item of state.items) {
    total += (state.cart[item.id] || 0) * item.price;
  }
  for (const custom of state.customItems) {
    total += (state.cart[custom.id] || 0) * custom.price;
  }
  return total;
}

export function getDerivedMetrics(state) {
  const total = getCartTotal(state);
  const person = state.selectedPerson;
  const wealth = person ? person.net_worth : 0;
  const { hourlyWage, hoursPerWeek, weeksPerYear, savings } = state.userFinance;
  const yearlyHours = hoursPerWeek * weeksPerYear;
  const yearlyIncome = hourlyWage > 0 && yearlyHours > 0 ? hourlyWage * yearlyHours : 0;
  const percent = wealth > 0 ? (total / wealth) * 100 : 0;
  const remaining = wealth - total;
  const fraction = total > 0 ? Math.round(wealth / total) : 0;
  const households = total / 30000;
  const savingsMultiple = savings > 0 ? total / savings : null;
  const hoursToAffordCart = hourlyWage > 0 ? total / hourlyWage : 0;
  const yearsToAffordCart = yearlyIncome > 0 ? total / yearlyIncome : 0;
  const yearsToReachWealth = yearlyIncome > 0 && wealth > 0 ? wealth / yearlyIncome : null;
  const lifetimesToReachWealth = yearsToReachWealth ? yearsToReachWealth / 80 : null;
  const workingLifetimesToReachWealth = yearsToReachWealth ? yearsToReachWealth / 40 : null;
  const remainingAfterSavings = Math.max(0, total - savings);
  const yearsToAffordCartWithSavings = yearlyIncome > 0 ? remainingAfterSavings / yearlyIncome : 0;

  return {
    total, wealth, yearlyHours, yearlyIncome, percent, remaining, fraction,
    households, savingsMultiple, hoursToAffordCart, yearsToAffordCart,
    yearsToReachWealth, lifetimesToReachWealth, workingLifetimesToReachWealth,
    yearsToAffordCartWithSavings, remainingAfterSavings,
  };
}

// ─── Item filtering ───
export function getVisibleItems(state) {
  let items = state.items;
  if (state.activeCategory !== "all") {
    items = items.filter((item) => item.category === state.activeCategory);
  }
  if (state.searchText && state.searchText.length >= 2) {
    items = items.filter((item) => fuzzyMatch(state.searchText, item.name));
  }
  // Apply sorting
  const sortBy = state.sortBy || "default";
  if (sortBy === "name-asc") {
    items = [...items].sort((a, b) => a.name.localeCompare(b.name));
  } else if (sortBy === "name-desc") {
    items = [...items].sort((a, b) => b.name.localeCompare(a.name));
  } else if (sortBy === "price-asc") {
    items = [...items].sort((a, b) => a.price - b.price);
  } else if (sortBy === "price-desc") {
    items = [...items].sort((a, b) => b.price - a.price);
  }
  return items;
}

export function getSearchResults(state) {
  if (!state.searchText || state.searchText.length < 2) return [];
  return state.items.filter((item) => fuzzyMatch(state.searchText, item.name)).slice(0, 12);
}

// ─── Status helpers ───
export function setShareStatus(message) {
  if (!els.shareStatus) return;
  els.shareStatus.textContent = message;
  clearTimeout(setShareStatus._tid);
  setShareStatus._tid = setTimeout(() => { els.shareStatus.textContent = ""; }, 2500);
}

// ─── Render: Person selector & details ───
export function renderPersonOptions(state) {
  if (!els.personSelect) return;
  els.personSelect.innerHTML = "";
  for (const person of state.people) {
    const option = document.createElement("option");
    option.value = person.id;
    const changeLabel = formatChange(person.daily_change_pct);
    option.textContent = `#${person.rank} ${person.name}${changeLabel} — ${moneyFmt(state)(person.net_worth)}`;
    els.personSelect.appendChild(option);
  }
  if (state.selectedPerson) els.personSelect.value = state.selectedPerson.id;
}

export function renderPersonDetails(state) {
  if (!els.personDetails) return;
  if (!state.selectedPerson) { els.personDetails.textContent = ""; return; }
  const p = state.selectedPerson;
  els.personDetails.textContent = `#${p.rank} ${p.name} — ${moneyFmt(state)(p.net_worth)} · ${p.company} · ${p.country}`;
}

// ─── Render: Category filters ───
export function renderCategoryFilters(state) {
  for (const btn of $$(".filterBtn")) {
    const isActive = btn.dataset.category === state.activeCategory;
    btn.style.fontWeight = isActive ? "700" : "400";
    btn.style.outline = isActive ? "2px solid currentColor" : "none";
    btn.setAttribute("aria-pressed", isActive ? "true" : "false");
  }
}

// ─── Render: Items grid ───
export function renderItems(state) {
  if (!els.itemsGrid) return;
  els.itemsGrid.innerHTML = "";
  const visibleItems = getVisibleItems(state);
  if (els.itemsCount) els.itemsCount.textContent = `${visibleItems.length} items shown`;
  const fmt = moneyFmt(state);

  for (const item of visibleItems) {
    const qty = state.cart[item.id] || 0;
    const card = document.createElement("div");
    card.className = "item";
    card.dataset.category = item.category;
    card.dataset.price = item.price;
    card.innerHTML = `
      <div><strong>${item.name}</strong></div>
      <div>${fmt(item.price)}</div>
      <div style="margin-top: 8px;">
        <button type="button" data-id="${item.id}" class="minus">-</button>
        <input type="number" min="0" step="1" data-id="${item.id}" class="qty" value="${qty}" style="width: 70px; text-align: center;" />
        <button type="button" data-id="${item.id}" class="plus">+</button>
      </div>`;
    els.itemsGrid.appendChild(card);
  }

  for (const custom of state.customItems) {
    const qty = state.cart[custom.id] || 0;
    const hasItem = custom.name && custom.price > 0;
    const card = document.createElement("div");
    card.className = "item";
    card.dataset.category = "custom";
    card.dataset.price = custom.price || 0;
    card.dataset.customId = custom.id;
    card.innerHTML = `
      <div style="font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.08em; color: var(--accent-2); margin-bottom: 0.3rem;">Custom Item</div>
      <div>
        <input type="text" class="custom-name-input" data-id="${custom.id}" value="${custom.name}" placeholder="Item name..." style="width: 100%; padding: 0.4rem 0.5rem; font-size: 0.82rem; margin-bottom: 0.3rem;" />
      </div>
      <div style="display: flex; align-items: center; gap: 0.3rem;">
        <span style="color: var(--muted); font-size: 0.82rem;">$</span>
        <input type="number" class="custom-price-input" data-id="${custom.id}" value="${custom.price || ""}" placeholder="0.00" min="0" step="0.01" style="width: 100%; padding: 0.4rem 0.5rem; font-size: 0.82rem;" />
      </div>
      <div style="margin-top: 8px;">
        <button type="button" data-id="${custom.id}" class="minus" ${!hasItem ? "disabled" : ""}>-</button>
        <input type="number" min="0" step="1" data-id="${custom.id}" class="qty" value="${qty}" style="width: 70px; text-align: center;" />
        <button type="button" data-id="${custom.id}" class="plus" ${!hasItem ? "disabled" : ""}>+</button>
      </div>`;
    els.itemsGrid.appendChild(card);
  }
}

// ─── Render: Search suggestions ───
export function renderSearchSuggestions(state) {
  if (!els.searchSuggestions) return;
  const results = getSearchResults(state);
  if (results.length === 0 || state.searchText.length < 2) {
    els.searchSuggestions.style.display = "none";
    els.searchSuggestions.innerHTML = "";
    return;
  }
  const fmt = moneyFmt(state);
  const lines = results.map((item) => {
    const qty = state.cart[item.id] || 0;
    const inCart = qty > 0 ? ` (${qty} in cart)` : "";
    return `<div class="search-suggestion" data-id="${item.id}">
      <span class="search-suggestion-name">${item.name}${inCart}</span>
      <span class="search-suggestion-cat">${item.category}</span>
      <span class="search-suggestion-price">${fmt(item.price)}</span>
    </div>`;
  }).join("");
  els.searchSuggestions.innerHTML = `<div class="search-suggestions-list">${lines}</div>`;
  els.searchSuggestions.style.display = "block";
}

// ─── Render: Compact stats bar ───
export function renderCompactStats(state) {
  const fmt = moneyFmt(state);
  const { total, percent, remaining, fraction } = getDerivedMetrics(state);
  if (els.totalCompact) els.totalCompact.textContent = fmt(total);
  if (els.percentCompact) els.percentCompact.textContent = percent < 0.000001 ? "<0.000001%" : percent.toFixed(6) + "%";
  if (els.remainingCompact) els.remainingCompact.textContent = fmt(remaining);
  if (els.fractionCompact) els.fractionCompact.textContent = "1 / " + numberFormatter.format(Math.round(fraction));
  if (els.miniProgress) els.miniProgress.style.width = Math.min(percent, 100) + "%";
}

// ─── Render: Work time equivalents ───
export function renderWorkTime(state) {
  if (!els.workTime || !els.timeEquivalents) return;
  const { hoursToAffordCart, yearsToAffordCart } = getDerivedMetrics(state);
  const { hourlyWage } = state.userFinance;
  if (!hourlyWage || hourlyWage <= 0) {
    els.workTime.textContent = "--";
    els.timeEquivalents.textContent = "--";
    return;
  }
  els.workTime.innerHTML = `
    <div><strong>Work required:</strong></div>
    <div>${numberFormatter.format(hoursToAffordCart)} hours</div>
    <div>${yearsToAffordCart.toFixed(2)} years</div>`;
  els.timeEquivalents.innerHTML = `
    <div><strong>Equivalent to:</strong></div>
    <div>${numberFormatter.format(hoursToAffordCart / 8)} workdays</div>
    <div>${(yearsToAffordCart / 80).toFixed(2)} human lifetimes</div>
    <div>${(yearsToAffordCart / 25).toFixed(2)} generations</div>
    <div>${(yearsToAffordCart / 500).toFixed(3)} Roman Empires</div>
    <div>${(yearsToAffordCart / 1000).toFixed(3)} olive tree lifetimes</div>`;
}

// ─── Render: Sticky summary ───
export function renderStickySummary(state) {
  const person = state.selectedPerson;
  const { total, percent, remaining, yearsToReachWealth, yearsToAffordCart } = getDerivedMetrics(state);
  const fmt = moneyFmt(state);
  const hourlyWage = state.userFinance?.hourlyWage || 0;

  // Person name
  if (els.stickyPerson) {
    els.stickyPerson.textContent = person ? person.name : "--";
  }

  // Composite: $spent / $remaining (percent%)
  if (els.stickyPosition) {
    els.stickyPosition.textContent = `${fmt(total)} / ${fmt(remaining)} (${percent < 0.000001 ? "<0.000001%" : percent.toFixed(6) + "%"})`;
  }

  // Wage → years to wealth, or prompt link
  if (els.stickyWage) {
    if (hourlyWage > 0 && yearsToReachWealth) {
      els.stickyWage.innerHTML = `$${hourlyWage}/hr → <strong>${numberFormatter.format(Math.round(yearsToReachWealth))} yrs</strong>`;
    } else {
      els.stickyWage.innerHTML = `<a href="#" id="stickyWageLink" style="color:var(--accent-2);text-decoration:none;">Enter income ⬆</a>`;
    }
  }

  // Cart item count
  if (els.stickyCart) {
    const count = Object.values(state.cart).reduce((a, b) => a + b, 0);
    els.stickyCart.textContent = count + " item" + (count !== 1 ? "s" : "");
  }

  // Work time
  if (els.stickyWork) {
    if (hourlyWage > 0) {
      els.stickyWork.textContent = yearsToAffordCart.toFixed(2) + " yrs work";
    } else {
      els.stickyWork.textContent = "--";
    }
  }
}

// ─── Render: Position comparison ───
export function renderPositionComparison(state) {
  const m = getDerivedMetrics(state);
  const fmt = moneyFmt(state);
  if (els.annualIncomeDisplay) els.annualIncomeDisplay.textContent = m.yearlyIncome > 0 ? fmt(m.yearlyIncome) : "Add income details";
  if (els.yearsToWealthDisplay) els.yearsToWealthDisplay.innerHTML = m.yearsToReachWealth
    ? `${numberFormatter.format(m.yearsToReachWealth)} years<br><span style="opacity:0.8;">≈ ${m.lifetimesToReachWealth.toFixed(2)} lifetimes<br>≈ ${m.workingLifetimesToReachWealth.toFixed(2)} full working lives</span>`
    : "Add income details";
  if (els.savingsComparisonDisplay) els.savingsComparisonDisplay.textContent = m.savingsMultiple ? `${m.savingsMultiple.toFixed(2)}x your current savings` : "Add your savings";
  if (els.cartAfterSavingsDisplay) els.cartAfterSavingsDisplay.textContent = state.userFinance.hourlyWage > 0
    ? `${m.yearsToAffordCartWithSavings.toFixed(2)} years (${fmt(m.remainingAfterSavings)} remaining after savings)`
    : "Add income details";
}

// ─── Render: Receipt ───
export function renderReceipt(state) {
  if (!els.receipt) return;
  const person = state.selectedPerson;
  const { total, percent, remaining } = getDerivedMetrics(state);
  const fmt = moneyFmt(state);

  const regularItems = state.items
    .filter((item) => (state.cart[item.id] || 0) > 0)
    .map((item) => ({ name: item.name, quantity: state.cart[item.id], unitPrice: item.price, subtotal: state.cart[item.id] * item.price }));

  const customCartItems = state.customItems
    .filter((c) => (state.cart[c.id] || 0) > 0 && c.name && c.price > 0)
    .map((c) => ({ name: c.name + " (custom)", quantity: state.cart[c.id], unitPrice: c.price, subtotal: state.cart[c.id] * c.price }));

  const cartItems = [...regularItems, ...customCartItems].sort((a, b) => b.subtotal - a.subtotal);

  if (cartItems.length === 0) { els.receipt.innerHTML = ""; return; }

  const lines = cartItems.map((e) => {
    const qtyLabel = e.quantity > 1 ? `x${numberFormatter.format(e.quantity)}` : "";
    return `<div class="receipt-line"><span class="receipt-item-name">${e.name} ${qtyLabel}</span><span class="receipt-item-subtotal">${fmt(e.subtotal)}</span></div>`;
  }).join("");

  els.receipt.innerHTML = `
    <div class="receipt-header">
      <div class="receipt-title">Spending Receipt</div>
      ${person ? `<div class="receipt-person">${person.name}'s Fortune</div>` : ""}
    </div>
    <div class="receipt-divider"></div>
    <div class="receipt-body">${lines}</div>
    <div class="receipt-divider"></div>
    <div class="receipt-footer">
      <div class="receipt-line receipt-total"><span>Total Spent</span><span>${fmt(total)}</span></div>
      <div class="receipt-line"><span>Remaining</span><span>${fmt(remaining)}</span></div>
      <div class="receipt-line"><span>Percent Used</span><span>${percent < 0.000001 ? "<0.000001" : percent.toFixed(6)}%</span></div>
    </div>
    <div class="receipt-barcode"></div>`;
}

// ─── Render: Source displays ───
export function renderSourceDisplays(state) {
  if (els.wealthSourceDisplay && state.dataMeta.wealth) {
    const w = state.dataMeta.wealth;
    const staleBadge = w.stale
      ? `<span style="color:#e74c3c;font-size:0.75rem;margin-left:0.5rem;">⚠ STALE</span>`
      : "";
    const ageLabel = w.last_updated
      ? `Updated: ${w.last_updated}${staleBadge}`
      : "Unknown";
    els.wealthSourceDisplay.innerHTML = `<div>${w.source || "Unknown"}</div><div style="margin-top:0.35rem;">${ageLabel}</div>`;
  }
  if (els.itemSourceDisplay && state.dataMeta.items) {
    const m = state.dataMeta.items;
    const stats = m.stats
      ? `<div style="margin-top:0.2rem;font-size:0.75rem;color:var(--muted);">${m.stats.bls_live_items || 0} live prices · ${m.stats.curated_items || 0} curated</div>`
      : "";
    els.itemSourceDisplay.innerHTML = `<div>${m.source || "Unknown"}</div><div style="margin-top:0.35rem;">Updated: ${m.last_updated || "Unknown"}</div>${stats}`;
  }
}

// ─── Render: Stash stacks ───
export function renderStashStacks(state) {
  if (!els.stashStacks) return;
  const { remaining } = getDerivedMetrics(state);
  const r = Math.max(0, remaining);
  const denomCounts = getDenominations(r);
  const denoms = [1, 5, 10, 20, 50, 100];
  const maxBills = 20;
  els.stashStacks.innerHTML = denoms.map((d) => {
    const count = denomCounts[d];
    const displayCount = Math.min(count, maxBills);
    const bars = Array.from({ length: displayCount }, () => `<div class="stash-bill bill-${d}"></div>`).join("");
    const overflow = count > maxBills ? `<div style="font-size:0.5rem;color:var(--muted);margin-top:1px;">+${numberFormatter.format(count - maxBills)}</div>` : "";
    return `<div class="stash-stack" data-denom="${d}">${bars}${overflow}</div>`;
  }).join("");
  if (els.stashRemaining) els.stashRemaining.textContent = moneyFmt(state)(r);
}

// ─── Render: Flying bills animation ───
export function flyBills(sourceEl, cost, state) {
  if (cost <= 0 || !els.fortuneStash || !els.stashStacks) return;
  const srcRect = sourceEl.getBoundingClientRect();
  const stashRect = els.fortuneStash.getBoundingClientRect();
  const startX = srcRect.left + srcRect.width / 2;
  const startY = srcRect.top + srcRect.height / 2;
  const endX = stashRect.left + stashRect.width / 2;
  const endY = stashRect.top + stashRect.height / 2;
  const denomCounts = getDenominations(cost);
  const denoms = [100, 50, 20, 10, 5, 1];
  let totalBills = 0;
  for (const d of denoms) {
    const count = Math.min(denomCounts[d], 8);
    for (let i = 0; i < count; i++) {
      totalBills++;
      const delay = totalBills * 35 + Math.random() * 20;
      const dx = endX - startX + (Math.random() - 0.5) * 40;
      const dy = endY - startY + (Math.random() - 0.5) * 30;
      const rot = (Math.random() - 0.5) * 360;
      const bill = document.createElement("div");
      bill.className = `flying-bill bill-${d}`;
      bill.textContent = `$${d}`;
      bill.style.left = (startX + (Math.random() - 0.5) * 30) + "px";
      bill.style.top = (startY + (Math.random() - 0.5) * 20) + "px";
      bill.style.setProperty("--dx", dx + "px");
      bill.style.setProperty("--dy", dy + "px");
      bill.style.setProperty("--rot", rot + "deg");
      bill.style.setProperty("--bill-duration", (0.35 + Math.random() * 0.2) + "s");
      document.body.appendChild(bill);
      setTimeout(() => bill.classList.add("animate"), delay);
      setTimeout(() => bill.remove(), delay + 700);
    }
  }
  if (els.stashToggle) {
    els.stashToggle.classList.remove("burn");
    void els.stashToggle.offsetWidth;
    els.stashToggle.classList.add("burn");
  }
  if (els.stashPanel && cost > 1000) {
    els.stashPanel.classList.remove("burning");
    void els.stashPanel.offsetWidth;
    els.stashPanel.classList.add("burning");
  }
}

// ─── Master updateUI ───
export function updateUI(state) {
  renderPersonDetails(state);
  renderCategoryFilters(state);
  renderItems(state);
  renderCompactStats(state);
  renderWorkTime(state);
  renderStickySummary(state);
  renderPositionComparison(state);
  renderSourceDisplays(state);
  renderReceipt(state);
  renderStashStacks(state);
  renderGapMetrics(state);
  highlightActiveSort(state);
}

// ─── Render: Gap Metrics — What could this wealth actually do? ───
export function renderGapMetrics(state) {
  const person = state.selectedPerson;
  if (!person) return;

  const wealth = person.net_worth || 0;
  if (wealth <= 0) return;

  const { hourlyWage, hoursPerWeek, weeksPerYear } = state.userFinance;
  const annualIncome = (hourlyWage && hoursPerWeek && weeksPerYear)
    ? hourlyWage * hoursPerWeek * weeksPerYear
    : 0;
  const dailyIncome = annualIncome / 365;
  const billionaireDailyIncome = wealth / 365;
  const billionaireHourlyIncome = wealth / (365 * 24);
  const billionaireSecondIncome = billionaireHourlyIncome / 3600;

  // Billionaire-seconds: how many seconds for them to earn your hourly wage
  if (els.gapBillionaireSeconds) {
    const secs = hourlyWage > 0 ? (hourlyWage / billionaireSecondIncome) : 0;
    if (secs > 0 && secs < 1) {
      els.gapBillionaireSeconds.textContent = (secs * 1000).toFixed(1) + " milliseconds";
    } else if (secs >= 1 && secs < 60) {
      els.gapBillionaireSeconds.textContent = secs.toFixed(2) + " seconds";
    } else if (secs >= 60 && secs < 3600) {
      els.gapBillionaireSeconds.textContent = (secs / 60).toFixed(2) + " minutes";
    } else {
      els.gapBillionaireSeconds.textContent = numberFormatter.format(secs) + " seconds";
    }
  }

  // Your lifetime income vs their net worth
  if (els.gapLifetimeRatio && annualIncome > 0) {
    const lifetimeYears = 40; // working years
    const lifetimeIncome = annualIncome * lifetimeYears;
    const ratio = wealth / lifetimeIncome;
    if (ratio >= 1e6) {
      els.gapLifetimeRatio.textContent = numberFormatter.format(Math.round(ratio)) + " of you";
    } else if (ratio >= 1000) {
      els.gapLifetimeRatio.textContent = (ratio / 1000).toFixed(1) + "K of you";
    } else {
      els.gapLifetimeRatio.textContent = ratio.toFixed(1) + " of you";
    }
  } else if (els.gapLifetimeRatio) {
    els.gapLifetimeRatio.textContent = "Enter your wage above";
  }

  // People needed to match their wealth (at median US household net worth ~$192K)
  if (els.gapPeopleNeeded) {
    const medianHouseholdNetWorth = 192700; // Federal Reserve 2025
    const peopleNeeded = wealth / medianHouseholdNetWorth;
    if (peopleNeeded >= 1e9) {
      els.gapPeopleNeeded.textContent = (peopleNeeded / 1e9).toFixed(2) + " billion people";
    } else if (peopleNeeded >= 1e6) {
      els.gapPeopleNeeded.textContent = (peopleNeeded / 1e6).toFixed(1) + " million people";
    } else {
      els.gapPeopleNeeded.textContent = numberFormatter.format(Math.round(peopleNeeded)) + " people";
    }
  }

  // Years to count their wealth at $1/second
  if (els.gapCountYears) {
    const seconds = wealth;
    const years = seconds / (365.25 * 24 * 3600);
    if (years >= 1e9) {
      els.gapCountYears.textContent = (years / 1e9).toFixed(2) + " billion years";
    } else if (years >= 1e6) {
      els.gapCountYears.textContent = (years / 1e6).toFixed(1) + " million years";
    } else {
      els.gapCountYears.textContent = numberFormatter.format(Math.round(years)) + " years";
    }
  }

  // World hunger (1 year = $40B)
  if (els.gapWorldHunger) {
    const hungerCost = 40000000000;
    const times = wealth / hungerCost;
    els.gapWorldHunger.textContent = times >= 1
      ? numberFormatter.format(Math.round(times)) + "×"
      : "Not enough";
  }

  // US schools (1 year = $981.57B)
  if (els.gapSchools) {
    const schoolsCost = 981570000000;
    const times = wealth / schoolsCost;
    els.gapSchools.textContent = times >= 1
      ? times.toFixed(1) + "×"
      : "Not enough";
  }

  // Student loans ($1.77T)
  if (els.gapStudentLoans) {
    const loanCost = 1770000000000;
    const times = wealth / loanCost;
    els.gapStudentLoans.textContent = times >= 1
      ? times.toFixed(2) + "×"
      : "Not enough";
  }

  // End homelessness ($20B)
  if (els.gapHomeless) {
    const homelessCost = 20000000000;
    const times = wealth / homelessCost;
    els.gapHomeless.textContent = times >= 1
      ? numberFormatter.format(Math.round(times)) + " years"
      : "Not enough";
  }

  // Daily income comparison
  if (els.gapDailyIncome) {
    if (dailyIncome > 0) {
      const ratio = billionaireDailyIncome / dailyIncome;
      if (ratio >= 1e6) {
        els.gapDailyIncome.textContent = (ratio / 1e6).toFixed(1) + "M× your daily income";
      } else if (ratio >= 1000) {
        els.gapDailyIncome.textContent = (ratio / 1000).toFixed(1) + "K× your daily income";
      } else {
        els.gapDailyIncome.textContent = ratio.toFixed(0) + "× your daily income";
      }
    } else {
      els.gapDailyIncome.textContent = numberFormatter.format(Math.round(billionaireDailyIncome)) + "/day (enter wage for ratio)";
    }
  }
}

// ─── Render: Highlight active sort button ───
export function highlightActiveSort(state) {
  const sortBy = state.sortBy || "default";
  document.querySelectorAll(".sortBtn").forEach((btn) => {
    const active = btn.dataset.sort === sortBy;
    btn.classList.toggle("sort-active", active);
  });
}
