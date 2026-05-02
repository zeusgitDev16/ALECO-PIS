import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

/**
 * Fill ALECO Consumer Complaint Form PDF with service memo data.
 * Coordinate-based text overlay — works on any PDF including scanned forms.
 *
 * TWO-COPY LAYOUT:
 *   The template has two identical form copies stacked vertically on one page.
 *   Only the TOP copy (upper half of the page) is filled; the bottom copy is
 *   intentionally left blank as the carbon duplicate.
 *   All y-values in this file are in "points from the top of the page" and are
 *   capped well within the top half to avoid bleeding into the bottom copy.
 *
 * COORDINATE CALIBRATION:
 *   On first use, this function logs the actual page dimensions to the browser
 *   console so coordinates can be adjusted to match the real PDF layout.
 *   Look for "[ServiceMemoPdf] Page size" in DevTools > Console.
 *
 * FIELD SOURCES (from mergeMemoForResponse + aleco_service_memos schema):
 *   requested_by       — ticket first+middle+last joined
 *   location           — ticket address
 *   contact_no         — ticket phone_number
 *   action_taken       — work_performed column (aliased)
 *   received_by        — DB column
 *   referred_to        — DB column
 *   control_number     — DB column
 *   category           — DB column or ticket category
 *   service_date       — DB column (same as intake_date alias)
 *   intake_time        — from internal_notes JSON (extended fields)
 *   site_arrived_date  — from internal_notes JSON
 *   site_arrived_time  — from internal_notes JSON
 *   finished_date      — from internal_notes JSON
 *   finished_time      — from internal_notes JSON
 *   referral_received_date / referral_received_time — from internal_notes JSON
 */
// ─── COORDINATE CONSTANTS ─────────────────────────────────────────────────────
// All values are in PDF points (1 pt = 1/72 inch).
// y = distance from the TOP of the page (the helper converts to pdf-lib's bottom-origin).
//
// HOW TO CALIBRATE MANUALLY:
//   1. Print any memo and open browser DevTools > Console.
//   2. Read the "[ServiceMemoPdf] Page size" line — note W x H pt.
//   3. Note which text appears too HIGH or too LOW vs the field line.
//   4. Adjust the constant:
//        text too HIGH (above field line) → INCREASE y
//        text too LOW  (below field line) → DECREASE y
//        text too FAR RIGHT               → DECREASE x
//        text too FAR LEFT                → INCREASE x
//   5. Save and re-print. Repeat until aligned.
//   Each 1 pt = 1/72 inch ≈ 0.35 mm.  A typical row gap is 13–18 pt.

