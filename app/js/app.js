// FILE: app/js/app.js

const statusEl = document.querySelector("#status");
const metaEl = document.querySelector("#meta");
const personSelectEl = document.querySelector("#personSelect");
const personDetailsEl = document.querySelector("#personDetails");
const itemsCountEl = document.querySelector("#itemsCount");
const itemsGridEl = document.querySelector("#itemsGrid");
const totalBarEl = document.querySelector("#totalBar");
const wealthStatsEl = document.querySelector("#wealthStats");
const receiptEl = document.querySelector("#receipt");
const searchInputEl = document.querySelector("#searchInput");
const searchSuggestionsEl = document.querySelector("#searchSuggestions");
const wageInputEl = document.querySelector("#wage");
const hoursPerWeekInputEl = document.querySelector("#hoursPerWeek");
const weeksPerYearInputEl = document.querySelector("#weeksPerYear");
const savingsInputEl = document.querySelector("#savings");
const workTimeEl = document.querySelector("#workTime");
const annualIncomeDisplayEl = document.querySelector("#annualIncomeDisplay");
const yearsToWealthDisplayEl = document.querySelector("#yearsToWealthDisplay");
const savingsComparisonDisplayEl = document.querySelector("#savingsComparisonDisplay");
const cartAfterSavingsDisplayEl = document.querySelector("#cartAfterSavingsDisplay");
const resetAppBtnEl = document.querySelector("#resetAppBtn");
const shareResultsBtnEl = document.querySelector("#shareResultsBtn");
const printReceiptBtnEl = document.querySelector("#printReceiptBtn");
const soundToggleBtnEl = document.querySelector("#soundToggleBtn");
const shareStatusEl = document.querySelector("#shareStatus");
const presetStatusEl = document.querySelector("#presetStatus");
const wealthSourceDisplayEl = document.querySelector("#wealthSourceDisplay");
const itemSourceDisplayEl = document.querySelector("#itemSourceDisplay");

const moneyFormatter = new Intl.NumberFormat("en-US", {
	style: "currency",
	currency: "USD",
	maximumFractionDigits: 0,
});

const numberFormatter = new Intl.NumberFormat("en-US", {
	maximumFractionDigits: 0,
});

function getDefaultUserFinance() {
	return {
		hourlyWage: 0,
		hoursPerWeek: 40,
		weeksPerYear: 52,
		savings: 0,
	};
}

let STATE = {
	people: [],
	items: [],
	selectedPerson: null,
	cart: {},
	activeCategory: "all",
	userFinance: getDefaultUserFinance(),
	dataMeta: {
		wealth: null,
		items: null,
	},
	soundEnabled: true,
	activePreset: null,
	searchText: "",
};

let audioCtx = null;

function getAudioCtx() {
	if (!audioCtx) {
		audioCtx = new (window.AudioContext || window.webkitAudioContext)();
	}
	return audioCtx;
}

function playKaching() {
	if (!STATE.soundEnabled) return;
	try {
		const ctx = getAudioCtx();
		const now = ctx.currentTime;

		// High metallic "ding"
		const osc1 = ctx.createOscillator();
		const gain1 = ctx.createGain();
		osc1.type = "sine";
		osc1.frequency.setValueAtTime(2200, now);
		osc1.frequency.exponentialRampToValueAtTime(1800, now + 0.12);
		gain1.gain.setValueAtTime(0.25, now);
		gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
		osc1.connect(gain1);
		gain1.connect(ctx.destination);
		osc1.start(now);
		osc1.stop(now + 0.18);

		// Lower "clunk" body
		const osc2 = ctx.createOscillator();
		const gain2 = ctx.createGain();
		osc2.type = "triangle";
		osc2.frequency.setValueAtTime(800, now + 0.02);
		osc2.frequency.exponentialRampToValueAtTime(400, now + 0.1);
		gain2.gain.setValueAtTime(0.15, now + 0.02);
		gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
		osc2.connect(gain2);
		gain2.connect(ctx.destination);
		osc2.start(now + 0.02);
		osc2.stop(now + 0.15);

		// Noise burst (drawer rattle)
		const bufferSize = ctx.sampleRate * 0.06;
		const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
		const data = buffer.getChannelData(0);
		for (let i = 0; i < bufferSize; i++) {
			data[i] = (Math.random() * 2 - 1) * 0.08;
		}
		const noise = ctx.createBufferSource();
		noise.buffer = buffer;
		const noiseGain = ctx.createGain();
		noiseGain.gain.setValueAtTime(0.3, now + 0.01);
		noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
		noise.connect(noiseGain);
		noiseGain.connect(ctx.destination);
		noise.start(now + 0.01);
		noise.stop(now + 0.08);
	} catch (e) {
		// Audio not available — fail silently
	}
}

