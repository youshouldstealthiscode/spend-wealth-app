// FILE: js/presets.js — Preset bundle definitions and logic

export const PRESETS = {
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
    items: { rent_month: 2, used_car: 1, doctor_visit: 2, bread_white_pan: 8, milk_gallon: 4, eggs_dozen: 4 },
  },
  fix_car_and_rent: {
    label: "Fix Car + Rent",
    items: { rent_month: 1, used_car: 1 },
  },
  college_start: {
    label: "College Start",
    items: { college_semester: 1, rent_month: 1, doctor_visit: 1 },
  },
  child_first_year: {
    label: "Child's First Year",
    items: {
      diapers_box: 12, baby_formula: 12, daycare_monthly: 12,
      baby_stroller: 1, child_car_seat: 1, doctor_visit: 4,
    },
  },
};

export function applyPresetBundle(state, presetKey, setPresetStatus, renderPresetButtons, saveState, updateUI) {
  const preset = PRESETS[presetKey];
  if (!preset) { setPresetStatus("Unknown preset."); return; }

  if (state.activePreset === presetKey) {
    // Toggle off — remove preset items from cart
    for (const [itemId, qty] of Object.entries(preset.items)) {
      state.cart[itemId] = Math.max(0, (state.cart[itemId] || 0) - qty);
      if (state.cart[itemId] === 0) delete state.cart[itemId];
    }
    state.activePreset = null;
    setPresetStatus("Removed preset: " + preset.label + ".");
  } else {
    // Remove old preset first
    if (state.activePreset && PRESETS[state.activePreset]) {
      for (const [itemId, qty] of Object.entries(PRESETS[state.activePreset].items)) {
        state.cart[itemId] = Math.max(0, (state.cart[itemId] || 0) - qty);
        if (state.cart[itemId] === 0) delete state.cart[itemId];
      }
    }
    for (const [itemId, qty] of Object.entries(preset.items)) {
      state.cart[itemId] = (state.cart[itemId] || 0) + qty;
    }
    state.activePreset = presetKey;
    setPresetStatus("Applied preset: " + preset.label + ".");
  }
  renderPresetButtons(state);
  saveState(state);
  updateUI(state);
}
