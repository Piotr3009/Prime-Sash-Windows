// ============================================
// PRIME SASH WINDOWS — Passport page (public)
// ============================================
// Runs on /p/<token> and /q/<plate-code>. Two jobs:
//   1. Show the frozen technical drawing in an overlay
//   2. Build the passport PDF on demand
//
// The PDF libraries (~500 KB) load only when the button is pressed. Most scans
// happen on a phone, often on poor site signal, and most people never press it
// — the same lazy pattern used for the 3D viewer.

(function () {
  'use strict';

  var PDF_JS = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/3.0.3/jspdf.umd.min.js';
  var PDF_TABLE = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/5.0.2/jspdf.plugin.autotable.min.js';

  var NAVY = [10, 22, 40];
  var GREY = [95, 94, 90];

  // ---------- technical drawing ----------

  var drawBtn = document.getElementById('pp-drawing-btn');
  var drawOverlay = document.getElementById('pp-draw-overlay');
  if (drawBtn && drawOverlay) {
    drawBtn.addEventListener('click', function () { drawOverlay.classList.add('open'); });
    var closeBtn = document.getElementById('pp-draw-close');
    if (closeBtn) closeBtn.addEventListener('click', function () { drawOverlay.classList.remove('open'); });
    drawOverlay.addEventListener('click', function (e) {
      if (e.target === drawOverlay) drawOverlay.classList.remove('open');
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') drawOverlay.classList.remove('open');
    });
  }

  // ---------- PDF ----------

  function loadScript(src) {
    return new Promise(function (resolve, reject) {
      var s = document.createElement('script');
      s.src = src;
      s.onload = resolve;
      s.onerror = function () { reject(new Error('Failed to load ' + src)); };
      document.head.appendChild(s);
    });
  }

  function imageSize(dataUrl) {
    return new Promise(function (resolve) {
      var img = new Image();
      img.onload = function () { resolve({ w: img.naturalWidth, h: img.naturalHeight }); };
      img.onerror = function () { resolve(null); };
      img.src = dataUrl;
    });
  }

  var pdfBtn = document.getElementById('pp-pdf-btn');
  if (!pdfBtn) return;

  pdfBtn.addEventListener('click', async function () {
    var d = window.__PSW_PASSPORT__;
    if (!d) return;
    var label = pdfBtn.textContent;
    pdfBtn.disabled = true;
    pdfBtn.textContent = 'Preparing\u2026';

    try {
      if (!window.jspdf) await loadScript(PDF_JS);
      if (!(window.jspdf && window.jspdf.jsPDF.API && window.jspdf.jsPDF.API.autoTable)) await loadScript(PDF_TABLE);

      var doc = new window.jspdf.jsPDF({ unit: 'mm', format: 'a4' });
      var W = doc.internal.pageSize.getWidth();
      var M = 18;
      var y = 0;

      // Header band
      doc.setFillColor(NAVY[0], NAVY[1], NAVY[2]);
      doc.rect(0, 0, W, 26, 'F');
      doc.setTextColor(250, 250, 248);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(15);
      doc.text('Prime Sash Windows', W / 2, 12, { align: 'center' });
      doc.setFontSize(8);
      doc.setTextColor(158, 158, 144);
      doc.text('W I N D O W   P A S S P O R T', W / 2, 19, { align: 'center' });

      y = 40;
      doc.setTextColor(NAVY[0], NAVY[1], NAVY[2]);
      doc.setFontSize(19);
      doc.text(d.title || 'Window passport', W / 2, y, { align: 'center' });

      if (d.location) {
        y += 7;
        doc.setFontSize(10);
        doc.setTextColor(GREY[0], GREY[1], GREY[2]);
        doc.text(d.location, W / 2, y, { align: 'center' });
      }

      y += 8;
      doc.setFontSize(11);
      doc.setTextColor(NAVY[0], NAVY[1], NAVY[2]);
      doc.text(d.serial || '', W / 2, y, { align: 'center' });

      // Screenshot, scaled to keep its proportions
      if (d.image) {
        var size = await imageSize(d.image);
        if (size && size.w && size.h) {
          var maxW = 62, maxH = 78;
          var ratio = Math.min(maxW / size.w, maxH / size.h);
          var iw = size.w * ratio, ih = size.h * ratio;
          y += 6;
          try { doc.addImage(d.image, 'PNG', (W - iw) / 2, y, iw, ih); y += ih; } catch (e) { /* skip */ }
        }
      }

      var body = (d.rows || []).slice();
      if (d.uValue) body.push(['U-value', d.uValue]);
      if (d.manufactured) body.push(['Manufactured', d.manufactured]);

      doc.autoTable({
        startY: y + 10,
        margin: { left: M, right: M },
        head: [['Specification', '']],
        body: body,
        theme: 'plain',
        styles: { fontSize: 10, cellPadding: 2.2, textColor: [26, 31, 46] },
        headStyles: { fontSize: 8, textColor: GREY, fontStyle: 'normal', cellPadding: { bottom: 3 } },
        columnStyles: { 0: { textColor: GREY, cellWidth: 60 }, 1: { halign: 'right' } },
        didDrawCell: function (data) {
          if (data.section === 'body') {
            doc.setDrawColor(235, 233, 227);
            doc.line(data.cell.x, data.cell.y + data.cell.height,
                     data.cell.x + data.cell.width, data.cell.y + data.cell.height);
          }
        }
      });

      var afterY = doc.lastAutoTable.finalY + 12;

      if (d.warrantyNo) {
        doc.setDrawColor(NAVY[0], NAVY[1], NAVY[2]);
        doc.rect(M, afterY, W - M * 2, 20);
        doc.setFontSize(8);
        doc.setTextColor(GREY[0], GREY[1], GREY[2]);
        doc.text('WARRANTY', M + 5, afterY + 7);
        doc.setFontSize(12);
        doc.setTextColor(NAVY[0], NAVY[1], NAVY[2]);
        doc.text(d.warrantyNo, M + 5, afterY + 14);
        if (d.warrantyMeta) {
          doc.setFontSize(9);
          doc.setTextColor(GREY[0], GREY[1], GREY[2]);
          doc.text(d.warrantyMeta + ' \u00b7 transfers with the property', W - M - 5, afterY + 14, { align: 'right' });
        }
        afterY += 30;
      }

      var footY = doc.internal.pageSize.getHeight() - 16;
      doc.setFontSize(9);
      doc.setTextColor(GREY[0], GREY[1], GREY[2]);
      doc.text('primesashwindows.co.uk', W / 2, footY, { align: 'center' });

      var name = (d.serial || 'window-passport').replace(/[^A-Za-z0-9._-]+/g, '-');
      doc.save(name + '.pdf');
    } catch (err) {
      console.error('Passport PDF failed:', err);
      alert('Sorry — the PDF could not be created. Please try again, or contact us at info@primesashwindows.co.uk.');
    } finally {
      pdfBtn.disabled = false;
      pdfBtn.textContent = label;
    }
  });
})();