function playSubtleTick() {
	if (!STATE.soundEnabled) return;
	try {
		const ctx = getAudioCtx();
		const now = ctx.currentTime;
		const osc = ctx.createOscillator();
		const gain = ctx.createGain();
		osc.type = "sine";
		osc.frequency.setValueAtTime(1200, now);
		gain.gain.setValueAtTime(0.06, now);
		gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
		osc.connect(gain);
		gain.connect(ctx.destination);
		osc.start(now);
		osc.stop(now + 0.05);
	} catch (e) {
		// Audio not available
	}
}

function fuzzyMatch(query, text) {
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

function getSearchResults(query) {
	if (!query || query.length < 2) return [];
	const matches = STATE.items.filter((item) => fuzzyMatch(query, item.name));
	return matches.slice(0, 12);
}

function renderSearchSuggestions() {
	if (!searchSuggestionsEl) return;
	const query = STATE.searchText;
	const results = getSearchResults(query);

	if (results.length === 0 || query.length < 2) {
		searchSuggestionsEl.style.display = "none";
		searchSuggestionsEl.innerHTML = "";
		return;
	}

	const lines = results.map((item) => {
		const qty = STATE.cart[item.id] || 0;
		const inCart = qty > 0 ? ` (${qty} in cart)` : "";
		return `<div class="search-suggestion" data-id="${item.id}">
			<span class="search-suggestion-name">${item.name}${inCart}</span>
			<span class="search-suggestion-cat">${item.category}</span>
			<span class="search-suggestion-price">${moneyFormatter.format(item.price)}</span>
		</div>`;
	}).join("");

	searchSuggestionsEl.innerHTML = `<div class="search-suggestions-list">${lines}</div>`;
	searchSuggestionsEl.style.display = "block";
}

function clearSearch() {
	STATE.searchText = "";
	if (searchInputEl) searchInputEl.value = "";
	if (searchSuggestionsEl) {
		searchSuggestionsEl.style.display = "none";
		searchSuggestionsEl.innerHTML = "";
	}
	updateUI();
}

async function fetchJson(path) {
	const response = await fetch(path, { cache: "no-store" });

	if (!response.ok) {
		throw new Error(`Failed to load ${path}: ${response.status} ${response.statusText}`);
	}

	return response.json();
}

function saveState() {
	try {
		localStorage.setItem("spendWealthState", JSON.stringify(STATE));
	} catch (e) {
		console.warn("Failed to save state", e);
	}
}

function loadState() {
	try {
		const raw = localStorage.getItem("spendWealthState");
		if (!raw) return;

		const parsed = JSON.parse(raw);

		if (parsed.cart) STATE.cart = parsed.cart;
		if (parsed.activeCategory) STATE.activeCategory = parsed.activeCategory;
		if (parsed.userFinance) STATE.userFinance = parsed.userFinance;
		if (typeof parsed.soundEnabled === "boolean") STATE.soundEnabled = parsed.soundEnabled;
		if (parsed.activePreset) STATE.activePreset = parsed.activePreset;
	} catch (e) {
		console.warn("Failed to load state", e);
	}
}

function encodeShareState() {
	const payload = {
		selectedPersonId: STATE.selectedPerson ? STATE.selectedPerson.id : null,
		cart: STATE.cart,
		activeCategory: STATE.activeCategory,
		activePreset: STATE.activePreset,
		userFinance: STATE.userFinance,
	};

	return btoa(encodeURIComponent(JSON.stringify(payload)));
}

function applySharedState(encoded) {
	try {
		const decoded = JSON.parse(decodeURIComponent(atob(encoded)));

		if (decoded.cart) STATE.cart = decoded.cart;
		if (decoded.activeCategory) STATE.activeCategory = decoded.activeCategory;
		if (decoded.activePreset) STATE.activePreset = decoded.activePreset;
		if (decoded.userFinance) STATE.userFinance = decoded.userFinance;

		if (decoded.selectedPersonId && Array.isArray(STATE.people)) {
			const matched = STATE.people.find((person) => person.id === decoded.selectedPersonId);
			if (matched) {
				STATE.selectedPerson = matched;
			}
		}
	} catch (e) {
		console.warn("Failed to apply shared state", e);
	}
}

function setShareStatus(message) {
	if (!shareStatusEl) return;
	shareStatusEl.textContent = message;
	window.clearTimeout(setShareStatus.timeoutId);
	setShareStatus.timeoutId = window.setTimeout(() => {
		shareStatusEl.textContent = "";
	}, 2500);
}

function resetAppState() {
	STATE.cart = {};
	STATE.activeCategory = "all";
	STATE.activePreset = null;
	STATE.userFinance = getDefaultUserFinance();
	STATE.selectedPerson = STATE.people[0] || null;

	try {
		localStorage.removeItem("spendWealthState");
	} catch (e) {
		console.warn("Failed to clear saved state", e);
	}

	syncFinanceInputsFromState();
	renderPersonOptions();
	updateUI();
	setShareStatus("App reset.");
}

async function shareResults() {
	const shareUrl = `${window.location.origin}${window.location.pathname}?state=${encodeShareState()}`;

	try {
		if (navigator.share) {
			await navigator.share({
				title: "Spend Wealth App Results",
				text: "Check out this billionaire wealth comparison.",
				url: shareUrl,
			});
			setShareStatus("Shared.");
			return;
		}

		await navigator.clipboard.writeText(shareUrl);
		setShareStatus("Share link copied.");
	} catch (e) {
		console.warn("Failed to share results", e);
		setShareStatus("Share failed.");
	}
}

function printReceipt() {
	if (!receiptEl || receiptEl.innerHTML === "") {
		setShareStatus("Nothing to print.");
		return;
	}

	const printWindow = window.open("", "_blank", "width=480,height=640");
	if (!printWindow) {
		setShareStatus("Pop-up blocked.");
		return;
	}

	printWindow.document.write(`<!DOCTYPE html><html><head><title>Receipt</title>
		<style>
			body { font-family: "Courier New", Courier, monospace; padding: 2rem; color: #000; }
			.receipt-title { text-align: center; font-size: 1.2rem; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; }
			.receipt-person { text-align: center; font-size: 0.85rem; color: #555; margin-top: 0.2rem; }
			.receipt-divider { border-top: 1px dashed #999; margin: 0.5rem 0; }
			.receipt-line { display: flex; justify-content: space-between; padding: 0.2rem 0; font-size: 0.9rem; }
			.receipt-item-name { flex: 1; }
			.receipt-total { font-weight: 700; border-top: 1px dashed #999; padding-top: 0.4rem; }
			.receipt-barcode { display: none; }
			.receipt-body { max-height: none; }
		</style>
	</head><body>${receiptEl.innerHTML}</body></html>`);
	printWindow.document.close();
	printWindow.focus();
	printWindow.print();
}

function getVisibleItems() {
	let items = STATE.items;

	if (STATE.activeCategory !== "all") {
		items = items.filter((item) => item.category === STATE.activeCategory);
	}

	if (STATE.searchText && STATE.searchText.length >= 2) {
		items = items.filter((item) => fuzzyMatch(STATE.searchText, item.name));
	}

	return items;
}

function setPresetStatus(message) {
	if (!presetStatusEl) return;
	presetStatusEl.textContent = message;
}

const PRESET_DEFINITIONS = {
	survive_month: {
		label: "Survive One Month",
		items: {
			rent_month: 1, bread_white_pan: 8, milk_gallon: 4, eggs_dozen: 4,
			rice_long_grain: 10, bananas_lb: 8, potatoes_lb: 10, chicken_whole_lb: 8,
			electricity_kwh: 300, natural_gas_therm: 40,
		},
	},
	stabilize_household: {
		label: "Stabilize Household",
		items: {
			rent_month: 2, used_car: 1, doctor_visit: 2,
			bread_white_pan: 8, milk_gallon: 4, eggs_dozen: 4,
		},
	},
	fix_car_and_rent: {
		label: "Fix Car + Rent",
		items: { rent_month: 1, used_car: 1 },
	},
	college_start: {
		label: "College Start",
		items: { college_semester: 1, rent_month: 1, doctor_visit: 1 },
	},
};

function applyPresetBundle(presetKey) {
	const preset = PRESET_DEFINITIONS[presetKey];
	if (!preset) {
		setPresetStatus("Unknown preset.");
		return;
	}

	if (STATE.activePreset === presetKey) {
		for (const [itemId, qty] of Object.entries(preset.items)) {
			STATE.cart[itemId] = Math.max(0, (STATE.cart[itemId] || 0) - qty);
			if (STATE.cart[itemId] === 0) delete STATE.cart[itemId];
		}
		STATE.activePreset = null;
		setPresetStatus("Removed preset: " + preset.label + ".");
	} else {
		if (STATE.activePreset) {
			const oldPreset = PRESET_DEFINITIONS[STATE.activePreset];
			if (oldPreset) {
				for (const [itemId, qty] of Object.entries(oldPreset.items)) {
					STATE.cart[itemId] = Math.max(0, (STATE.cart[itemId] || 0) - qty);
					if (STATE.cart[itemId] === 0) delete STATE.cart[itemId];
				}
			}
		}
		for (const [itemId, qty] of Object.entries(preset.items)) {
			STATE.cart[itemId] = (STATE.cart[itemId] || 0) + qty;
		}
		STATE.activePreset = presetKey;
		setPresetStatus("Applied preset: " + preset.label + ".");
	}

	renderPresetButtons();
	saveState();
	updateUI();
}

function renderPresetButtons() {
	const buttons = document.querySelectorAll(".presetBtn");
	for (const button of buttons) {
		const isActive = button.dataset.preset === STATE.activePreset;
		button.style.outline = isActive ? "2px solid currentColor" : "none";
		button.style.fontWeight = isActive ? "700" : "400";
		button.setAttribute("aria-pressed", isActive ? "true" : "false");
	}
}

function renderSourceDisplays() {
	if (wealthSourceDisplayEl && STATE.dataMeta.wealth) {
		wealthSourceDisplayEl.innerHTML = `
			<div>${STATE.dataMeta.wealth.source}</div>
			<div style="margin-top:0.35rem;">Updated: ${STATE.dataMeta.wealth.last_updated}</div>
		`;
	}

	if (itemSourceDisplayEl && STATE.dataMeta.items) {
		itemSourceDisplayEl.innerHTML = `
			<div>${STATE.dataMeta.items.source}</div>
			<div style="margin-top:0.35rem;">Updated: ${STATE.dataMeta.items.last_updated}</div>
		`;
	}
}

function renderCategoryFilters() {
	const filterButtons = document.querySelectorAll(".filterBtn");

	for (const button of filterButtons) {
		const isActive = button.dataset.category === STATE.activeCategory;
		button.style.fontWeight = isActive ? "700" : "400";
		button.style.outline = isActive ? "2px solid currentColor" : "none";
		button.setAttribute("aria-pressed", isActive ? "true" : "false");
	}
}

function getCartTotal() {
	let total = 0;

	for (const item of STATE.items) {
		const quantity = STATE.cart[item.id] || 0;
		total += quantity * item.price;
	}

	return total;
}

function getDerivedMetrics() {
	const total = getCartTotal();
	const person = STATE.selectedPerson;
	const wealth = person ? person.net_worth : 0;
	const { hourlyWage, hoursPerWeek, weeksPerYear, savings } = STATE.userFinance;

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
		total,
		wealth,
		yearlyHours,
		yearlyIncome,
		percent,
		remaining,
		fraction,
		households,
		savingsMultiple,
		hoursToAffordCart,
		yearsToAffordCart,
		yearsToReachWealth,
		lifetimesToReachWealth,
		workingLifetimesToReachWealth,
		yearsToAffordCartWithSavings,
		remainingAfterSavings,
	};
}

