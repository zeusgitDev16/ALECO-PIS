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
  CB_POWER_QUALITY:  { x: 22.5,  y: 165},   // □ POWER Quality Complaint
  CB_SERVICE_DROP:   { x: 22.5,  y: 217 },   // □ Complaints/Services on Service Drop

  // ── Checkboxes — LEFT column — SUB-ITEMS (indented, x≈57) ─────────────
  // Sub-items of NO LIGHT/POWER
  CB_SUB_PRIMARY_LINE:   { x: 44.2, y: 122 },   // □ Primary Line
  CB_SUB_XFORMER_LINE:   { x: 44.2, y: 136 },   // □ Distribution XFormer/Secondary Line
  CB_SUB_RESIDENCE:      { x: 44.2, y: 150 },   // □ Residence No Power
  // Sub-items of POWER Quality Complaint
  CB_SUB_LOW_VOLTAGE:    { x: 44.2, y: 179 },   // □ Low voltage
  CB_SUB_FLUCTUATING:    { x: 44.2, y: 191.8},   // □ Fluctuating Voltage
  CB_SUB_LOOSE:          { x: 44.2, y: 204.8 },   // □ Loose
  // Sub-items of Complaints/Services on Service Drop
  CB_SUB_REROUTE:        { x: 44.2, y: 231.8 },   // □ Reroute Service Drop
  CB_SUB_CHANGE_UPGRADE: { x: 44.2, y: 246 },   // □ Change Upgrade Service


  // ── Checkboxes — RIGHT column — PARENT rows ────────────────────────────
  CB_POLE:           { x: 239.5, y: 89.5 },   // □ Dist. Pole Complaint and Others
  CB_METER:          { x: 239.5, y: 147.5 },   // □ Complaints on KWHR Meter
  CB_OTHERS:         { x: 262, y: 236.8 },   // □ Others
  CB_OTHERS_TEXT:    { x: 307, y: 236 },   // text on the "Others: ____" line

  // ── Checkboxes — RIGHT column — SUB-ITEMS (indented, x≈326) ───────────
  // Sub-items of Dist. Pole Complaint and Others
  CB_SUB_ROTTEN_POLE:    { x: 261.8, y: 103},  // □ Rotten Pole
  CB_SUB_LEANING_POLE:   { x: 341.2, y: 103 },  // □ Leaning Pole  (same row, further right)
  CB_SUB_RELOCATION:     { x: 261.8, y: 119 },  // □ Relocation of
  CB_SUB_XFORMER_REPL:   { x: 261.8, y: 132.5 },  // □ Distribution Xformer Replacement
  // Sub-items of Complaints on KWHR Meter
  CB_SUB_CHECKUP:        { x: 261.8, y: 164.4 },  // □ Check-up of KWHM
  CB_SUB_CALIBRATION:    { x: 261.8, y: 178.8},  // □ Meter Calibration/Testing
  CB_SUB_TRANSFER:       { x: 261.8, y: 192.5 },  // □ Transfer of KWHM

  // ── Form fields (data lines below each label) ──────────────────────────
  REQUESTED_BY:      { x: 85, y: 283 },   // Requested by
  LOCATION:          { x: 354, y: 283 },   // Location
  ADDRESS:           { x: 85,  y: 295.6 },   // Address  (uses same value as Location)
  ACTION_TAKEN:      { x: 427.8, y: 302.2 },   // ACTION Taken/Remarks (line 1 — starts after label)
  // Lines 2 & 3 of ACTION Taken/Remarks: no label is in the way, so they can
  // start much further LEFT and use the full underline width. Calibrate these
  // independently from the line-1 x.
  ACTION_TAKEN_CONT_X:     313.1, // x for lines 2 and 3 (left edge of long underline)
  ACTION_TAKEN_CONT_WIDTH: 288,   // line width for lines 2 and 3
  ACTION_TAKEN_L2_Y:       318,   // y for line 2 of ACTION Taken/Remarks (calibrate)
  ACTION_TAKEN_L3_Y:       334,   // y for line 3 of ACTION Taken/Remarks (calibrate)
  CONTACT_NO:        { x: 85, y: 336.8 },   // Contact no.
  REFERRED_TO:       { x: 383, y: 359.8 },   // Reffered to / Name of Regular Lineman
  RECEIVED_BY:       { x: 99.2,  y: 420},   // Received by
  DATE_RECEIVED:     { x: 116.8,  y: 448 },   // Date/Time Received — ticket reported datetime
  DATE_RECEIVED_MEMO: { x: 116.8,  y: 461 },   // Date/Time Received — memo created datetime (calibrate y)
  DATE_ARRIVED:      { x: 397, y: 417 },   // Date Arrived on Site
  TIME_ON_SITE:      { x: 540, y: 417.9 },   // Time on Site
  DATE_ACCOMPLISHED: { x: 445, y: 443.5},   // Date/Time Accomplished
  REF_DATE_RECEIVED: { x: 425,  y: 393 },   // Referral Date/Time Received
};

