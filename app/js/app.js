// FILE: app.js — Entry point: loads data, initializes state, renders, attaches events

import { createInitialState, loadState, saveState, resetAppState } from "./state.js";
import { loadData, fetchExchangeRates } from "./api.js";
import { applySharedState } from "./utils.js";
import { updateUI, renderPersonOptions, renderStashStacks, setShareStatus } from "./render.js";
import { attachEvents } from "./events.js";

async function main() {
  const STATE = createInitialState();
  const statusEl = document.querySelector("#status");
  const metaEl = document.querySelector("#meta");

  function syncFinanceInputsFromState() {
    const { hourlyWage, hoursPerWeek, weeksPerYear, savings } = STATE.userFinance;
    const w = document.querySelector("#wage");
    const h = document.querySelector("#hoursPerWeek");
    const y = document.querySelector("#weeksPerYear");
    const s = document.querySelector("#savings");
    if (w) w.value = hourlyWage || "";
    if (h) h.value = hoursPerWeek || 40;
    if (y) y.value = weeksPerYear || 52;
    if (s) s.value = savings || "";
  }

  try {
    loadState(STATE);
    const { peopleData, itemsData } = await loadData(STATE);
    fetchExchangeRates(STATE).catch(() => {});

    // Apply shared state from URL if present
    const urlParams = new URLSearchParams(window.location.search);
    const sharedState = urlParams.get("state");
    if (sharedState) applySharedState(sharedState, STATE, STATE.people);

    // Status
    if (statusEl) statusEl.textContent = "Loaded successfully.";
    if (metaEl) metaEl.textContent =
      `People source: ${peopleData.source} | People updated: ${peopleData.last_updated} | ` +
      `Items source: ${itemsData.source} | Items updated: ${itemsData.last_updated}`;

    // Initial render
    renderPersonOptions(STATE);
    syncFinanceInputsFromState();
    updateUI(STATE);

    // Attach all event listeners
    attachEvents(STATE, {
      saveStateFn: (st) => saveState(st),
      setShareStatusFn: (msg) => setShareStatus(msg),
      setPresetStatusFn: () => {},
      renderPresetButtonsFn: () => {},
      syncFinanceInputsFn: () => syncFinanceInputsFromState(),
      renderPersonOptionsFn: (st) => renderPersonOptions(st),
      resetAppStateFn: () => resetAppState(STATE, STATE.people),
    });
  } catch (error) {
    console.error(error);
    if (statusEl) statusEl.textContent = `Error: ${error.message}`;
    if (metaEl) metaEl.textContent = "Open the browser console if needed.";
  }
}

main();