function renderPersonOptions() {
	personSelectEl.innerHTML = "";

	for (const person of STATE.people) {
		const option = document.createElement("option");
		option.value = person.id;
		option.textContent = `#${person.rank} ${person.name} — ${moneyFormatter.format(person.net_worth)}`;
		personSelectEl.appendChild(option);
	}

	if (STATE.selectedPerson) {
		personSelectEl.value = STATE.selectedPerson.id;
	}
}

function renderPersonDetails() {
	if (!STATE.selectedPerson) {
		personDetailsEl.innerHTML = "<div>No person selected.</div>";
		return;
	}

	const person = STATE.selectedPerson;

	personDetailsEl.innerHTML = `
    <div><strong>Name:</strong> ${person.name}</div>
    <div><strong>Rank:</strong> #${person.rank}</div>
    <div><strong>Net worth:</strong> ${moneyFormatter.format(person.net_worth)}</div>
    <div><strong>Company:</strong> ${person.company}</div>
    <div><strong>Country:</strong> ${person.country}</div>
  `;
}

function renderItems() {
	itemsGridEl.innerHTML = "";

	const visibleItems = getVisibleItems();
	itemsCountEl.textContent = `${visibleItems.length} items shown`;

	for (const item of visibleItems) {
		const quantity = STATE.cart[item.id] || 0;

		const card = document.createElement("div");
		card.className = "item";
		card.dataset.category = item.category;

		card.innerHTML = `
      <div><strong>${item.name}</strong></div>
      <div>Price: ${moneyFormatter.format(item.price)}</div>
      <div>Category: ${item.category}</div>

      <div style="margin-top: 8px;">
	<button type="button" data-id="${item.id}" class="minus">-</button>
	<input
	  type="number"
	  min="0"
	  step="1"
	  data-id="${item.id}"
	  class="qty"
	  value="${quantity}"
	  style="width: 70px; text-align: center;"
	/>
	<button type="button" data-id="${item.id}" class="plus">+</button>
      </div>
    `;

		itemsGridEl.appendChild(card);
	}
}

