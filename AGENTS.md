# AGENTS.md

## Project Overview

"Spend a Billionaire's Fortune" — a vanilla HTML/CSS/JavaScript web app with no framework, no build step, and no bundler. Users pick a billionaire and simulate spending their fortune on everyday items to luxury goods.

**Two versions exist:**
- **Root** (`index.html` + `code.js`) — original prototype, inline data, plain `<script>` loading
- **`app/`** — active rebuild using ES modules, fetched JSON data, centralized state. **Target this version for all new work.**

## Repo History (read before making changes)

This project evolved through three repos:
1. **`ninotrivelli/Spend-Elon-Fortune`** — the original creator's repo (you accidentally pushed here)
2. **`youshouldstealthiscode/Spend-Elon-Fortune`** — your fork (intended working copy)
3. **`youshouldstealthiscode/spend-wealth-app`** — current repo, clean separation from original

Local branches on this repo:
- **`main`** (HEAD) — the most advanced version, synced with `origin/main`. This is the canonical branch.
- **`recovery-wealth`** — earlier snapshot (291-line `app.js`, no CSS/scripts). Historical reference only.
- **`rebuild/wealth-engine-2026`** — pinned to the `f3c60b6` fork point. Historical reference.
- **`reference/upstream-snapshot`** — snapshot of the original ninotrivelli repo. Historical reference.
- **`safety-old-main`** — same as fork point. Historical reference.

The fork repo (`youshouldstealthiscode/Spend-Elon-Fortune`) has two unmerged Codex branches with features that were built on the OLD `code.js` version. These are **not** needed — the `app/` rebuild already has superior implementations of those features.

## Commands

```bash
# Regenerate billionaire and item data (writes to both app/data/ and data/)
npm run update:data

# Individual data updates
npm run update:billionaires
npm run update:items
```

No build, lint, test, or dev server commands exist. Development uses VS Code Live Server on port 5501. There are no installed dependencies — only Node.js (v20+) for data scripts.

## Project Structure

```
app/
├── index.html          # Entry point (ES module)
├── style.css           # Dark theme styles
├── js/app.js           # All application logic (~759 lines)
└── data/
    ├── richest_people.json
    └── cpi_items.json
scripts/
├── update_billionaires.js   # Data generator (CommonJS)
└── update_items.js          # Data generator (CommonJS)
code.js                # OLD version — do not modify
index.html             # OLD version — do not modify
backups/               # Working snapshots (do not touch)
```

## Code Style — JavaScript (`app/js/app.js` conventions)

- **Indentation:** Tabs
- **Strings:** Double quotes; template literals for interpolation and multi-line HTML
- **Semicolons:** Always
- **Variables:** `const` by default, `let` only when reassignment is needed, never `var`
- **Functions:** `function` declarations for top-level; arrow functions only as callbacks
- **Naming:** camelCase for all JS identifiers; `El` suffix for DOM element references (`statusEl`, `personSelectEl`); verb-first function names (`loadX`, `renderX`, `updateX`, `getX`, `attachX`)
- **DOM selection:** `querySelector` / `querySelectorAll`; use `getElementById` inside render functions when ID is known
- **DOM rendering:** `.innerHTML` with template literals for complex blocks; `.textContent` for plain text updates
- **Event handling:** Event delegation on parent elements; guard with `instanceof HTMLElement` checks before accessing `dataset`
- **Error handling:** `try/catch` around all I/O and serialization; `console.warn` for non-fatal, `console.error` + DOM message for fatal errors in `init()`
- **State:** Single mutable `STATE` object; persist via `saveState()` → `localStorage`; restore via `loadState()` on init
- **Data fetching:** Use `fetchJson(path)` wrapper with `cache: "no-store"`; validate array shape before use; `Promise.all()` for parallel loads
- **Entry point:** `init()` called on the last line of the file

## Code Style — JSON Data

- Property names use `snake_case` (`net_worth`, `last_updated`, `source_url`, `source_type`)
- Files are pretty-printed with 2-space indent and trailing newline

## Code Style — CSS (`app/style.css`)

- CSS custom properties in `:root` for theming (`--bg`, `--panel`, `--text`, `--accent`)
- kebab-case class names; 4-space indent for properties
- CSS Grid for layout, Flexbox for simple alignment
- Single responsive breakpoint at 900px; `clamp()` for fluid typography
- Dark theme only (`color-scheme: dark`)

## Code Style — HTML

- Semantic markup; `class` for CSS hooks, `id` for JS hooks
- ES module script loading: `<script type="module" src="./js/app.js">`
- Self-closing tags with space before slash: `<br />`, `<meta ... />`

## Code Style — Node Scripts (`scripts/`)

- CommonJS (`require`) with `node:` protocol prefix for built-ins
- Shebang: `#!/usr/bin/env node`
- `PROJECT_ROOT` via `path.resolve(__dirname, "..")` for path resolution
- Write JSON to both `app/data/` and `data/` (dual output)
- `JSON.stringify(data, null, 2) + "\n"` with `fs.mkdirSync(..., { recursive: true })`

## CI/CD

GitHub Actions (`.github/workflows/update-data.yml`): runs daily at 5:17 UTC to regenerate data snapshots and auto-commit changes.

## What Does NOT Exist

- No linting (eslint, prettier, biome)
- No testing (jest, vitest, playwright)
- No TypeScript
- No bundler (webpack, vite, parcel)
- No external runtime dependencies
- No Cursor rules, Copilot instructions, or prior AGENTS.md
