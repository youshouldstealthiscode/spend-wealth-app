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
const soundIconEl = document.querySelector("#soundIcon");
const currencySelectEl = document.querySelector("#currencySelect");
const locationBtnEl = document.querySelector("#locationBtn");
const stashToggleEl = document.querySelector("#stashToggle");
const stashPanelEl = document.querySelector("#stashPanel");
const shareStatusEl = document.querySelector("#shareStatus");
const presetStatusEl = document.querySelector("#presetStatus");
const wealthSourceDisplayEl = document.querySelector("#wealthSourceDisplay");
const itemSourceDisplayEl = document.querySelector("#itemSourceDisplay");

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
	selectedCurrency: "USD",
	exchangeRates: { USD: 1 },
	ratesLoaded: false,
};

let audioCtx = null;

function getAudioCtx() {
	if (!audioCtx) {
		audioCtx = new (window.AudioContext || window.webkitAudioContext)();
	}
	return audioCtx;
}

const kachingAudio = new Audio("./sfx/kaching.mp3");
kachingAudio.preload = "auto";
kachingAudio.volume = 0.7;

function playKaching() {
	if (!STATE.soundEnabled) return;
	try {
		kachingAudio.currentTime = 0;
		kachingAudio.play().catch(() => {});
	} catch (e) {
		// Audio not available — fail silently
	}
}

function playSubtleTick() {
	if (!STATE.soundEnabled) return;
	try {
		const ctx = getAudioCtx();
		const now = ctx.currentTime;
		const buf = ctx.createBuffer(1, ctx.sampleRate * 0.02, ctx.sampleRate);
		const data = buf.getChannelData(0);
		for (let i = 0; i < data.length; i++) {
			data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (data.length * 0.1));
		}
		const src = ctx.createBufferSource();
		src.buffer = buf;
		const gain = ctx.createGain();
		gain.gain.setValueAtTime(0.15, now);
		gain.gain.exponentialRampToValueAtTime(0.001, now + 0.03);
		const filter = ctx.createBiquadFilter();
		filter.type = "bandpass";
		filter.frequency.value = 2500;
		filter.Q.value = 3;
		src.connect(filter);
		filter.connect(gain);
		gain.connect(ctx.destination);
		src.start(now);
	} catch (e) {
		// Audio not available
	}
}

function getDenominations(amount) {
	const denoms = [100, 50, 20, 10, 5, 1];
	const result = {};
	let remaining = Math.round(amount);
	for (const d of denoms) {
		result[d] = Math.floor(remaining / d);
		remaining %= d;
	}
	return result;
}

function renderStashStacks() {
	const stacksEl = document.getElementById("stashStacks");
	if (!stacksEl) return;

	const metrics = getDerivedMetrics();
	const remaining = Math.max(0, metrics.remaining);
	const denomCounts = getDenominations(remaining);
	const denoms = [1, 5, 10, 20, 50, 100];

	const maxBills = 20;

	stacksEl.innerHTML = denoms.map((d) => {
		const count = denomCounts[d];
		const displayCount = Math.min(count, maxBills);
		const bars = [];
		for (let i = 0; i < displayCount; i++) {
			bars.push(`<div class="stash-bill bill-${d}"></div>`);
		}
		const overflow = count > maxBills ? `<div style="font-size:0.5rem;color:var(--muted);margin-top:1px;">+${numberFormatter.format(count - maxBills)}</div>` : "";
		return `<div class="stash-stack" data-denom="${d}">${bars.join("")}${overflow}</div>`;
	}).join("");

	const remainingEl = document.getElementById("stashRemaining");
	if (remainingEl) {
		remainingEl.textContent = formatCurrency(remaining);
	}
}

function flyBills(sourceEl, cost) {
	if (cost <= 0) return;

	const stashEl = document.getElementById("fortuneStash");
	const stacksEl = document.getElementById("stashStacks");
	if (!stashEl || !stacksEl) return;

	const srcRect = sourceEl.getBoundingClientRect();
	const stashRect = stashEl.getBoundingClientRect();

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

			setTimeout(() => {
				bill.classList.add("animate");
			}, delay);

			setTimeout(() => {
				bill.remove();
			}, delay + 700);
		}
	}

	const toggle = document.getElementById("stashToggle");
	if (toggle) {
		toggle.classList.remove("burn");
		void toggle.offsetWidth;
		toggle.classList.add("burn");
	}

	const panel = document.getElementById("stashPanel");
	if (panel && cost > 1000) {
		panel.classList.remove("burning");
		void panel.offsetWidth;
		panel.classList.add("burning");
	}
}

const CURRENCY_SYMBOLS = {
	USD: "$", EUR: "€", GBP: "£", JPY: "¥", CAD: "$",
	AUD: "$", INR: "₹", BRL: "R$", CHF: "CHF ", MXN: "$",
};

