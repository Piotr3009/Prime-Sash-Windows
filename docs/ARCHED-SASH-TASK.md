# ARCHED SASH — overnight task for Claude Code

> **Dla Piotra (jak uruchomić):** sekcja „Uruchomienie" na końcu pliku. Reszta jest po angielsku, bo czyta ją Claude Code.

---

## 0. Mission

Implement **arched sash windows** (`sash-type = arched-group`) in this repo, end-to-end, following `docs/ARCHED-SASH-SPEC.md` (read it fully first — it is the source of truth for all decisions O1–O10, geometry, data model and phases).

Work **autonomously until everything is done or blocked**. The owner is asleep. Nobody will answer questions.

## 1. Autonomy contract — READ TWICE

1. **Never ask the user anything.** Do not call `AskUserQuestion`. Do not end your turn with a question. Do not wait for confirmation.
2. When something is ambiguous, pick the option that (a) matches the spec, (b) is simplest, (c) changes the fewest lines. Write one line `DECISION: <what> — <why>` into `docs/ARCHED-SASH-LOG.md` and continue.
3. When a step fails: debug it. Up to **5 genuinely different attempts**. Then write `BLOCKER: <phase/step> — <exact error> — <file:line> — <what you tried>` into the LOG, stash the broken change under a named stash (`git stash push -m "BLOCKED: <step>"` — never drop it), and move on to the next phase that does not depend on it.
4. **Never leave the repo broken.** At the end of every phase and at the very end: `cd 3d-src && npm run build` must succeed and `online-estimate.html` must load with zero new page errors (see §4). If not, stash the offending change and log it.
5. Keep going until all phases are DONE or BLOCKED. Then write the final report (§8). Only then stop.
6. Do not optimise, refactor, reformat, rename or "clean up" anything outside the scope in §3. No dependency upgrades. No touching `api/`, `db/`, Supabase, admin dashboards.

## 2. Hard rules (these override everything else)

### 2.1 Git
- Start: `git status --porcelain`. If non-empty → `git stash push -u -m "pre-arched-autostash"` and log it. **Never** `git checkout -- .`, `git restore .`, `git reset --hard`, `git clean`, `git stash drop`, `git stash clear`.
- Then: `git fetch origin` → `git checkout -b arched-sash origin/main`. If the branch already exists: `git checkout -b arched-sash-<YYYYMMDD-HHMM> origin/main`.
- **Never `git push`.** The owner pushes in the morning. (A deny rule enforces this — do not try to work around it.)
- Commit after every green phase gate: `git add -A && git commit -m "arched sash: phase N — <summary>"`. Also commit WIP at least hourly: `"arched sash: wip phase N"`. Commits are cheap; lost work is not.
- Never rewrite history. No `--amend` on commits you didn't make this session, no rebase, no force anything.

### 2.2 ZASADA #1 — never delete existing code
- Do not remove functions, lines, listeners, props, tracking, comments or CSS that exist on `origin/main` — **add alongside**.
- The ONLY removals allowed in this task:
  - the `disabled` attribute and the `Coming Soon` `<span>` on the four `arch-style` radios in `online-estimate.html`
  - the inline `opacity:0.45; pointer-events:none;` on those four `.radio-option` wrappers
  - the early-return guard for `arched-group` in the `sash-type` change handler (replace it with the real handler)
- Before **every** commit run `git diff --cached | grep '^-' | grep -v '^---'` and confirm every removed line is in the list above. Anything else removed → put it back, or log `DELETION: <file:line> — <why it was unavoidable>` (this should be empty).

### 2.3 Do not touch
- `head-type` / Glazing Arch (`ArchedGlassPane`, `ArchedTopRail`, the +10% surcharge) — separate product, stays as is
- triple sash, casement, arched casement, fix-only, doors — read them, copy from them, never modify them
- `casementOwnsConfig()` guard and `syncActiveProduct()` structure — extend, never restructure
- `ContourBeads` ring method in `FixFrameWindow.jsx` — reuse as-is; **never** replace with sweep/extrudePath
- `js/pricing-config.js` values for existing products
- `api/`, `db/`, admin dashboards, passport pages

### 2.4 Cache busting
Every edited JS file that is loaded via `<script src="...?v=N">` gets `N+1` in **every** HTML that references it (`grep -rn "filename.js?v=" --include=*.html .`). `3d/assets/window3d.js` is referenced from `index.html` and `online-estimate.html` — bump both. Read the current value; do not assume it.

### 2.5 Markers (regression guard from a previous incident)
Before the final report, verify these substrings still exist in the files on your branch: `tmmx` in `online-estimate.html` (≥3 occurrences), `index.html` (≥8), `admin-dashboard.html` (≥1), `customer-dashboard.html` (≥1). If any count dropped vs `origin/main`, you deleted something — restore it.

