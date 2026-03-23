// FILE: app/js/app.js

const statusEl = document.querySelector("#status");
const metaEl = document.querySelector("#meta");
const personSelectEl = document.querySelector("#personSelect");
const personDetailsEl = document.querySelector("#personDetails");
const itemsCountEl = document.querySelector("#itemsCount");
const itemsGridEl = document.querySelector("#itemsGrid");
const totalBarEl = document.querySelector("#totalBar");
const wealthStatsEl = document.querySelector("#wealthStats");
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
};

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
	} catch (e) {
		console.warn("Failed to load state", e);
	}
}

function encodeShareState() {
	const payload = {
		selectedPersonId: STATE.selectedPerson ? STATE.selectedPerson.id : null,
		cart: STATE.cart,
		activeCategory: STATE.activeCategory,
		userFinance: STATE.userFinance,
	};

	return btoa(encodeURIComponent(JSON.stringify(payload)));
}

function applySharedState(encoded) {
	try {
		const decoded = JSON.parse(decodeURIComponent(atob(encoded)));

		if (decoded.cart) STATE.cart = decoded.cart;
		if (decoded.activeCategory) STATE.activeCategory = decoded.activeCategory;
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

function getVisibleItems() {
	if (STATE.activeCategory === "all") {
		return STATE.items;
	}

	return STATE.items.filter((item) => item.category === STATE.activeCategory);
}

function setPresetStatus(message) {
	if (!presetStatusEl) return;
	presetStatusEl.textContent = message;
}

function applyPresetBundle(presetKey) {
	const nextCart = { ...STATE.cart };

	const addQuantity = (itemId, quantity) => {
		nextCart[itemId] = (nextCart[itemId] || 0) + quantity;
	};

	switch (presetKey) {
		case "survive_month":
			addQuantity("rent_month", 1);
			addQuantity("bread_white_pan", 8);
			addQuantity("milk_gallon", 4);
			addQuantity("eggs_dozen", 4);
			addQuantity("rice_long_grain", 10);
			addQuantity("bananas_lb", 8);
			addQuantity("potatoes_lb", 10);
			addQuantity("chicken_whole_lb", 8);
			addQuantity("electricity_kwh", 300);
			addQuantity("natural_gas_therm", 40);
			setPresetStatus("Applied preset: Survive One Month.");
			break;
		case "stabilize_household":
			addQuantity("rent_month", 2);
			addQuantity("used_car", 1);
			addQuantity("doctor_visit", 2);
			addQuantity("bread_white_pan", 8);
			addQuantity("milk_gallon", 4);
			addQuantity("eggs_dozen", 4);
			setPresetStatus("Applied preset: Stabilize Household.");
			break;
		case "fix_car_and_rent":
			addQuantity("rent_month", 1);
			addQuantity("used_car", 1);
			setPresetStatus("Applied preset: Fix Car + Rent.");
			break;
		case "college_start":
			addQuantity("college_semester", 1);
			addQuantity("rent_month", 1);
			addQuantity("doctor_visit", 1);
			setPresetStatus("Applied preset: College Start.");
			break;
		default:
			setPresetStatus("Unknown preset.");
			return;
	}

	STATE.cart = nextCart;
	saveState();
	updateUI();
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
}

function attachEvents() {
	itemsGridEl.addEventListener("click", (event) => {
		const target = event.target;

		if (!(target instanceof HTMLElement)) return;

		const id = target.dataset.id;
		if (!id) return;

		if (target.classList.contains("plus")) {
			STATE.cart[id] = (STATE.cart[id] || 0) + 1;
			saveState();
			updateUI();
			return;
		}

		if (target.classList.contains("minus")) {
			STATE.cart[id] = Math.max(0, (STATE.cart[id] || 0) - 1);
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
