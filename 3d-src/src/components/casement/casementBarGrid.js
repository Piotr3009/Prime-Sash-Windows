/**
 * casementBarGrid.js — ONE grid of horizontal glazing-bar lines for a casement window.
 *
 * Copied 1:1 from Production Core (Sash-Planner-Web/src/engine/casementBarGrid.js,
 * rule set by Piotr 21.09.2026: "jedna siatka linii na całe okno") so PSW 3D and
 * PC draw the same bars. Keep the two files in step — do not edit only one side.
 *
 * Every main light's horizontal bars sit on the lines of the tallest main light; a
 * shorter main light shows the lines that cross its own glass and drops a line whose
 * sliver of glass against an edge would be lower than 1/3 of a normal pane.
 * Fanlights (fan / fan2) keep their own counts.
 */

/** Wood glazing bar face (mm) — the 2D sheets' constant. */
export const BAR_WIDTH = 22;

/** Piotr 21.09.2026: a sliver lower than 1/3 of a normal pane drops the bar. */
export const MIN_SLIVER_RATIO = 1 / 3;

/**
 * The rule. `lights` = one entry per pane, in ONE linear y axis (up or down,
 * the rule is symmetric): { role, lo, hi, lines } where lo < hi bound the
 * pane's glass and `lines` are the centre lines of the pane's OWN horizontal
 * bars (the caller's placement law, as if the pane stood alone).
 * Returns, per pane, { lines, aligned, dropped }:
 *   · fan / fan2 → own lines, untouched;
 *   · the tallest main light (the reference) and every main light with the
 *     same glass extent → own lines, untouched (byte-identical to before);
 *   · any other main light → the reference lines that cross its glass, minus
 *     the ones whose sliver against an edge is lower than minSliverRatio of a
 *     normal pane.
 */
export function alignMainBarLines(lights, { barW = BAR_WIDTH, minSliverRatio = MIN_SLIVER_RATIO } = {}) {
  const EPS = 1e-9;
  const roleOf = (l) => l.role || 'main';
  const ref = lights.reduce((best, l) => {
    if (roleOf(l) !== 'main') return best;
    return !best || (l.hi - l.lo) > (best.hi - best.lo) + EPS ? l : best;
  }, null);
  return lights.map((l) => {
    const own = { lines: (l.lines || []).slice(), aligned: false, dropped: 0 };
    if (!ref || roleOf(l) !== 'main') return own;
    if (Math.abs(l.lo - ref.lo) < EPS && Math.abs(l.hi - ref.hi) < EPS) return own;
    const refLines = (ref.lines || []).slice().sort((a, b) => a - b);
    if (!refLines.length) return own;
    // a normal pane = the glass between two reference bars (one bar: edge to bar)
    const pane = refLines.length > 1 ? (refLines[1] - refLines[0]) - barW : (refLines[0] - barW / 2) - ref.lo;
    const minSliver = pane * minSliverRatio;
    const lines = refLines.filter((c) => (c - barW / 2) - l.lo >= minSliver - EPS && l.hi - (c + barW / 2) >= minSliver - EPS);
    return { lines, aligned: true, dropped: refLines.length - lines.length };
  });
}