function renderTotal() {
	const { total } = getDerivedMetrics();

	totalBarEl.innerHTML = `
    <strong>Total Spent:</strong> ${moneyFormatter.format(total)}
  `;
}

function renderWealthStats() {
	const metrics = getDerivedMetrics();
	const {
		percent,
		remaining,
		fraction,
		households,
		savingsMultiple,
		yearsToReachWealth,
		yearsToAffordCartWithSavings,
		remainingAfterSavings,
	} = metrics;

	wealthStatsEl.innerHTML = `
    <div><strong>Percent of wealth:</strong> ${
			percent < 0.000001 ? "<0.000001" : percent.toFixed(6)
		}%</div>

    <div><strong>Remaining:</strong> ${moneyFormatter.format(remaining)}</div>

    <div><strong>1 in X:</strong> 1 / ${fraction.toLocaleString()}</div>

    <div style="margin-top:10px;">
      <div style="height:20px;background:#ddd;border-radius:10px;overflow:hidden;">
		<div style="height:100%;width:${Math.min(percent, 100)}%;background:#4caf50;"></div>
      </div>
    </div>

    <div style="margin-top:10px;">
      <strong>Impact:</strong><br>
      Could support ${Math.floor(households).toLocaleString()} people for a year
    </div>

    <div style="margin-top:10px;">
      <strong>Compared to your savings:</strong><br>
      ${savingsMultiple ? `${savingsMultiple.toFixed(2)}x your current savings` : "Add your savings to compare"}
    </div>

    <div style="margin-top:10px;">
      <strong>Time to reach this billionaire's wealth:</strong><br>
      ${yearsToReachWealth ? `${numberFormatter.format(yearsToReachWealth)} years at your current income` : "Add income details to compare"}
    </div>

    <div style="margin-top:10px;">
      <strong>Time to afford this cart using savings first:</strong><br>
      ${STATE.userFinance.hourlyWage > 0 ? `${yearsToAffordCartWithSavings.toFixed(2)} years after using ${moneyFormatter.format(STATE.userFinance.savings)} in savings` : "Add income details to compare"}
      <br>
      <span style="opacity:0.8;">Remaining after savings: ${moneyFormatter.format(remainingAfterSavings)}</span>
    </div>
  `;
}


