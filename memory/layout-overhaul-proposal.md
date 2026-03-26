# $pend Layout Overhaul Proposal (March 2026)

## User Feedback That Drove This

> "if possible maybe you should make the display part at the bottom, and have the controls in a hanging panel at the top. People want to be able to easily see the changes while they're clicking them"

## Current Layout (Before)

```
[sticky summary bar]
[action bar: Reset | Share | Print | 🔊 Sound | Currency | 📍 Location]
[title: "Spend Wealth App"]
[data status panel]
[billionaire selector panel]
┌─────────────────────────┬──────────────────────┐
│ Items (3 cols)          │ Sidebar              │
│ - total bar             │ - income inputs      │
│ - wealth stats          │ - position comparison│
│ - filters               │ - presets            │
│ - search                │ - receipt            │
│ - items grid            │ - sources            │
└─────────────────────────┴──────────────────────┘
```

**Problem:** Items get 65% width → only 3 columns. Sidebar panels compete for space.

## Proposed Layout (After)

```
[sticky summary bar - always visible, shows running totals]
[action bar: Reset | Share | Print | 🔊 Sound Currency | 📍 Location]
[$pend title - small, compact]
[status line - muted, fades after load]
┌──────────────────────────────────────────────────────┐
│ Controls Bar (compact inline)                        │
│ [Billionaire ▼] [Filters: All|Essentials|Housing...] │
│ [Search items...                     🔍]             │
├──────────────────────────────────────────────────────┤
│ Items Grid - FULL WIDTH (4-5 columns)                │
│ ┌──┐ ┌──┐ ┌──┐ ┌──┐ ┌──┐                          │
│ │  │ │  │ │  │ │  │ │  │  +/- buttons              │
│ └──┘ └──┘ └──┘ └──┘ └──┘                          │
├──────────────────────────────────────────────────────┤
│ Results Dashboard (below items, auto-fit grid)       │
│ ┌──────────────┬──────────────┬──────────────┐      │
│ │ Wealth Stats │ Work Time    │ Position     │      │
│ │ (percent,    │ (hours,      │ (years to    │      │
│ │  remaining,  │  lifetimes,  │  reach,      │      │
│ │  progress)   │  generations)│  savings)    │      │
│ ├──────────────┼──────────────┼──────────────┤      │
│ │ Receipt      │ Presets      │ Sources      │      │
│ └──────────────┴──────────────┴──────────────┘      │
└──────────────────────────────────────────────────────┘
```

## Key Changes

| What | Current | Proposed |
|---|---|---|
| Items grid width | 65% (sidebar blocks) | 100% full width |
| Item columns | 3 | 4-5 |
| Billionaire selector | Separate panel | Inline in controls bar |
| Wealth/stats/income | Mixed in sidebar | 3-col results grid below items |
| Receipt/presets/sources | Mixed in sidebar | 3-col results grid below stats |
| Data status | Full panel at top | Small muted line, auto-hides |
| Title | "Spend Wealth App" | "$pend" |
| Category text on cards | "Category: essentials" | Removed (filters visible) |
| Progress bar colors | Hardcoded #ddd/#4caf50 | CSS variables |

## Responsive Behavior

- **Desktop (>900px)**: Items 4-5 cols, results 3-col row
- **Tablet (600-900px)**: Items 3 cols, results 2-col row, controls stack
- **Mobile (<600px)**: Items 2 cols, results 1-col, controls fully stacked

## Files To Change

1. `app/index.html` — Flatten structure, new layout
2. `app/style.css` — Remove `.dashboard-grid`, add `.controls-bar`, `.results-grid`
3. `app/js/app.js` — Minimal: remove redundant person details, keep all IDs
