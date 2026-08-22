# ARCHED SASH — implementation log

> Final report is written at the top of this file at the end of the run (§8 of the task).
> Everything below is the running log.

---

## Timeline

- `T0` — Read `docs/ARCHED-SASH-TASK.md` and `docs/ARCHED-SASH-SPEC.md` in full.
- `T0` — `git status --porcelain` empty → no pre-work stash needed. `HEAD` == `origin/main` content-wise.
- `T0` — `git checkout -b arched-sash origin/main` (branch did not exist).
- `T0` — `cd 3d-src && npm install` (node_modules was missing) → OK, node v22.22.2 / npm 10.9.7.
- `T0` — Playwright harness created **outside** the repo at `/home/user/arched-sash-proof`.
  `npx playwright install chromium` fails in this sandbox (egress blocked); used the
  pre-installed `/opt/pw-browsers/chromium` via `executablePath` instead.
- `T0` — Static server: `python3 -m http.server 8765` at repo root (plus 8766 rooted at `3d/`
  for isolating the bundle).
- `T0` — **Harness blocker found and solved** (see Decisions D-T1/D-T2): the 3D tree was dead
  in headless, so every `get3DConfig()` read was a frozen snapshot of the first paint.
- `T0` — Baseline regression matrix captured **before any repo edit** → `matrix-baseline.json`.
- `T1` — **Phase 1 (3D core) DONE.** Additive named exports added to `FixFrameWindow.jsx`
  and `ParametricSashWindow.jsx`; new `ArchedSashWindow.jsx`; `App.jsx` state + routing +
  derived config; `online-estimate.html` radios unlocked, handler, validation, SYNC
  registration; `js/price-calculator.js` gained the canonical `window.ArchedSash` helper;
  `js/specification-controller.js` re-pushes the arched config after its generic push.
  Phase 1 gate: **all pass**. Matrix identical to baseline. Zero pageerrors.
- `T2` — **Phase 4 (price + spec + SVG + save) DONE.** `calculateArchedSash()` and its
  dispatch in `price-calculator.js`; arched label in `specification-controller.js`;
  `parseItem` arched fields, extended label chains, arched spec rows and a new
  `generateArchedSashSVG()` in `estimate-renderer.js`; explicit arched fields + a
  `sashType` normalisation in `estimate-manager.js`. Phase 4 gate: **all pass**, price
  sanity: **all pass**, matrix identical to baseline.
- `T3` — **Phase 5 (edit-mode round trip) DONE.** `js/edit-mode.js` maps the stored
  `'arched'` back to the `'arched-group'` radio, restores `arch-style` (and the bar
  controls once Phase 3 adds them) *before* the dimensions so the clamp uses the right
  shape, and re-runs `applyArchedSash()` after them. Round trip proven through the REAL
  edit-mode path with supabase stubbed: **specification and viewer3d both round-trip with
  zero differences**. A control run on a plain double sash was used to prove the only
  residual diffs are pre-existing.

---

## Decisions

- `DECISION: branch name = arched-sash` — the task (§2.1) names it explicitly and the run
  instruction repeats it; the branch did not exist, so no timestamped variant was needed.
  Nothing is ever pushed (task §2.1 + explicit instruction), so no remote branch is claimed.
- `DECISION: work solo, no subagents/workflows` — the session instructions forbid the Agent
  and Workflow tools unless requested; this task is a long serial edit of a few shared files
  where parallel writers would collide anyway.