function renderWorkTime() {
	const timeEquivalentsEl = document.getElementById("timeEquivalents");
	if (!workTimeEl || !timeEquivalentsEl) return;
	const metrics = getDerivedMetrics();
	const { hoursToAffordCart, yearsToAffordCart } = metrics;
	const { hourlyWage } = STATE.userFinance;

	if (!hourlyWage || hourlyWage <= 0) {
		workTimeEl.textContent = "--";
		timeEquivalentsEl.textContent = "--";
		return;
	}

	const workdays = hoursToAffordCart / 8;
	const lifetimes = yearsToAffordCart / 80;
	const generations = yearsToAffordCart / 25;
	const romanEmpires = yearsToAffordCart / 500;
	const oliveTreeLifetimes = yearsToAffordCart / 1000;

	workTimeEl.innerHTML = `
		<div><strong>Work required:</strong></div>
		<div>${numberFormatter.format(hoursToAffordCart)} hours</div>
		<div>${yearsToAffordCart.toFixed(2)} years</div>
	`;

	timeEquivalentsEl.innerHTML = `
		<div><strong>Equivalent to:</strong></div>
		<div>${numberFormatter.format(workdays)} workdays</div>
		<div>${lifetimes.toFixed(2)} human lifetimes</div>
		<div>${generations.toFixed(2)} generations</div>
		<div>${romanEmpires.toFixed(3)} Roman Empires</div>
		<div>${oliveTreeLifetimes.toFixed(3)} olive tree lifetimes</div>
	`;
}

