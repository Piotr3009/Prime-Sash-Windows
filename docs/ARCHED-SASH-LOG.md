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

_(must contain only the three §2.2-permitted removals)_

---

## Cache busts

| File | Old | New |
|---|---|---|
| _(pending)_ | | |

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

---

## Commits

_(appended as they are made)_