- `DECISION (D-T1): harness stubs the troika font CDN` — drei's `<Text>` (used by every
  `DimensionGuide`) resolves fonts through troika's `unicode-font-resolver`, which fetches
  `cdn.jsdelivr.net`. Egress is blocked in this sandbox, the fetch rejects, and the whole
  R3F/React tree dies: the page paints once and then never re-renders again (a real click on
  the app's own "Rotate" button did nothing). Proven by `captureWindowScreenshots` being
  `undefined`. The stub lives in the harness (`/home/user/arched-sash-proof/fontstub.js`),
  **not** in the repo — this is a sandbox-network artefact, not an app bug.
- `DECISION: upper arched sash frame face = 64 mm, not the 57 mm of a straight stile` —
  the task and spec both flag that an arch contour folds in on itself below 64 mm. The
  meeting rail stays 43 mm, so the sash keeps the same meeting-rail line as a double.
- `DECISION: H_inner = H_total − 144` — the spec states O8 as `H_inner/2 − rise ≥ 300` but
  never defines H_inner numerically. 144 mm is what this codebase's geometry actually eats
  (sill 58.414 − jamb embed 23 + head 80 + the 3 mm running gaps), so the constraint is
  applied to the real clear opening. Combined with O4 this gives
  `minHeight = max(rise + 900, 2·rise + 744)`, rounded up to the 10 mm grid the selects use.
  Conservative: the resulting straight stile is ~100 mm longer than the 300 mm floor.
- `DECISION: gothic width is capped by the 3000 mm height limit` — at 0.866·W a 1500 mm
  gothic needs a 3300+ mm frame, which the height input cannot express. `maxWidthFor()`
  walks the width down instead, so gothic tops out at 1300 mm and the other three shapes
  keep the full 1500 mm (spec §9 risk 2 — caught before it reaches the 3D).
- `DECISION: the arched box head is a crescent polygon, not a shape-with-hole` — the head's
  opening reaches its own bottom edge, so a `THREE.Shape` hole touches the outer boundary
  and the triangulator emits a visible scalloped row of slivers along the arch start
  (reproduced with the beads removed, so it was the head, not `ContourBeads`). Tracing the
  outer arc up and the inner arc back down removes the hole entirely. `ContourBeads` is
  still used, unchanged, by the ring method on the sash.
- `DECISION: arched-sash bar geometry was written in Phase 1, wired to the UI in Phase 3` —
  it lives in the same component and is inert while `archBarPattern === 'none'`, so
  building it once avoided a second pass over the same file. Phase 1 renders no bars.
- `DECISION: 'arched-group' → 'arched' normalisation is additive` — the radio value stays
  `arched-group` (spec §5). Rather than editing the existing `sashType: sashType` pushes in
  `specification-controller.js` (which would be a deletion under ZASADA #1), a follow-up
  `update3D` re-push corrects them. Same for `syncActiveProduct` and `canonicalPrice`.
- `DECISION: 'arched-group' is normalised at the boundaries, not at the source` —
  `js/configurator-core.js` rewrites `currentConfig.sashType` from the radio on every
  `updateAll()`, and that file is **read-only** per task §3. So the normalisation sits at
  the four points that actually consume it: `syncActiveProduct`, `canonicalPrice`,
  `estimate-manager.getCurrentWindowConfig`/`getCurrentPrice`, and
  `estimate-renderer.parseItem`/`generateWindowSVG`. All additive.
- `DECISION: SVG draws the arch shape truly, the arch tracery patterns as a straight grid` —
  the four arch profiles are exact SVG arc commands (`A`), and the H/V grid is drawn.
  Hub/spoke and intersecting tracery is NOT drawn in the SVG; the pattern is named in the
  spec rows ("Upper sash bars: Intersecting + 0H × 4V") and the bar at the arch start is
  drawn. Task §Phase 3 gate explicitly allows this and asks for it to be logged.
- `DECISION: the arched label extends the existing ternary chains rather than replacing them` —
  `p.sashType === 'arched' ? p.archTypeLabel : <original chain>`. Every original token is
  still present, so the audit classifies it as a line extended in place, and every
  pre-existing input still produces its original output.
- `DECISION: five edit-mode colour keys are accounted for, not fixed` — restoring through
  edit-mode ADDS `frosted-location`, `woodColor`, `woodColorExt`, `woodColorInt` and
  `sameColor` to `currentConfig`, which the fresh configure path never sets. A control run
  on a plain **double** sash (`node phase5.js double`) produces exactly the same five, so
  this is pre-existing edit-mode behaviour, not arched. Nothing is lost — they are
  additions — and the cause sits outside the arched scope, so the test accounts for them
  and the code is left alone (ZASADA #1). Worth a separate ticket.
- `DECISION (D-T2): harness "nudges" get3DConfig before reading` — `window.get3DConfig` is
  re-installed by an effect keyed on the memoised config and in this browser build it lands
  one commit behind, so the first read after a change returns the PREVIOUS value. Two extra
  commits (`showGuides` off/on) flush it. Pre-existing app behaviour, out of scope (ZASADA #1),
  so the harness works around it instead of the repo being changed.

---

## Blockers

_(none yet)_

---

## Deletions

Audited with `/home/user/arched-sash-proof/audit-deletions.sh` before every commit
(the generated bundle `3d/assets/window3d.js` is excluded — it is rebuilt wholesale).

**Result: 0 unexplained removals.** Every `-` line is one of:

1. the `disabled` attribute + `Coming Soon` span + inline `opacity:0.45; pointer-events:none;`
   on the four `arch-style` radios — §2.2 permitted removal 1 and 2;
2. the two-line early-return guard `// Don't update dims/3D for arched-group … if (isArchedGroup) return;`
   — §2.2 permitted removal 3, replaced by the real handler;
3. a `?v=N` cache bust — mandated by §2.4;
4. a single-line object/array/deps list that was **extended in place** (proven a strict
   superset token-by-token by the audit script), or a trailing `}` that only gained a newline.

---

## Cache busts

| File | Old | New | Referenced from |
|---|---|---|---|
| `3d/assets/window3d.js` | v=95 | v=96 | `index.html`, `online-estimate.html` |
| `js/price-calculator.js` | v=11 | v=12 | `online-estimate.html` |
| `js/specification-controller.js` | v=8 | v=9 | `online-estimate.html` |
| `js/estimate-renderer.js` | v=31 | v=32 | `online-estimate.html`, `admin-dashboard.html`, `customer-dashboard.html` |
| `js/estimate-manager.js` | v=7 | v=8 | `online-estimate.html` |
| `js/edit-mode.js` | v=12 | v=13 | `online-estimate.html` |

---

## Tests

### Baseline regression matrix (captured before the first edit)

| Case | price | extWidth | extHeight | sashType | windowCategory | pageerrors |
|---|---|---|---|---|---|---|
| double 1000×1500 | £1211.25 | 1000 | 1500 | double | sash | 0 |
| triple 2000 | £2850.00 | 2000 | 1500 | triple | sash | 0 |
| double + head-type=arch | £1332.38 | 1000 | 1500 | double | sash | 0 |
| casement | £610.00 | 800 | 1500 | double | casement | 0 |
| casement-type=arched | £1550.00 | 1000 | 1500 | double | casement | 0 |
| fix-only | £675.00 | 1000 | 1500 | double | fix-only | 0 |
| door | £1852.20 | 900 | 2100 | double | door | 0 |

Stored at `/home/user/arched-sash-proof/matrix-baseline.json`.
Re-run with `node matrix.js <label>`; compare with `node compare.js <label>`.

### Phase gates

| Gate | Result | Evidence |
|---|---|---|
| Phase 1 — 3D core | **PASS** (all checks) | `node phase1.js` |
| Phase 1 — matrix | identical to baseline | `matrix-phase1.json` |
| Phase 4 — price/spec/SVG/save | **PASS** (all checks) | `node phase4.js` |
| Phase 4 — price sanity (base × 1.6) | **PASS** | `node price-check.js` |
| Phase 4 — matrix | identical to baseline | `matrix-phase4.json` |
| Phase 5 — edit-mode round trip (arched) | **PASS** — spec diff 0, viewer3d diff 0 | `node phase5.js arched` |
| Phase 5 — control run (double) | **PASS** — same 5 pre-existing colour additions | `node phase5.js double` |
| Phase 5 — matrix | identical to baseline | `matrix-phase5.json` |
| §2.2 deletions | 0 unexplained | `./audit-deletions.sh` |
| §2.5 tmmx markers | no drop vs origin/main | `./markers.sh` |

### Screenshots and drawings (`/home/user/arched-sash-proof/`)

3D, bundle driven directly — `p1-<shape>-closed.png`, `p1-<shape>-open.png` for
`semi-circle`, `gothic-arch`, `segmental-arch`, `elliptical-arch` (8 files: closed, and
`upperOpening = 9999` clamped to `upperMaxDrop`).

3D through the real UI — `phase1-<shape>.png` (4 files, with dimension guides).

Estimate SVG — `svg-semi.png`, `svg-gothic.png`, `svg-segmental.png`, `svg-elliptical.png`
(plus the `.svg` sources).

Reference for comparison — `ref-arched-casement-gothic.png` (the existing arched casement,
used to prove the scalloped-row artefact was mine and not pre-existing).

---

## Commits

| Hash | Message |
|---|---|
| `cbc8a05` | arched sash: phase 0 — log file + baseline captured |
| `b7b71d6` | arched sash: phase 1 — 3D core (4 shapes, arched box head, opening sash, validation, sync) |
| `d1a3e43` | arched sash: phase 4 — price (base x1.6), spec panel, SVG, specification JSON |