function renderStickySummary() {
	const person = STATE.selectedPerson;
	const metrics = getDerivedMetrics();
	const { total, percent } = metrics;

	document.getElementById("stickyPerson").textContent = person ? person.name : "--";
	document.getElementById("stickyTotal").textContent = moneyFormatter.format(total);
	document.getElementById("stickyPercent").textContent =
		percent < 0.000001 ? "<0.000001%" : percent.toFixed(6) + "%";

	renderStickyWorkTime();
}

function renderStickyWorkTime() {
	const { hourlyWage } = STATE.userFinance;
	const { yearsToAffordCart } = getDerivedMetrics();

	if (!hourlyWage || hourlyWage <= 0) {
		document.getElementById("stickyWorkTime").textContent = "--";
		return;
	}

	document.getElementById("stickyWorkTime").textContent = `${yearsToAffordCart.toFixed(2)} yrs`;
}

function renderReceipt() {
	if (!receiptEl) return;

	const person = STATE.selectedPerson;
	const metrics = getDerivedMetrics();
	const { total, percent, remaining } = metrics;

	const cartItems = STATE.items
		.filter((item) => (STATE.cart[item.id] || 0) > 0)
		.map((item) => ({
			name: item.name,
			quantity: STATE.cart[item.id],
			unitPrice: item.price,
			subtotal: STATE.cart[item.id] * item.price,
		}))
		.sort((a, b) => b.subtotal - a.subtotal);

	if (cartItems.length === 0) {
		receiptEl.innerHTML = "";
		return;
	}

	const lines = cartItems.map((entry) => {
		const qtyLabel = entry.quantity > 1 ? `x${numberFormatter.format(entry.quantity)}` : "";
		return `
			<div class="receipt-line">
				<span class="receipt-item-name">${entry.name} ${qtyLabel}</span>
				<span class="receipt-item-subtotal">${moneyFormatter.format(entry.subtotal)}</span>
			</div>
		`;
	}).join("");

	receiptEl.innerHTML = `
		<div class="receipt-header">
			<div class="receipt-title">Spending Receipt</div>
			${person ? `<div class="receipt-person">${person.name}'s Fortune</div>` : ""}
		</div>
		<div class="receipt-divider"></div>
		<div class="receipt-body">
			${lines}
		</div>
		<div class="receipt-divider"></div>
		<div class="receipt-footer">
			<div class="receipt-line receipt-total">
				<span>Total Spent</span>
				<span>${moneyFormatter.format(total)}</span>
			</div>
			<div class="receipt-line">
				<span>Remaining</span>
				<span>${moneyFormatter.format(remaining)}</span>
			</div>
			<div class="receipt-line">
				<span>Percent Used</span>
				<span>${percent < 0.000001 ? "<0.000001" : percent.toFixed(6)}%</span>
			</div>
		</div>
		<div class="receipt-barcode"></div>
	`;
}

function syncFinanceInputsFromState() {
	if (wageInputEl) {
		wageInputEl.value = STATE.userFinance.hourlyWage || "";
	}
	if (hoursPerWeekInputEl) {
		hoursPerWeekInputEl.value = STATE.userFinance.hoursPerWeek || 40;
	}
	if (weeksPerYearInputEl) {
		weeksPerYearInputEl.value = STATE.userFinance.weeksPerYear || 52;
	}
	if (savingsInputEl) {
		savingsInputEl.value = STATE.userFinance.savings || "";
	}
}

function renderPositionComparison() {
	const metrics = getDerivedMetrics();
	const {
		yearlyIncome,
		yearsToReachWealth,
		lifetimesToReachWealth,
		workingLifetimesToReachWealth,
		savingsMultiple,
		yearsToAffordCartWithSavings,
		remainingAfterSavings,
	} = metrics;

	annualIncomeDisplayEl.textContent =
		yearlyIncome > 0 ? moneyFormatter.format(yearlyIncome) : "Add income details";

	yearsToWealthDisplayEl.innerHTML =
		yearsToReachWealth
			? `
				${numberFormatter.format(yearsToReachWealth)} years<br>
				<span style="opacity:0.8;">
					≈ ${lifetimesToReachWealth.toFixed(2)} lifetimes<br>
					≈ ${workingLifetimesToReachWealth.toFixed(2)} full working lives
				</span>
			`
			: "Add income details";

	savingsComparisonDisplayEl.textContent =
		savingsMultiple ? `${savingsMultiple.toFixed(2)}x your current savings` : "Add your savings";

	cartAfterSavingsDisplayEl.textContent =
		STATE.userFinance.hourlyWage > 0
			? `${yearsToAffordCartWithSavings.toFixed(2)} years (${moneyFormatter.format(remainingAfterSavings)} remaining after savings)`
			: "Add income details";
}

function updateUI() {
  renderPersonDetails();
  renderCategoryFilters();
  renderItems();
  renderTotal();
  renderWealthStats();
  renderWorkTime();
  renderStickySummary();
  renderPositionComparison();
  renderSourceDisplays();
  renderReceipt();
  renderPresetButtons();
}

function attachEvents() {
	itemsGridEl.addEventListener("click", (event) => {
		const target = event.target;

		if (!(target instanceof HTMLElement)) return;

		const id = target.dataset.id;
		if (!id) return;

		if (target.classList.contains("plus")) {
			STATE.cart[id] = (STATE.cart[id] || 0) + 1;
			STATE.activePreset = null;
			playKaching();
			const itemCard = target.closest(".item");
			if (itemCard) {
				itemCard.classList.remove("flash");
				void itemCard.offsetWidth;
				itemCard.classList.add("flash");
			}
			saveState();
			updateUI();
			return;
		}

		if (target.classList.contains("minus")) {
			STATE.cart[id] = Math.max(0, (STATE.cart[id] || 0) - 1);
			STATE.activePreset = null;
			playSubtleTick();
			saveState();
			updateUI();
		}
	});

	itemsGridEl.addEventListener("input", (event) => {
		const target = event.target;

		if (!(target instanceof HTMLInputElement)) return;
		if (!target.classList.contains("qty")) return;

		const id = target.dataset.id;
		if (!id) return;

		let value = parseInt(target.value, 10);

		if (!Number.isFinite(value) || value < 0) {
			value = 0;
		}

		STATE.cart[id] = value;
		STATE.activePreset = null;
		saveState();
		updateUI();
	});

	const categoryFiltersEl = document.getElementById("categoryFilters");

	if (categoryFiltersEl) {
		categoryFiltersEl.addEventListener("click", (event) => {
			const target = event.target;

			if (!(target instanceof HTMLElement)) return;
			if (!target.classList.contains("filterBtn")) return;

			const nextCategory = target.dataset.category;
			if (!nextCategory) return;

			STATE.activeCategory = nextCategory;
			saveState();
			updateUI();
		});
	}

	const presetBundlesEl = document.getElementById("presetBundles");

	if (presetBundlesEl) {
		presetBundlesEl.addEventListener("click", (event) => {
			const target = event.target;

			if (!(target instanceof HTMLElement)) return;
			if (!target.classList.contains("presetBtn")) return;

			const presetKey = target.dataset.preset;
			if (!presetKey) return;

			applyPresetBundle(presetKey);
		});
	}

	personSelectEl.addEventListener("change", () => {
		const selected = STATE.people.find((person) => person.id === personSelectEl.value);

		if (selected) {
			STATE.selectedPerson = selected;
			saveState();
			updateUI();
		}
	});

	if (wageInputEl) {
		wageInputEl.addEventListener("input", () => {
			const val = parseFloat(wageInputEl.value);
			STATE.userFinance.hourlyWage = Number.isFinite(val) ? val : 0;
			saveState();
			updateUI();
		});
	}

	if (hoursPerWeekInputEl) {
		hoursPerWeekInputEl.addEventListener("input", () => {
			const val = parseFloat(hoursPerWeekInputEl.value);
			STATE.userFinance.hoursPerWeek = Number.isFinite(val) ? val : 0;
			saveState();
			updateUI();
		});
	}

	if (weeksPerYearInputEl) {
		weeksPerYearInputEl.addEventListener("input", () => {
			const val = parseFloat(weeksPerYearInputEl.value);
			STATE.userFinance.weeksPerYear = Number.isFinite(val) ? val : 0;
			saveState();
			updateUI();
		});
	}

	if (savingsInputEl) {
		savingsInputEl.addEventListener("input", () => {
			const val = parseFloat(savingsInputEl.value);
			STATE.userFinance.savings = Number.isFinite(val) ? val : 0;
			saveState();
			updateUI();
		});
	}

	if (resetAppBtnEl) {
		resetAppBtnEl.addEventListener("click", () => {
		resetAppState();
		});
	}

	if (shareResultsBtnEl) {
		shareResultsBtnEl.addEventListener("click", async () => {
			await shareResults();
		});
	}

	if (printReceiptBtnEl) {
		printReceiptBtnEl.addEventListener("click", () => {
			printReceipt();
		});
	}

	if (soundToggleBtnEl) {
		soundToggleBtnEl.addEventListener("click", () => {
			STATE.soundEnabled = !STATE.soundEnabled;
			soundToggleBtnEl.textContent = STATE.soundEnabled ? "🔊" : "🔇";
			saveState();
		});
		soundToggleBtnEl.textContent = STATE.soundEnabled ? "🔊" : "🔇";
	}

	if (searchInputEl) {
		searchInputEl.addEventListener("input", () => {
			STATE.searchText = searchInputEl.value.trim();
			renderSearchSuggestions();
			updateUI();
		});

		searchInputEl.addEventListener("keydown", (e) => {
			if (e.key === "Escape") {
				clearSearch();
			}
		});
	}

	if (searchSuggestionsEl) {
		searchSuggestionsEl.addEventListener("click", (event) => {
			const target = event.target;
			if (!(target instanceof HTMLElement)) return;
			const suggestion = target.closest(".search-suggestion");
			if (!suggestion || !(suggestion instanceof HTMLElement)) return;
			const id = suggestion.dataset.id;
			if (!id) return;
			STATE.cart[id] = (STATE.cart[id] || 0) + 1;
			STATE.activePreset = null;
			playKaching();
			clearSearch();
			saveState();
			updateUI();
		});
	}

	document.addEventListener("click", (e) => {
		const target = e.target;
		if (!(target instanceof HTMLElement)) return;
		if (!target.closest(".panel") || !target.closest(".panel").querySelector("#searchInput")) {
			if (searchSuggestionsEl) {
				searchSuggestionsEl.style.display = "none";
			}
		}
	});
}

async function init() {
	try {
		loadState();
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

		STATE.people = peopleData.people;
		STATE.items = itemsData.items;
		STATE.selectedPerson = STATE.people[0];

		STATE.dataMeta.wealth = {
			source: peopleData.source,
			last_updated: peopleData.last_updated,
			source_url: peopleData.source_url || "",
		};

		STATE.dataMeta.items = {
			source: itemsData.source,
			last_updated: itemsData.last_updated,
			source_url: itemsData.source_url || "",
		};

		const urlParams = new URLSearchParams(window.location.search);
		const sharedState = urlParams.get("state");
		if (sharedState) {
			applySharedState(sharedState);
		}

		statusEl.textContent = "Loaded successfully.";
		metaEl.textContent =
			`People source: ${peopleData.source} | People updated: ${peopleData.last_updated} | ` +
			`Items source: ${itemsData.source} | Items updated: ${itemsData.last_updated}`;

		renderPersonOptions();
		syncFinanceInputsFromState();
		attachEvents();
		updateUI();
	} catch (error) {
		console.error(error);
		statusEl.textContent = `Error: ${error.message}`;
		metaEl.textContent = "Open the browser console if needed.";
	}
}

init();