async function fetchExchangeRates() {
	try {
		const res = await fetch("https://api.exchangerate.fun/latest?base=USD");
		if (!res.ok) throw new Error(res.status);
		const data = await res.json();
		if (data.rates) {
			STATE.exchangeRates = data.rates;
			STATE.ratesLoaded = true;
		}
	} catch (e) {
		console.warn("Exchange rates unavailable, using USD only", e);
	}
}

function convertFromUsd(amount) {
	const rate = STATE.exchangeRates[STATE.selectedCurrency] || 1;
	return amount * rate;
}

function formatCurrency(amount) {
	const cur = STATE.selectedCurrency;
	const symbol = CURRENCY_SYMBOLS[cur] || cur + " ";
	const converted = convertFromUsd(amount);

	if (cur === "JPY") {
		return symbol + Math.round(converted).toLocaleString("en-US");
	}

	return symbol + converted.toLocaleString("en-US", {
		minimumFractionDigits: 0,
		maximumFractionDigits: 0,
	});
}

let moneyFormatter = {
	format: (n) => formatCurrency(n),
};

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
		if (parsed.selectedCurrency) STATE.selectedCurrency = parsed.selectedCurrency;
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

function applyLocationPreset() {
	if (!navigator.geolocation) {
		setShareStatus("Geolocation not supported.");
		return;
	}

	locationBtnEl.disabled = true;
	locationBtnEl.textContent = "📍 Locating...";

	navigator.geolocation.getCurrentPosition(
		(pos) => {
			locationBtnEl.disabled = false;
			locationBtnEl.textContent = "📍 My Location";
			const { latitude, longitude } = pos.coords;

			const region = detectRegion(latitude, longitude);
			const presetKey = region.preset;
			const label = region.label;

			if (presetKey && PRESET_DEFINITIONS[presetKey]) {
				applyPresetBundle(presetKey);
				setShareStatus("Applied " + label + " preset for your area.");
			} else {
				applyPresetBundle("stabilize_household");
				setShareStatus("Applied general US preset. (" + label + ")");
			}
		},
		(err) => {
			locationBtnEl.disabled = false;
			locationBtnEl.textContent = "📍 My Location";
			setShareStatus("Location denied. Using default preset.");
			applyPresetBundle("stabilize_household");
		},
		{ timeout: 8000 }
	);
}

function detectRegion(lat, lng) {
	if (lat >= 24 && lat <= 50 && lng >= -130 && lng <= -60) {
		if (lat >= 37 && lat <= 42 && lng >= -124 && lng <= -117) {
			return { label: "California (high rent)", preset: "survive_month" };
		}
		if (lat >= 25 && lat <= 31 && lng >= -88 && lng <= -80) {
			return { label: "Florida", preset: "fix_car_and_rent" };
		}
		if (lat >= 40 && lat <= 45 && lng >= -80 && lng <= -73) {
			return { label: "Northeast US (high cost)", preset: "survive_month" };
		}
		return { label: "United States", preset: "stabilize_household" };
	}
	if (lat >= 46 && lat <= 84 && lng >= -141 && lng <= -52) {
		return { label: "Canada", preset: "fix_car_and_rent" };
	}
	if (lat >= 35 && lat <= 72 && lng >= -12 && lng <= 45) {
		return { label: "Europe", preset: "stabilize_household" };
	}
	if (lat >= -45 && lat <= -10 && lng >= 110 && lng <= 155) {
		return { label: "Australia", preset: "fix_car_and_rent" };
	}
	return { label: "International", preset: "stabilize_household" };
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
  renderStashStacks();
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
				flyBills(itemCard, item.price);
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
			soundIconEl.textContent = STATE.soundEnabled ? "🔊" : "🔇";
			soundToggleBtnEl.title = STATE.soundEnabled ? "Sound on — click to mute" : "Sound off — click to unmute";
			saveState();
		});
		soundIconEl.textContent = STATE.soundEnabled ? "🔊" : "🔇";
		soundToggleBtnEl.title = STATE.soundEnabled ? "Sound on — click to mute" : "Sound off — click to unmute";
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

	if (currencySelectEl) {
		currencySelectEl.value = STATE.selectedCurrency;
		currencySelectEl.addEventListener("change", () => {
			STATE.selectedCurrency = currencySelectEl.value;
			saveState();
			updateUI();
		});
	}

	if (locationBtnEl) {
		locationBtnEl.addEventListener("click", () => {
			applyLocationPreset();
		});
	}

	if (stashToggleEl && stashPanelEl) {
		stashToggleEl.addEventListener("click", () => {
			const isVisible = stashPanelEl.style.display !== "none";
			stashPanelEl.style.display = isVisible ? "none" : "block";
			if (!isVisible) renderStashStacks();
		});
	}
}

async function init() {
	try {
		loadState();
		const [peopleData, itemsData] = await Promise.all([
			fetchJson("./data/richest_people.json"),
			fetchJson("./data/cpi_items.json"),
		]);

		fetchExchangeRates().catch(() => {});

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