// ─── CATEGORY → CHECKBOX MAPPING ─────────────────────────────────────────────
// These are the EXACT strings used in IssueCategoryDropdown.jsx.
// If a new category is added to the dropdown, add it to the matching Set below.

const NO_LIGHT_POWER_CATS = new Set([
  'residence no power',
  'distribution xformer/secondary line',
  'primary line no power',
]);

const POWER_QUALITY_CATS = new Set([
  'low voltage',
  'fluctuating voltage',
  'loose connection',
]);

const SERVICE_DROP_CATS = new Set([
  'reroute service drop',
  'change / upgrade service',
]);

const POLE_CATS = new Set([
  'rotten pole',
  'leaning pole',
  'relocation of pole/line',
  'distribution xformer replacement',
  // Note: 'clearing of distribution line' is routed to Others — absent from template.
]);

const METER_CATS = new Set([
  'check-up of kwhm',
  'meter calibration / testing',
  'transfer of kwhm',
]);

// Categories that have no matching checkbox/sub-item on the physical template.
// These are printed under the "Others" checkbox with the category name written
// on the Others text line instead of ticking a non-existent box.
const OTHERS_ROUTED_CATS = new Set([
  'cutoff live wire',
  'sagging wire',
  'clearing of distribution line',
  'temporary disconnection',
  'temporary lighting',
  'other / unlisted concern',
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
   * Draw text that wraps across multiple lines at word boundaries.
   * Stops after `maxLines` — the last line is truncated with "…" if overflow remains.
   *
   * @param {string} text          raw text to draw
   * @param {number} x             left x (pt)
   * @param {number} y             top-measured y of the FIRST line (pt)
   * @param {object} options
   * @param {number} options.size        font size (default 9)
   * @param {number} options.maxWidth    line width in pt (required)
   * @param {number} options.maxLines    how many lines are allowed (default 3)
   * @param {number} options.lineHeight  vertical gap between line baselines in pt (default 13)
   * @param {boolean} options.bold
   */
  const drawWrappedText = (text, x, y, options = {}) => {
    const {
      size = 9,
      maxWidth,
      maxLines = 3,
      lineHeight = 13,
      bold = false,
      color = rgb(0, 0, 0),
      // Lines 2+ may start further left (no label in the way) and use a wider
      // line width. If omitted, continuation lines use the same x / maxWidth
      // as the first line.
      continuationX = null,
      continuationMaxWidth = null,
    } = options;
    const selectedFont = bold ? fontBold : font;
    const raw = String(text || '').trim();
    if (!raw || !maxWidth) return;

    // Per-line y override: if options.lineYs[i] is a number, use it directly
    // (top-measured y for that line). Otherwise fall back to y + i*lineHeight.
    const { lineYs = null } = options;
    const lineX     = (i) => (i === 0 ? x        : (continuationX        ?? x));
    const lineWidth = (i) => (i === 0 ? maxWidth : (continuationMaxWidth ?? maxWidth));
    const lineY     = (i) => {
      if (lineYs && typeof lineYs[i] === 'number') return lineYs[i];
      return y + i * lineHeight;
    };

    // Pack words greedily, but the available width depends on which line we're
    // currently filling (line 0 may be narrower because of a label to its left).
    const words = raw.split(/\s+/);
    const lines = [];
    let current = '';

    for (let i = 0; i < words.length; i += 1) {
      const word = words[i];
      const widthForCurrent = lineWidth(lines.length);
      const candidate = current ? `${current} ${word}` : word;
      if (selectedFont.widthOfTextAtSize(candidate, size) <= widthForCurrent) {
        current = candidate;
      } else {
        if (current) lines.push(current);
        if (lines.length >= maxLines) { current = ''; break; }
        // Word alone wider than the next line's width — hard-truncate it
        const widthForNext = lineWidth(lines.length);
        let w = word;
        while (w.length > 1 && selectedFont.widthOfTextAtSize(w, size) > widthForNext) {
          w = w.slice(0, -1);
        }
        current = w;
      }
    }
    if (current && lines.length < maxLines) lines.push(current);

    // If text remains beyond the line cap, suffix "…" on the last line
    const totalPacked = lines.join(' ').length;
    if (totalPacked < raw.length && lines.length > 0) {
      const lastIdx = lines.length - 1;
      const widthForLast = lineWidth(lastIdx);
      let last = lines[lastIdx];
      const ellipsis = '…';
      while (
        last.length > 0 &&
        selectedFont.widthOfTextAtSize(last + ellipsis, size) > widthForLast
      ) {
        last = last.slice(0, -1);
      }
      lines[lastIdx] = last + ellipsis;
    }

    lines.forEach((line, i) => {
      page.drawText(line, {
        x: lineX(i),
        y: height - lineY(i),
        size,
        font: selectedFont,
        color,
      });
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
  // ticket_created_at / memo.created_at are full MySQL datetime strings (UTC).

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const s = String(dateStr).slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
    const [y, m, d] = s.split('-');
    const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
    const monthName = MONTHS[parseInt(m, 10) - 1] || m;
    return `${monthName} ${d}, ${y}`;
  };

  // Format a MySQL datetime string into "May 04, 2026 8:23 AM".
  // The pool uses dateStrings: true + timezone: '+08:00', so the value arrives as
  // a plain "YYYY-MM-DD HH:MM:SS" string already in PHT — parse it directly to
  // avoid any UTC shift that new Date() would introduce.
  const formatFullDateTime = (datetimeStr) => {
    if (!datetimeStr) return '';
    const s = String(datetimeStr);
    const match = s.match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/);
    if (!match) return s.slice(0, 19);
    const [, y, m, d, hh, mm] = match;
    const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
    const mon = MONTHS[parseInt(m, 10) - 1];
    const hour = parseInt(hh, 10);
    const period = hour >= 12 ? 'PM' : 'AM';
    const h12 = hour % 12 === 0 ? 12 : hour % 12;
    return `${mon} ${d}, ${y} ${h12}:${mm} ${period}`;
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
  const isOthersRouted   = OTHERS_ROUTED_CATS.has(catLower);
  const isOthers         = isOthersRouted || (
                           !isNoLightPower && !isPowerQuality && !isServiceDrop &&
                           !isPoleComplaint && !isMeterComplaint);

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
    catLower === 'distribution xformer/secondary line');
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
  // Note: 'cutoff live wire' and 'sagging wire' are routed to Others (no template box)

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
  // Note: 'clearing of distribution line' is routed to Others (no template box)

  // ── Complaints on KWHR Meter parent + sub-items ────────────────────────
  drawCheckmark(COORDS.CB_METER.x,           COORDS.CB_METER.y,           isMeterComplaint);
  drawCheckmark(COORDS.CB_SUB_CHECKUP.x,      COORDS.CB_SUB_CHECKUP.y,
    catLower === 'check-up of kwhm');
  drawCheckmark(COORDS.CB_SUB_CALIBRATION.x,  COORDS.CB_SUB_CALIBRATION.y,
    catLower === 'meter calibration / testing');
  drawCheckmark(COORDS.CB_SUB_TRANSFER.x,     COORDS.CB_SUB_TRANSFER.y,
    catLower === 'transfer of kwhm');

  // ── Others ─────────────────────────────────────────────────────────────
  // isOthers is true for: (a) OTHERS_ROUTED_CATS (categories with no template box)
  // and (b) any category not matched by any known set.
  // In both cases, tick the Others checkbox and write the category name on the text line.
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
  // ACTION Taken/Remarks — template provides 3 underlined rows; wrap long input
  // across them. Line 1 starts after the "ACTION Taken/Remarks:" label, but
  // lines 2 & 3 have no label in the way and can use the full underline width
  // starting much further left.
  drawWrappedText(memo.action_taken || '', COORDS.ACTION_TAKEN.x, COORDS.ACTION_TAKEN.y, {
    size: 9,
    maxWidth: 170,
    maxLines: 3,
    continuationX:        COORDS.ACTION_TAKEN_CONT_X,
    continuationMaxWidth: COORDS.ACTION_TAKEN_CONT_WIDTH,
    // Per-line y override: line 1 stays at ACTION_TAKEN.y, lines 2 & 3 use
    // their own calibration constants.
    lineYs: [
      COORDS.ACTION_TAKEN.y,
      COORDS.ACTION_TAKEN_L2_Y,
      COORDS.ACTION_TAKEN_L3_Y,
    ],
  });
  drawText(memo.contact_no   || '', COORDS.CONTACT_NO.x,   COORDS.CONTACT_NO.y,
    { size: 9, maxWidth: 185 });
  drawText(memo.referred_to  || '', COORDS.REFERRED_TO.x,  COORDS.REFERRED_TO.y,
    { size: 9, maxWidth: 170 });
  drawText(memo.received_by  || '', COORDS.RECEIVED_BY.x,  COORDS.RECEIVED_BY.y,
    { size: 9, maxWidth: 145 });

  // DATE_RECEIVED = when the ticket was reported (ticket_created_at)
  drawText(
    formatFullDateTime(memo.ticket_created_at),
    COORDS.DATE_RECEIVED.x, COORDS.DATE_RECEIVED.y, { size: 8, maxWidth: 200 }
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
 * Print the filled PDF by opening it in a new browser tab.
 * The browser's native PDF viewer renders the document correctly, and the
 * user can print from there using Ctrl+P or the viewer's print button.
 *
 * This is more reliable than an iframe approach: embedded PDF plugins are
 * not guaranteed to be available in all browsers/configurations, which causes
 * raw bytes to be sent to the printer (printing as symbols).
 *
 * @param {Uint8Array} pdfBytes
 */
export function printPdf(pdfBytes) {
  const blob = new Blob([pdfBytes], { type: 'application/pdf' });
  const url  = URL.createObjectURL(blob);

  const tab = window.open(url, '_blank');

  // Revoke the blob URL after a generous delay so the new tab has time to load
  setTimeout(() => URL.revokeObjectURL(url), 60_000);

  if (!tab) {
    // Fallback if popup was blocked: trigger a download instead
    const link = document.createElement('a');
    link.href = url;
    link.download = 'ALECO_Service_Memo.pdf';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
}
