// ============================================
// PRIME SASH WINDOWS — Draggable modals
// ============================================
// makeDraggable(panel, handle) lets a modal be grabbed by its header and moved
// out of the way — useful when something behind the modal needs checking.
//
// Uses a CSS transform rather than left/top so it works with the flex-centred
// overlays without recalculating layout. Pointer events cover mouse, pen and
// touch in one code path.
//
// Clicks on buttons, inputs and links inside the handle still work normally:
// dragging only starts on the bare header area.

(function () {
  'use strict';

  const NO_DRAG = 'button, input, select, textarea, a, label, [contenteditable]';

  window.makeDraggable = function (panel, handle) {
    if (!panel || !handle || panel.__draggable) return;
    panel.__draggable = true;

    let dx = 0, dy = 0;          // current offset, kept between drags
    let startX = 0, startY = 0;  // pointer position when the drag began
    let baseX = 0, baseY = 0;    // offset when the drag began
    let dragging = false;

    handle.style.cursor = 'move';
    handle.style.touchAction = 'none';
    handle.style.userSelect = 'none';

    function apply() {
      panel.style.transform = 'translate(' + Math.round(dx) + 'px,' + Math.round(dy) + 'px)';
    }

    function onDown(e) {
      if (e.button != null && e.button !== 0) return;         // left button only
      if (e.target.closest && e.target.closest(NO_DRAG)) return;
      dragging = true;
      startX = e.clientX; startY = e.clientY;
      baseX = dx; baseY = dy;
      handle.setPointerCapture && handle.setPointerCapture(e.pointerId);
      e.preventDefault();
    }

    function onMove(e) {
      if (!dragging) return;
      const r = panel.getBoundingClientRect();
      let nx = baseX + (e.clientX - startX);
      let ny = baseY + (e.clientY - startY);

      // Keep the header reachable: never let the panel leave the viewport far
      // enough that it can't be grabbed again.
      const minX = -(r.left - dx) - r.width + 120;
      const maxX = window.innerWidth - (r.left - dx) - 120;
      const minY = -(r.top - dy);
      const maxY = window.innerHeight - (r.top - dy) - 60;

      dx = Math.min(Math.max(nx, minX), maxX);
      dy = Math.min(Math.max(ny, minY), maxY);
      apply();
    }

    function onUp(e) {
      if (!dragging) return;
      dragging = false;
      handle.releasePointerCapture && handle.releasePointerCapture(e.pointerId);
    }

    handle.addEventListener('pointerdown', onDown);
    handle.addEventListener('pointermove', onMove);
    handle.addEventListener('pointerup', onUp);
    handle.addEventListener('pointercancel', onUp);
  };
})();
