// FILE: js/events.js — All event listeners and handlers

import { playKaching, playSubtleTick } from "./audio.js";
import { applyPresetBundle, PRESETS } from "./presets.js";
import { setShareStatus, setPresetStatus } from "./render.js";
import { renderSearchSuggestions, renderPresetButtons, updateUI, flyBills, renderStashStacks } from "./render.js";
import { saveState } from "./state.js";
import { encodeShareState } from "./utils.js";

const $ = (sel) => document.querySelector(sel);

export function attachEvents(state, updateUICfg) {
  const {
    saveStateFn,
    setShareStatusFn,
    setPresetStatusFn,
    renderPresetButtonsFn,
    syncFinanceInputsFn,
    renderPersonOptionsFn,
    resetAppStateFn,
  } = updateUICfg;

  // ─── Cart: plus/minus buttons ───
  const itemsGrid = $("#itemsGrid");
  if (itemsGrid) {
    itemsGrid.addEventListener("click", (e) => {
      const target = e.target;
      if (!(target instanceof HTMLElement)) return;
      const id = target.dataset.id;
      if (!id) return;

      if (target.classList.contains("plus")) {
        state.cart[id] = (state.cart[id] || 0) + 1;
        state.activePreset = null;
        playKaching(state.soundEnabled);
        const card = target.closest(".item");
        if (card) {
          card.classList.remove("flash");
          void card.offsetWidth;
          card.classList.add("flash");
          flyBills(card, parseFloat(card.dataset.price) || 0, state);
        }
        saveStateFn(state);
        updateUI(state);
        return;
      }

      if (target.classList.contains("minus")) {
        state.cart[id] = Math.max(0, (state.cart[id] || 0) - 1);
        state.activePreset = null;
        playSubtleTick(state.soundEnabled);
        saveStateFn(state);
        updateUI(state);
      }
    });

    // ─── Cart: direct input & custom item fields ───
    itemsGrid.addEventListener("input", (e) => {
      const target = e.target;
      if (!(target instanceof HTMLInputElement)) return;

      if (target.classList.contains("custom-name-input")) {
        const custom = state.customItems.find((c) => c.id === target.dataset.id);
        if (custom) { custom.name = target.value; saveStateFn(state); }
        return;
      }

      if (target.classList.contains("custom-price-input")) {
        const custom = state.customItems.find((c) => c.id === target.dataset.id);
        if (custom) {
          custom.price = parseFloat(target.value) || 0;
          const card = target.closest(".item");
          if (card) card.dataset.price = custom.price;
          saveStateFn(state);
          updateUI(state);
        }
        return;
      }

      if (!target.classList.contains("qty")) return;
      const id = target.dataset.id;
      if (!id) return;
      let value = parseInt(target.value, 10);
      if (!Number.isFinite(value) || value < 0) value = 0;
      state.cart[id] = value;
      state.activePreset = null;
      saveStateFn(state);
      updateUI(state);
    });
  }

  // ─── Category filters ───
  const categoryFilters = $("#categoryFilters");
  if (categoryFilters) {
    categoryFilters.addEventListener("click", (e) => {
      const target = e.target;
      if (!(target instanceof HTMLElement) || !target.classList.contains("filterBtn")) return;
      const cat = target.dataset.category;
      if (!cat) return;
      state.activeCategory = cat;
      saveStateFn(state);
      updateUI(state);
    });
  }

  // ─── Preset buttons ───
  const presetBundles = $("#presetBundles");
  if (presetBundles) {
    presetBundles.addEventListener("click", (e) => {
      const target = e.target;
      if (!(target instanceof HTMLElement) || !target.classList.contains("presetBtn")) return;
      const key = target.dataset.preset;
      if (!key) return;
      applyPresetBundle(state, key, setPresetStatusFn, renderPresetButtonsFn, saveStateFn, updateUI);
    });
  }

  // ─── Billionaire selector ───
  const personSelect = $("#personSelect");
  if (personSelect) {
    personSelect.addEventListener("change", () => {
      const selected = state.people.find((p) => p.id === personSelect.value);
      if (selected) { state.selectedPerson = selected; saveStateFn(state); updateUI(state); }
    });
  }

  // ─── Finance inputs ───
  const bindFinanceInput = (el, key) => {
    if (!el) return;
    el.addEventListener("input", () => {
      const val = parseFloat(el.value);
      state.userFinance[key] = Number.isFinite(val) ? val : 0;
      saveStateFn(state);
      updateUI(state);
    });
  };
  bindFinanceInput($("#wage"), "hourlyWage");
  bindFinanceInput($("#hoursPerWeek"), "hoursPerWeek");
  bindFinanceInput($("#weeksPerYear"), "weeksPerYear");
  bindFinanceInput($("#savings"), "savings");

  // ─── Reset ───
  const resetBtn = $("#resetAppBtn");
  if (resetBtn) {
    resetBtn.addEventListener("click", () => {
      resetAppStateFn(state);
      syncFinanceInputsFn(state);
      renderPersonOptionsFn(state);
      updateUI(state);
      setShareStatusFn("App reset.");
    });
  }

  // ─── Share ───
  const shareBtn = $("#shareResultsBtn");
  if (shareBtn) {
    shareBtn.addEventListener("click", async () => {
      const shareUrl = `${window.location.origin}${window.location.pathname}?state=${encodeShareState(state)}`;
      try {
        if (navigator.share) {
          await navigator.share({ title: "Spend Wealth App Results", text: "Check out this billionaire wealth comparison.", url: shareUrl });
          setShareStatusFn("Shared.");
        } else {
          await navigator.clipboard.writeText(shareUrl);
          setShareStatusFn("Share link copied.");
        }
      } catch (e) {
        console.warn("Failed to share results", e);
        setShareStatusFn("Share failed.");
      }
    });
  }

  // ─── Print receipt ───
  const printBtn = $("#printReceiptBtn");
  if (printBtn) {
    printBtn.addEventListener("click", () => {
      const receiptEl = $("#receipt");
      if (!receiptEl || receiptEl.innerHTML === "") { setShareStatusFn("Nothing to print."); return; }
      const pw = window.open("", "_blank", "width=480,height=640");
      if (!pw) { setShareStatusFn("Pop-up blocked."); return; }
      pw.document.write(`<!DOCTYPE html><html><head><title>Receipt</title>
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
      pw.document.close();
      pw.focus();
      pw.print();
    });
  }

  // ─── Sound toggle ───
  const soundBtn = $("#soundToggleBtn");
  const soundIcon = $("#soundIcon");
  if (soundBtn) {
    soundBtn.addEventListener("click", () => {
      state.soundEnabled = !state.soundEnabled;
      if (soundIcon) soundIcon.textContent = state.soundEnabled ? "🔊" : "🔇";
      soundBtn.title = state.soundEnabled ? "Sound on — click to mute" : "Sound off — click to unmute";
      saveStateFn(state);
    });
    if (soundIcon) soundIcon.textContent = state.soundEnabled ? "🔊" : "🔇";
    soundBtn.title = state.soundEnabled ? "Sound on — click to mute" : "Sound off — click to unmute";
  }

  // ─── Search ───
  const searchInput = $("#searchInput");
  const searchSuggestions = $("#searchSuggestions");
  if (searchInput) {
    searchInput.addEventListener("input", () => {
      state.searchText = searchInput.value.trim();
      renderSearchSuggestions(state);
      updateUI(state);
    });
    searchInput.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        state.searchText = "";
        searchInput.value = "";
        if (searchSuggestions) { searchSuggestions.style.display = "none"; searchSuggestions.innerHTML = ""; }
        updateUI(state);
      }
    });
  }
  if (searchSuggestions) {
    searchSuggestions.addEventListener("click", (e) => {
      const target = e.target;
      if (!(target instanceof HTMLElement)) return;
      const suggestion = target.closest(".search-suggestion");
      if (!suggestion || !(suggestion instanceof HTMLElement)) return;
      const id = suggestion.dataset.id;
      if (!id) return;
      state.cart[id] = (state.cart[id] || 0) + 1;
      state.activePreset = null;
      playKaching(state.soundEnabled);
      state.searchText = "";
      if (searchInput) searchInput.value = "";
      searchSuggestions.style.display = "none";
      searchSuggestions.innerHTML = "";
      saveStateFn(state);
      updateUI(state);
    });
  }
  // Close search suggestions on outside click
  document.addEventListener("click", (e) => {
    const target = e.target;
    if (!(target instanceof HTMLElement)) return;
    if (!target.closest(".panel") || !target.closest(".panel").querySelector("#searchInput")) {
      if (searchSuggestions) searchSuggestions.style.display = "none";
    }
  });

  // ─── Currency ───
  const currencySelect = $("#currencySelect");
  if (currencySelect) {
    currencySelect.value = state.selectedCurrency;
    currencySelect.addEventListener("change", () => {
      state.selectedCurrency = currencySelect.value;
      saveStateFn(state);
      updateUI(state);
    });
  }

  // ─── Location / geolocation preset ───
  const locationBtn = $("#locationBtn");
  if (locationBtn) {
    locationBtn.addEventListener("click", () => {
      if (!navigator.geolocation) { setShareStatusFn("Geolocation not supported."); return; }
      locationBtn.disabled = true;
      locationBtn.textContent = "📍 Locating...";
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          locationBtn.disabled = false;
          locationBtn.textContent = "📍 My Location";
          const { latitude, longitude } = pos.coords;
          const region = detectRegion(latitude, longitude);
          if (region.preset && PRESETS[region.preset]) {
            applyPresetBundle(state, region.preset, setPresetStatusFn, renderPresetButtonsFn, saveStateFn, updateUI);
            setShareStatusFn("Applied " + region.label + " preset for your area.");
          } else {
            applyPresetBundle(state, "stabilize_household", setPresetStatusFn, renderPresetButtonsFn, saveStateFn, updateUI);
            setShareStatusFn("Applied general US preset. (" + region.label + ")");
          }
        },
        () => {
          locationBtn.disabled = false;
          locationBtn.textContent = "📍 My Location";
          setShareStatusFn("Location denied. Using default preset.");
          applyPresetBundle(state, "stabilize_household", setPresetStatusFn, renderPresetButtonsFn, saveStateFn, updateUI);
        },
        { timeout: 8000 }
      );
    });
  }

  // ─── Stash toggle ───
  const stashToggle = $("#stashToggle");
  const stashPanel = $("#stashPanel");
  if (stashToggle && stashPanel) {
    stashToggle.addEventListener("click", () => {
      const isVisible = stashPanel.style.display !== "none";
      stashPanel.style.display = isVisible ? "none" : "block";
      if (!isVisible) {
        renderStashStacks(state);
      }
    });
  }
}

// ─── Geolocation region detection ───
function detectRegion(lat, lng) {
  if (lat >= 24 && lat <= 50 && lng >= -130 && lng <= -60) {
    if (lat >= 37 && lat <= 42 && lng >= -124 && lng <= -117) return { label: "California (high rent)", preset: "survive_month" };
    if (lat >= 25 && lat <= 31 && lng >= -88 && lng <= -80) return { label: "Florida", preset: "fix_car_and_rent" };
    if (lat >= 40 && lat <= 45 && lng >= -80 && lng <= -73) return { label: "Northeast US (high cost)", preset: "survive_month" };
    return { label: "United States", preset: "stabilize_household" };
  }
  if (lat >= 46 && lat <= 84 && lng >= -141 && lng <= -52) return { label: "Canada", preset: "fix_car_and_rent" };
  if (lat >= 35 && lat <= 72 && lng >= -12 && lng <= 45) return { label: "Europe", preset: "stabilize_household" };
  if (lat >= -45 && lat <= -10 && lng >= 110 && lng <= 155) return { label: "Australia", preset: "fix_car_and_rent" };
  return { label: "International", preset: "stabilize_household" };
}