## 3. Scope — files you may edit

| File | What |
|---|---|
| `3d-src/src/components/ArchedSashWindow.jsx` | **NEW** component |
| `3d-src/src/App.jsx` | state for new fields, routing `sashType==='arched'`, `get3DConfig`/capture/restore/deps |
| `online-estimate.html` | unlock radios, new controls, handler, validation, SYNC registration, spec panel hooks, cache busts |
| `js/price-calculator.js` | `calculateArchedSash()` branch |
| `js/estimate-renderer.js` | SVG + spec rows for arched sash |
| `js/edit-mode.js` | restore of all new fields |
| `js/specification-controller.js` | product label |
| `js/estimate-manager.js` | only if new fields do not already flow into `specification` JSON |
| `index.html` | cache bust of `window3d.js` only |
| `docs/ARCHED-SASH-LOG.md` | **NEW** — your log and final report |

Anything else: read-only.

## 4. Environment and verification recipe

### 4.1 Build 3D
```
cd 3d-src
npm install        # only if node_modules is missing
npm run build      # must produce/refresh 3d/assets/window3d.js
```
Check the bundle changed (`git status 3d/assets/`). On Windows PowerShell separate commands with `;`.

### 4.2 Serve the site (static, no API needed)
From repo root, in the background with a timeout:
```
npx --yes http-server -p 8765 -s     # or: python -m http.server 8765
```
Kill it after each test run. The page works without the API: `window.pricingReady === true` and `typeof window.get3DConfig === 'function'` mean ready.

### 4.3 Playwright (Node) — in a scratch folder OUTSIDE the repo
```
mkdir ../arched-sash-proof && cd ../arched-sash-proof
npm init -y && npm i playwright && npx playwright install chromium
```
Launch chromium headless with `args: ['--use-gl=swiftshader','--enable-webgl','--ignore-gpu-blocklist']`, viewport 1400×900. Go to `http://localhost:8765/online-estimate.html`, `waitForFunction(() => window.pricingReady === true && typeof window.get3DConfig === 'function', {timeout: 45000})`, then wait 2500 ms.

Drive the UI like a user: `document.querySelector('input[name="X"][value="Y"]').click()` + `dispatchEvent(new Event('change',{bubbles:true}))`; for selects set `.value` + dispatch `change`; wait ~1900 ms after each action (debounce + 3D). Read state from `window.get3DConfig()`, `window.currentConfig`, `#sidebar-total-price`.

**Known benign console noise on a static server (ignore):** `supabaseClient` / `createClient` errors, `Menu placeholder not found`, HTTP 501 on POST, `Failed to load resource`. Anything else in `pageerror` is a failure.

Save screenshots of the 3D canvas (`#root-3d` or the `canvas`) to `../arched-sash-proof/<phase>-<case>.png`. List paths in the LOG.

### 4.4 Regression matrix — run after EVERY phase
Record price + `get3DConfig().extWidth/extHeight/sashType` + pageerror count for: `double 1000×1500`, `triple 2000`, `double + head-type=arch`, `casement`, `casement-type=arched`, `fix-only`, `door`. Compare with the same matrix captured **before** your first edit (do that capture first thing — it is your baseline). Any difference outside the arched product = regression → fix before committing.

## 5. Ground truth (condensed from the spec — spec wins on conflict)