const COORDS = {
  // ── Header (top-right corner) ──────────────────────────────────────────
  DATE:              { x: 480, y: 24  },   // "Date:"   field value
  MEMO_NO:           { x: 480, y: 38  },   // "MEMO No." field value

  // ── Checkboxes — LEFT column — PARENT rows ─────────────────────────────
  CB_NO_LIGHT:       { x: 22.5,  y: 105 },   // □ NO LIGHT/POWER
  CB_POWER_QUALITY:  { x: 41,  y: 172 },   // □ POWER Quality Complaint
  CB_SERVICE_DROP:   { x: 41,  y: 230 },   // □ Complaints/Services on Service Drop

  // ── Checkboxes — LEFT column — SUB-ITEMS (indented, x≈57) ─────────────
  // Sub-items of NO LIGHT/POWER
  CB_SUB_PRIMARY_LINE:   { x: 57, y: 122 },   // □ Primary Line
  CB_SUB_XFORMER_LINE:   { x: 44.2, y: 136 },   // □ Distribution XFormer/Secondary Line
  CB_SUB_RESIDENCE:      { x: 57, y: 150 },   // □ Residence No Power
  // Sub-items of POWER Quality Complaint
  CB_SUB_LOW_VOLTAGE:    { x: 57, y: 187 },   // □ Low voltage
  CB_SUB_FLUCTUATING:    { x: 57, y: 201 },   // □ Fluctuating Voltage
  CB_SUB_LOOSE:          { x: 57, y: 215 },   // □ Loose
  // Sub-items of Complaints/Services on Service Drop
  CB_SUB_REROUTE:        { x: 57, y: 245 },   // □ Reroute Service Drop
  CB_SUB_CHANGE_UPGRADE: { x: 57, y: 258 },   // □ Change Upgrade Service

  // ── Checkboxes — RIGHT column — PARENT rows ────────────────────────────
  CB_POLE:           { x: 310, y: 107 },   // □ Dist. Pole Complaint and Others
  CB_METER:          { x: 310, y: 172 },   // □ Complaints on KWHR Meter
  CB_OTHERS:         { x: 310, y: 236 },   // □ Others
  CB_OTHERS_TEXT:    { x: 342, y: 236 },   // text on the "Others: ____" line

  // ── Checkboxes — RIGHT column — SUB-ITEMS (indented, x≈326) ───────────
  // Sub-items of Dist. Pole Complaint and Others
  CB_SUB_ROTTEN_POLE:    { x: 326, y: 121 },  // □ Rotten Pole
  CB_SUB_LEANING_POLE:   { x: 380, y: 121 },  // □ Leaning Pole  (same row, further right)
  CB_SUB_RELOCATION:     { x: 326, y: 135 },  // □ Relocation of
  CB_SUB_XFORMER_REPL:   { x: 326, y: 149 },  // □ Distribution Xformer Replacement
  // Sub-items of Complaints on KWHR Meter
  CB_SUB_CHECKUP:        { x: 326, y: 187 },  // □ Check-up of KWHM
  CB_SUB_CALIBRATION:    { x: 326, y: 200 },  // □ Meter Calibration/Testing
  CB_SUB_TRANSFER:       { x: 326, y: 213 },  // □ Transfer of KWHM

  // ── Form fields (data lines below each label) ──────────────────────────
  REQUESTED_BY:      { x: 110, y: 283 },   // Requested by
  LOCATION:          { x: 400, y: 283 },   // Location
  ADDRESS:           { x: 65,  y: 297 },   // Address  (uses same value as Location)
  ACTION_TAKEN:      { x: 400, y: 297 },   // ACTION Taken/Remarks
  CONTACT_NO:        { x: 110, y: 318 },   // Contact no.
  REFERRED_TO:       { x: 400, y: 345 },   // Reffered to / Name of Regular Lineman
  RECEIVED_BY:       { x: 90,  y: 372 },   // Received by
  DATE_RECEIVED:     { x: 90,  y: 385 },   // Date/Time Received (intake date+time)
  DATE_ARRIVED:      { x: 305, y: 372 },   // Date Arrived on Site
  TIME_ON_SITE:      { x: 420, y: 372 },   // Time on Site
  DATE_ACCOMPLISHED: { x: 305, y: 385 },   // Date/Time Accomplished
  REF_DATE_RECEIVED: { x: 90,  y: 396 },   // Referral Date/Time Received
};

// ─── CATEGORY → CHECKBOX MAPPING ─────────────────────────────────────────────
// These are the EXACT strings used in IssueCategoryDropdown.jsx.
// If a new category is added to the dropdown, add it to the matching Set below.

const NO_LIGHT_POWER_CATS = new Set([
  'residence no power',
  'distribution xformer / 1 block no light',
  'primary line no power',
]);

const POWER_QUALITY_CATS = new Set([
  'low voltage',
  'fluctuating voltage',
  'loose connection',
  'cutoff live wire',
  'sagging wire',
]);

const SERVICE_DROP_CATS = new Set([
  'reroute service drop',
  'change / upgrade service',
]);

const POLE_CATS = new Set([
  'rotten pole',
  'leaning pole',
  'clearing of distribution line',
  'relocation of pole/line',
  'distribution xformer replacement',
]);

const METER_CATS = new Set([
  'check-up of kwhm',
  'meter calibration / testing',
  'transfer of kwhm',
]);

// ─────────────────────────────────────────────────────────────────────────────

export async function fillServiceMemoPdf(pdfTemplateBytes, memo) {
  const pdfDoc = await PDFDocument.load(pdfTemplateBytes);
  const page = pdfDoc.getPages()[0];
  const { width, height } = page.getSize();

  // Diagnostic — read these in DevTools > Console to calibrate COORDS above
  console.log(`[ServiceMemoPdf] Page size: ${width.toFixed(1)} x ${height.toFixed(1)} pt`);
  console.log(`[ServiceMemoPdf] Top-copy boundary (approx): y < ${(height / 2).toFixed(1)} pt from top`);
  console.log(`[ServiceMemoPdf] Memo fields:`, {
    control_number: memo.control_number,
    service_date: memo.service_date,
    intake_date: memo.intake_date,
    intake_time: memo.intake_time,
    requested_by: memo.requested_by,
    location: memo.location,
    contact_no: memo.contact_no,
    category: memo.category,
    received_by: memo.received_by,
    referred_to: memo.referred_to,
    action_taken: memo.action_taken,
    site_arrived_date: memo.site_arrived_date,
    site_arrived_time: memo.site_arrived_time,
    finished_date: memo.finished_date,
    finished_time: memo.finished_time,
    referral_received_date: memo.referral_received_date,
    referral_received_time: memo.referral_received_time,
  });

  const font     = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  // ─── DRAW HELPERS ──────────────────────────────────────────────────────────

  /**
   * Draw text at (x, y) where y is measured from the TOP of the page.
   * pdf-lib's origin is bottom-left, so we convert: pdfY = pageHeight - y.
   */
  const drawText = (text, x, y, options = {}) => {
    const { size = 9, bold = false, color = rgb(0, 0, 0), maxWidth = null } = options;
    const selectedFont = bold ? fontBold : font;
    let displayText = String(text || '').trim();
    if (!displayText) return;

    if (maxWidth) {
      while (
        displayText.length > 0 &&
        selectedFont.widthOfTextAtSize(displayText, size) > maxWidth
      ) {
        displayText = displayText.slice(0, -1);
      }
    }

    page.drawText(displayText, {
      x,
      y: height - y,
      size,
      font: selectedFont,
      color,
    });
  };

  /**
   * Draw a checkbox mark.
   * IMPORTANT: '✓' (U+2713) is NOT in WinAnsiEncoding used by StandardFonts
   * and causes pdf-lib to throw "WinAnsiEncoding cannot encode '✓'".
   * 'X' is a safe Latin-1 character that is universally supported.
   */
  const drawCheckmark = (x, y, checked) => {
    if (checked) drawText('X', x, y, { size: 9, bold: true });
  };

  // ─── DATE / TIME FORMATTERS ─────────────────────────────────────────────────
  // service_date / site_arrived_date / finished_date / referral_received_date
  // are plain "YYYY-MM-DD" strings — NO timezone conversion needed.
  // intake_time / site_arrived_time / etc. are plain "HH:MM" strings.

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const s = String(dateStr).slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
    const [y, m, d] = s.split('-');
    return `${m}/${d}/${y}`;
  };

  const formatTime = (timeStr) => {
    if (!timeStr) return '';
    const s = String(timeStr).slice(0, 5);
    const [hh, mm] = s.split(':').map(Number);
    if (isNaN(hh) || isNaN(mm)) return s;
    const period = hh >= 12 ? 'PM' : 'AM';
    const h12 = hh % 12 === 0 ? 12 : hh % 12;
    return `${h12}:${String(mm).padStart(2, '0')} ${period}`;
  };

  const formatDateTimeField = (dateStr, timeStr) => {
    const d = formatDate(dateStr);
    const t = formatTime(timeStr);
    if (d && t) return `${d} ${t}`;
    return d || t || '';
  };

  // ─── CATEGORY DETECTION (exact match) ──────────────────────────────────────
  const catLower = (memo.category || '').toLowerCase().trim();
  const isNoLightPower   = NO_LIGHT_POWER_CATS.has(catLower);
  const isPowerQuality   = POWER_QUALITY_CATS.has(catLower);
  const isServiceDrop    = SERVICE_DROP_CATS.has(catLower);
  const isPoleComplaint  = POLE_CATS.has(catLower);
  const isMeterComplaint = METER_CATS.has(catLower);
  const isOthers         = !isNoLightPower && !isPowerQuality && !isServiceDrop &&
                           !isPoleComplaint && !isMeterComplaint;

  const intakeDate = memo.service_date ?? memo.intake_date ?? null;

  // ─── HEADER ─────────────────────────────────────────────────────────────────
  drawText(formatDate(intakeDate),    COORDS.DATE.x,    COORDS.DATE.y,    { size: 9 });
  drawText(memo.control_number || '', COORDS.MEMO_NO.x, COORDS.MEMO_NO.y, { size: 9 });

  // ─── CHECKBOXES — parent group + matching sub-item ────────────────────────
  // Each category marks its PARENT checkbox and its specific sub-item checkbox.
  // catLower is already computed above.

  // ── NO LIGHT/POWER parent + sub-items ──────────────────────────────────
  drawCheckmark(COORDS.CB_NO_LIGHT.x,        COORDS.CB_NO_LIGHT.y,        isNoLightPower);
  drawCheckmark(COORDS.CB_SUB_PRIMARY_LINE.x, COORDS.CB_SUB_PRIMARY_LINE.y,
    catLower === 'primary line no power');
  drawCheckmark(COORDS.CB_SUB_XFORMER_LINE.x, COORDS.CB_SUB_XFORMER_LINE.y,
    catLower === 'distribution xformer / 1 block no light');
  drawCheckmark(COORDS.CB_SUB_RESIDENCE.x,    COORDS.CB_SUB_RESIDENCE.y,
    catLower === 'residence no power');

  // ── POWER Quality Complaint parent + sub-items ─────────────────────────
  drawCheckmark(COORDS.CB_POWER_QUALITY.x,   COORDS.CB_POWER_QUALITY.y,   isPowerQuality);
  drawCheckmark(COORDS.CB_SUB_LOW_VOLTAGE.x,  COORDS.CB_SUB_LOW_VOLTAGE.y,
    catLower === 'low voltage');
  drawCheckmark(COORDS.CB_SUB_FLUCTUATING.x,  COORDS.CB_SUB_FLUCTUATING.y,
    catLower === 'fluctuating voltage');
  drawCheckmark(COORDS.CB_SUB_LOOSE.x,         COORDS.CB_SUB_LOOSE.y,
    catLower === 'loose connection');
  // Note: 'cutoff live wire' and 'sagging wire' have no matching sub-item on the form

  // ── Complaints/Services on Service Drop parent + sub-items ─────────────
  drawCheckmark(COORDS.CB_SERVICE_DROP.x,    COORDS.CB_SERVICE_DROP.y,    isServiceDrop);
  drawCheckmark(COORDS.CB_SUB_REROUTE.x,      COORDS.CB_SUB_REROUTE.y,
    catLower === 'reroute service drop');
  drawCheckmark(COORDS.CB_SUB_CHANGE_UPGRADE.x, COORDS.CB_SUB_CHANGE_UPGRADE.y,
    catLower === 'change / upgrade service');

  // ── Dist. Pole Complaint and Others parent + sub-items ─────────────────
  drawCheckmark(COORDS.CB_POLE.x,            COORDS.CB_POLE.y,            isPoleComplaint);
  drawCheckmark(COORDS.CB_SUB_ROTTEN_POLE.x,  COORDS.CB_SUB_ROTTEN_POLE.y,
    catLower === 'rotten pole');
  drawCheckmark(COORDS.CB_SUB_LEANING_POLE.x, COORDS.CB_SUB_LEANING_POLE.y,
    catLower === 'leaning pole');
  drawCheckmark(COORDS.CB_SUB_RELOCATION.x,   COORDS.CB_SUB_RELOCATION.y,
    catLower === 'relocation of pole/line');
  drawCheckmark(COORDS.CB_SUB_XFORMER_REPL.x, COORDS.CB_SUB_XFORMER_REPL.y,
    catLower === 'distribution xformer replacement');
  // Note: 'clearing of distribution line' has no matching sub-item on the form

  // ── Complaints on KWHR Meter parent + sub-items ────────────────────────
  drawCheckmark(COORDS.CB_METER.x,           COORDS.CB_METER.y,           isMeterComplaint);
  drawCheckmark(COORDS.CB_SUB_CHECKUP.x,      COORDS.CB_SUB_CHECKUP.y,
    catLower === 'check-up of kwhm');
  drawCheckmark(COORDS.CB_SUB_CALIBRATION.x,  COORDS.CB_SUB_CALIBRATION.y,
    catLower === 'meter calibration / testing');
  drawCheckmark(COORDS.CB_SUB_TRANSFER.x,     COORDS.CB_SUB_TRANSFER.y,
    catLower === 'transfer of kwhm');

  // ── Others ─────────────────────────────────────────────────────────────
  drawCheckmark(COORDS.CB_OTHERS.x, COORDS.CB_OTHERS.y, isOthers);
  if (isOthers && memo.category) {
    drawText(memo.category, COORDS.CB_OTHERS_TEXT.x, COORDS.CB_OTHERS_TEXT.y,
      { size: 8, maxWidth: 210 });
  }

  // ─── FORM FIELDS ────────────────────────────────────────────────────────────
  drawText(memo.requested_by || '', COORDS.REQUESTED_BY.x, COORDS.REQUESTED_BY.y,
    { size: 9, maxWidth: 185 });
  drawText(memo.location     || '', COORDS.LOCATION.x,     COORDS.LOCATION.y,
    { size: 9, maxWidth: 170 });
  drawText(memo.location     || '', COORDS.ADDRESS.x,      COORDS.ADDRESS.y,
    { size: 9, maxWidth: 230 });
  drawText(memo.action_taken || '', COORDS.ACTION_TAKEN.x, COORDS.ACTION_TAKEN.y,
    { size: 9, maxWidth: 170 });
  drawText(memo.contact_no   || '', COORDS.CONTACT_NO.x,   COORDS.CONTACT_NO.y,
    { size: 9, maxWidth: 185 });
  drawText(memo.referred_to  || '', COORDS.REFERRED_TO.x,  COORDS.REFERRED_TO.y,
    { size: 9, maxWidth: 170 });
  drawText(memo.received_by  || '', COORDS.RECEIVED_BY.x,  COORDS.RECEIVED_BY.y,
    { size: 9, maxWidth: 145 });

  drawText(
    formatDateTimeField(intakeDate, memo.intake_time),
    COORDS.DATE_RECEIVED.x, COORDS.DATE_RECEIVED.y, { size: 8, maxWidth: 130 }
  );
  drawText(
    formatDate(memo.site_arrived_date),
    COORDS.DATE_ARRIVED.x, COORDS.DATE_ARRIVED.y, { size: 8, maxWidth: 90 }
  );
  drawText(
    formatTime(memo.site_arrived_time),
    COORDS.TIME_ON_SITE.x, COORDS.TIME_ON_SITE.y, { size: 8, maxWidth: 75 }
  );
  drawText(
    formatDateTimeField(memo.finished_date, memo.finished_time),
    COORDS.DATE_ACCOMPLISHED.x, COORDS.DATE_ACCOMPLISHED.y, { size: 8, maxWidth: 175 }
  );
  drawText(
    formatDateTimeField(memo.referral_received_date, memo.referral_received_time),
    COORDS.REF_DATE_RECEIVED.x, COORDS.REF_DATE_RECEIVED.y, { size: 8, maxWidth: 200 }
  );

  const pdfBytes = await pdfDoc.save();
  return pdfBytes;
}