- `sashType: 'arched'` (config value; the radio value stays `arched-group`)
- `archShape`: `'gothic-arch' | 'semi-circle' | 'segmental-arch' | 'elliptical-arch'` — same strings as `casArchShape`/`fixShape`
- `rise`: segmental `0.20·W`, elliptical `0.325·W`, semi `0.50·W`, gothic `0.866·W` (W = external frame width)
- `straightHeight = H − rise`; **upper sash (incl. arch) height = lower sash height = H_inner/2**; meeting rail at mid-height
- `upperMaxDrop = min(300, 0.25·straightHeight)`; upper sash opening clamped to it (separate from `maxLift`)
- Validation: `400 ≤ W ≤ 1500`; `H ≥ rise + 900`; `H_inner/2 − rise ≥ 300` → clamp the height input up and show the existing validation message style
- Mechanism: weights + cords + pulleys like every sash; pulleys at the top of the straight jambs; arched box head has no mechanism. **Do not use the word "springing" anywhere** (UI, code comments, spec rows) — use `straightHeight` / "arch start".
- Price: `basePrice_double(sqm) × 1.6` **applied to the base only**, then `+ archPatternPremium` (`intersecting 250, half-hub 150, hub-spoke 210, double-hub-spoke 270, triple-hub-spoke 320`) `+ bars + additional options`, then colour/quantity exactly as existing sash code. `headType` is ignored for arched.
- Bars: upper arched sash gets casement-style controls: pattern (semi: none/half-hub/hub-spoke/double-hub-spoke/triple-hub-spoke/**intersecting**; gothic: none/intersecting; segmental+elliptical: none) + H/V grid. Lower sash uses the existing `lower-bars`. Arch pattern mullions sit **on the upper sash V-bar columns** (not auto `round(W/450)`); V-bars of lower sash default to the upper's. A horizontal bar at arch start separates the arch zone from the grid.
- Production reads `estimate_items.specification` JSON (there is no CSV code in this repo) — every new field must be in that JSON and must round-trip through edit-mode unchanged.

## 6. Phases — execute in THIS order: 1 → 4 → 5 → 3 → 2

Rationale: a priced, saved, editable, 3D-visible arched sash without bars is shippable; bars and cords are polish.

### Phase 1 — 3D core (4 shapes, opening, no bars)
1. Capture the regression baseline (§4.4) BEFORE editing anything.
2. Create `3d-src/src/components/ArchedSashWindow.jsx`. Follow the pattern of `casement/ArchedCasementWindow.jsx` (arched outer frame + shaped leaf). Reuse: `arcPoints`, `makeFrameGeo`, `CurvedGlass`, `ContourBeads` from `fix-frame/FixFrameWindow.jsx` (export them if they are not exported — export, don't copy); shape point builders from `ArchedCasementWindow.jsx` (lines ~71–196); box pieces and lower sash from `ParametricSashWindow.jsx` (`Sash`, `PulleySet`, `JambWithPartingBead`, `ExternalBoxElement`, `LowerBottomRail`, `GlassPane`, stile/rail cores, beads) — export, don't copy.
   - Box: straight jambs to `straightHeight`, arched head by contour, cill as in double.
   - Upper sash: stiles to `H_inner/2 − rise`, arched top rail by contour, `CurvedGlass`, `ContourBeads`; slides down by `min(upperOpening, upperMaxDrop)`; the box arch stays.
   - Lower sash: existing `Sash`, `maxLift` as in double.
   - Materials/colours/glass type/spacer: same props as double so existing controls work.
   - Frame face ≥ 64 mm on the arch (thinner faces fold the geometry — known issue).
3. `App.jsx`: add state `archShape`, `archBarPattern`, `archHBars`, `archVBars`, `upperMaxDrop` (+ setters, `update3D` handling, the returned object of `get3DConfig`, the deps array, `captureState`/`restoreState`). Route `windowCategory==='sash' && sashType==='arched'` → `ArchedSashWindow`.
4. `online-estimate.html`: remove `disabled`/Coming Soon from the 4 radios; `arch-style` change → `update3D({sashType:'arched', archShape})` + price + spec; selecting `arched-group` sets `sashType:'arched'` and hides `#head-type-options`; register `arch-style` in `SYNC_NAMES` (and any new IDs in `SYNC_IDS`) near line ~5220 — **missing registration = price one step behind, a bug class this repo already had**; dimension validation from §5; `syncActiveProduct()` must emit the arched config when arched is active; the `[dim-sync]` watchdog must stay quiet.
5. Build, serve, screenshot: 4 shapes × (closed, `upperOpening=9999` → clamped). Run the regression matrix.
6. **Gate:** screenshots show an arched box with equal sashes; `get3DConfig()` reports `sashType:'arched'` + correct `archShape`; width change 1000→1200 updates 3D within 2 s; switching arched→double→arched keeps the dimension if in range; zero new pageerrors; matrix identical to baseline. Commit.

### Phase 4 — price, spec panel, SVG, save
1. `price-calculator.js`: `calculateArchedSash()` per §5; the sash branch dispatches to it when `sashType==='arched'`. Sanity: `1000×1600 semi` must equal `basePrice_double(1.6 m²)×1.6` + options — assert it in a test by computing both.
2. `specification-controller.js`: label `Arched Sash — Semicircular` / `Gothic` / `Segmental` / `Elliptical`.
3. `estimate-renderer.js`: spec rows (`Sash Type: Arched — <shape>`, `Arch rise`, `Upper sash opening: limited to N mm`), SVG front view with the arched upper glass (reuse the casement arch drawing at ~line 2799), meeting rail at mid-height. `shapeNames` map shared.
4. Confirm `estimate-manager.js` puts the new fields into `specification` and `viewer3d` (via `get3DConfig`) — add only if missing.
5. **Gate:** price identical via every route (select shape then width / width then shape / switch to double and back); spec panel and SVG show the shape; a simulated `specification` object contains all fields from §5. Matrix green. Commit.

### Phase 5 — edit-mode round trip
1. `edit-mode.js`: `setRadio('sash-type','arched-group')` when `fc.sashType==='arched'`, then `setRadio('arch-style', fc.archShape)`, bar pattern, H/V, and trigger the same handlers the UI uses (follow the pattern at ~line 353 for `cas-arch-shape`).
2. **Gate:** build a config → `captureState`/`specification` JSON A → restore through edit-mode → JSON B; `A` deep-equals `B`. Also 3D shows the same shape after restore. Matrix green. Commit.

### Phase 3 — bars
1. Controls for the upper sash: pattern radios per shape (§5) + H/V selects; V-bars hidden while a hub pattern is active (mirror `updateDesignBarsVisibility()`); lower `lower-bars` default V = upper V. Register everything in `SYNC_*`.
2. 3D: hub patterns from `SemiCircleFrame` logic (radii 0.3/0.6/0.8 × halfW, spokes 4/6/8, horizontal bar at arch start); `intersecting` for gothic from `GothicArchFrame` but mullions = V-bar columns; `intersecting` for **semicircular = new**: arcs from each mullion base, crossing, clipped to the semicircle, plus the horizontal bar. Bars go through the existing bar material/`FixBars` path.
3. Price: pattern premium + per-bar price as casement does.
4. **Gate:** screenshots: semi+intersecting 4 columns (reference photo 1), semi+half-hub 3 columns (photo 2), gothic+intersecting, segmental 2×2, lower 2×2; price includes premium; SVG draws the grid (pattern may be simplified to straight bars in SVG — log it). Matrix green. Commit.

### Phase 2 — cords, weights, horns, parity
1. Cords from pulleys to the upper meeting rail, weights in the box, horns on the upper sash (photo 1 has them), `openingType`, frosted glass, dual colour int/ext.
2. **Gate:** same controls as double produce the same visual features on arched. Matrix green. Commit.

## 7. Logging — `docs/ARCHED-SASH-LOG.md`

Create it at the start. Append as you go (timestamps). Sections:
- `## Timeline` — one line per meaningful step
- `## Decisions` — every `DECISION:` line
- `## Blockers` — every `BLOCKER:` with stash name
- `## Deletions` — must be empty or only §2.2 items
- `## Cache busts` — file → old → new
- `## Tests` — baseline matrix, per-phase matrix, pass/fail per gate, screenshot paths
- `## Commits` — hash + message

## 8. Final report (top of the LOG, written last)

```
STATUS: Phase 1 DONE | Phase 4 DONE | Phase 5 DONE | Phase 3 PARTIAL | Phase 2 BLOCKED
Branch: arched-sash   Commits: N   Build: OK   Regression matrix: identical to baseline
What to check by hand in the morning (max 5 bullets, exact clicks):
- open online-estimate.html → Sash → Arched → Gothic → width 1200 → expect height clamp to 2680 and 3D gothic
- ...
Open questions for Piotr (only things the spec does not answer):
- ...
```

## 9. Timeboxing

Do not spend more than ~90 minutes on a single blocker. Log, stash, move on. Finishing Phases 1+4+5 cleanly is worth more than a half-done Phase 3. If everything is done, do a final full matrix run, a final build, a final §2.5 marker check, write the report, and stop.

---

## Uruchomienie (dla Piotra)

1. Wrzuć folder `docs/` (SPEC + TASK + ten plik) i folder `.claude/` (settings z blokadami) do repo. Commit w GitHub Desktop: `arched sash spec + task`. **Push nie jest konieczny** — Claude Code pracuje lokalnie.
2. Zamknij edytory z otwartymi plikami repo (żeby nic nie nadpisało pracy Claude'a).
3. W PowerShell, w folderze repo:
   ```
   claude -p "Read docs/ARCHED-SASH-TASK.md and docs/ARCHED-SASH-SPEC.md in full, then execute the task to completion without asking any questions." --permission-mode auto
   ```
   `auto` = bez pytań, ale z klasyfikatorem bezpieczeństwa w tle (blokuje m.in. `git push`, `reset --hard`, `rm -rf`). Dodatkowo `.claude/settings.json` twardo zabrania pushy i kasowania — działa w każdym trybie.
   Jeśli `auto` nie jest dostępne na Twoim planie, zobaczysz to od razu przy starcie — wtedy użyj `--dangerously-skip-permissions` zamiast `--permission-mode auto` (brak klasyfikatora; blokady z `.claude/settings.json` nadal działają).
4. Rano: otwórz `docs/ARCHED-SASH-LOG.md` — raport jest na górze. Potem `online-estimate.html` lokalnie według listy „What to check by hand". Branch `arched-sash` pushujesz sam, jak zaakceptujesz.