/**
 * Download the filled PDF to the user's computer
 * @param {Uint8Array} pdfBytes - The PDF bytes
 * @param {string} filename - The download filename
 */
export function downloadPdf(pdfBytes, filename = 'ALECO_Service_Memo.pdf') {
  const blob = new Blob([pdfBytes], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  // Clean up the URL object
  setTimeout(() => URL.revokeObjectURL(url), 100);
}

/**
 * Print the filled PDF in-place by rendering it inside a hidden iframe and
 * triggering the browser's native print dialog directly on that iframe.
 *
 * Behaviour:
 *   - No new browser tab is opened.
 *   - The iframe is full-viewport-sized (so the PDF plugin initialises) but
 *     invisible (opacity:0, pointer-events:none, behind everything).
 *   - After the PDF finishes loading, `iframe.contentWindow.print()` opens the
 *     browser's print dialog showing the PDF content (NOT the parent app UI).
 *
 * @param {Uint8Array} pdfBytes
 */
export function printPdf(pdfBytes) {
  const blob = new Blob([pdfBytes], { type: 'application/pdf' });
  const url  = URL.createObjectURL(blob);

  // Remove any prior print iframe (in case of rapid repeated clicks)
  const existing = document.getElementById('aleco-pdf-print-iframe');
  if (existing && existing.parentNode) existing.parentNode.removeChild(existing);

  const iframe = document.createElement('iframe');
  iframe.id = 'aleco-pdf-print-iframe';
  // Position the iframe completely OFF-SCREEN with a real size so the PDF
  // plugin can initialise. Avoid full-viewport overlays — even invisible ones
  // disturb modal layout / focus when the print dialog closes.
  iframe.style.cssText = [
    'position:fixed',
    'top:-10000px',
    'left:-10000px',
    'width:800px',
    'height:1000px',
    'border:0',
  ].join(';');
  iframe.src = url;
  document.body.appendChild(iframe);

  let cleaned = false;
  const cleanup = () => {
    if (cleaned) return;
    cleaned = true;
    URL.revokeObjectURL(url);
    if (iframe.parentNode) iframe.parentNode.removeChild(iframe);
  };

  iframe.addEventListener('load', () => {
    // Allow the PDF plugin a moment to finish rendering before printing
    setTimeout(() => {
      try {
        const cw = iframe.contentWindow;
        // Clean up as soon as the print dialog is dismissed (printed or cancelled)
        cw.addEventListener('afterprint', cleanup);
        cw.focus();
        cw.print();
      } catch (err) {
        console.error('[printPdf] iframe print failed:', err);
        cleanup();
      }
    }, 600);
  });

  // Safety net: cleanup after 2 minutes if afterprint never fires
  setTimeout(cleanup, 120_000);
}
