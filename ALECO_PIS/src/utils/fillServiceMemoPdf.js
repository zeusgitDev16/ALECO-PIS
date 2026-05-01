import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { formatToPhilippineTime } from './dateUtils';

/**
 * Fill ALECO Consumer Complaint Form PDF with service memo data
 * Uses coordinate-based text overlay (works with any PDF, including scanned forms)
 *
 * @param {ArrayBuffer} pdfTemplateBytes - The PDF template file as ArrayBuffer
 * @param {Object} memo - The service memo data
 * @returns {Promise<Uint8Array>} - The filled PDF as bytes
 */
export async function fillServiceMemoPdf(pdfTemplateBytes, memo) {
  // Load the PDF template
  const pdfDoc = await PDFDocument.load(pdfTemplateBytes);

  // Get the first page (assuming single-page form)
  const page = pdfDoc.getPages()[0];
  const { width, height } = page.getSize();

  // Embed standard font
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  // Helper to draw text at specific coordinates
  // Coordinates are in PDF points (1 inch = 72 points)
  // Origin (0,0) is bottom-left, so we calculate from top
  const drawText = (text, x, y, options = {}) => {
    const {
      size = 10,
      bold = false,
      color = rgb(0, 0, 0),
      maxWidth = null
    } = options;

    const selectedFont = bold ? fontBold : font;
    let displayText = text || '';

    // Truncate if too long for the field
    if (maxWidth) {
      const textWidth = selectedFont.widthOfTextAtSize(displayText, size);
      if (textWidth > maxWidth) {
        // Simple truncation - you could make this smarter
        while (displayText.length > 0 && selectedFont.widthOfTextAtSize(displayText + '...', size) > maxWidth) {
          displayText = displayText.slice(0, -1);
        }
        displayText += '...';
      }
    }

    page.drawText(displayText, {
      x,
      y: height - y, // Convert from top-coordinate to bottom-coordinate
      size,
      font: selectedFont,
      color,
    });
  };

  // Helper to draw checkmark
  const drawCheckmark = (x, y, checked = false) => {
    if (checked) {
      drawText('✓', x, y, { size: 14, bold: true });
    }
  };

  // Format dates for the PDF form (compact format)
  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    try {
      const formatted = formatToPhilippineTime(dateStr);
      // Extract just the date part: "March 20, 2026" -> "Mar 20, 2026"
      return formatted.replace(/\bat\s+[^$]+$/, '').trim();
    } catch {
      return dateStr;
    }
  };

  const formatDateTime = (dateStr) => {
    if (!dateStr) return '';
    try {
      // Get compact format: "Mar 20, 1:30 PM"
      const formatted = formatToPhilippineTime(dateStr);
      return formatted.replace(' at ', ' ');
    } catch {
      return dateStr;
    }
  };

  // ============================================
  // FIELD COORDINATES (adjust based on your PDF)
  // These are estimates based on standard A4/US Letter form layout
  // ============================================

  // Header - Date and Memo No. (top right area)
  drawText(formatDate(memo.created_at), 520, 55, { size: 10 }); // Date
  drawText(memo.control_number || memo.memo_id || '', 520, 75, { size: 10 }); // MEMO No.

  // Nature of Complaint Checkboxes
  // Left column
  const isNoLightPower = (memo.category || '').toLowerCase().includes('no light') ||
                        (memo.category || '').toLowerCase().includes('no power');
  const isPowerQuality = (memo.category || '').toLowerCase().includes('voltage') ||
                         (memo.category || '').toLowerCase().includes('quality');
  const isServiceDrop = (memo.category || '').toLowerCase().includes('service drop');
  const isPoleComplaint = (memo.category || '').toLowerCase().includes('pole');
  const isMeterComplaint = (memo.category || '').toLowerCase().includes('meter') ||
                          (memo.category || '').toLowerCase().includes('kwh');

  // NO LIGHT/POWER checkbox (adjust x, y coordinates as needed)
  drawCheckmark(65, 130, isNoLightPower);

  // Sub-options for NO LIGHT/POWER
  drawCheckmark(85, 150, isNoLightPower); // Primary Line
  drawCheckmark(85, 170, isNoLightPower); // Distribution XFormer
  drawCheckmark(85, 190, isNoLightPower); // Residence No Power

  // POWER Quality Complaint
  drawCheckmark(65, 215, isPowerQuality);
  drawCheckmark(85, 235, isPowerQuality); // Low voltage
  drawCheckmark(85, 255, isPowerQuality); // Fluctuating Voltage
  drawCheckmark(85, 275, isPowerQuality); // Loose

  // Complaints/Services on Service Drop
  drawCheckmark(65, 300, isServiceDrop);
  drawCheckmark(85, 320, isServiceDrop); // Reroute Service Drop
  drawCheckmark(85, 340, isServiceDrop); // Change Upgrade Service

  // Right column checkboxes
  // Dist. Pole Complaint
  drawCheckmark(320, 130, isPoleComplaint);
  drawCheckmark(340, 150, isPoleComplaint); // Rotten Pole
  drawCheckmark(340, 170, isPoleComplaint); // Leaning Pole
  drawCheckmark(340, 190, isPoleComplaint); // Relocation
  drawCheckmark(340, 210, isPoleComplaint); // Distribution Xformer Replacement

  // Complaints on KWHR Meter
  drawCheckmark(320, 240, isMeterComplaint);
  drawCheckmark(340, 260, isMeterComplaint); // Check-up of KWHM
  drawCheckmark(340, 280, isMeterComplaint); // Meter Calibration/Testing
  drawCheckmark(340, 300, isMeterComplaint); // Transfer of KWHM

  // Others
  const isOthers = !isNoLightPower && !isPowerQuality && !isServiceDrop && !isPoleComplaint && !isMeterComplaint;
  drawCheckmark(320, 330, isOthers);

  // ============================================
  // FORM FIELDS
  // ============================================

  // Requested by
  drawText(memo.requested_by || memo.consumer_name || '', 130, 385, { size: 10, maxWidth: 200 });

  // Location
  drawText(memo.location || memo.address || '', 420, 385, { size: 10, maxWidth: 200 });

  // Address (with second line)
  drawText(memo.address || '', 130, 410, { size: 10, maxWidth: 200 });

  // ACTION Taken/Remarks (multi-line area)
  drawText(memo.remarks || memo.notes || '', 420, 410, { size: 9, maxWidth: 200 });

  // Contact no.
  drawText(memo.phone_number || memo.contact_no || '', 130, 435, { size: 10, maxWidth: 200 });

  // Landmark
  drawText(memo.landmark || '', 130, 460, { size: 10, maxWidth: 200 });
  drawText(memo.landmark ? '' : '', 130, 480, { size: 10 }); // Second line

  // Referred to (Lineman)
  drawText(memo.referred_to || memo.lineman_name || '', 420, 460, { size: 10, maxWidth: 180 });

  // Received by
  drawText(memo.owner_name || memo.received_by || '', 130, 520, { size: 10, maxWidth: 150 });

  // Date/Time Received
  drawText(formatDateTime(memo.created_at), 320, 520, { size: 9, maxWidth: 100 });

  // Date Arrived on Site
  drawText(formatDate(memo.dispatched_at) || formatDate(memo.date_arrived) || '', 420, 520, { size: 9, maxWidth: 80 });

  // Time on Site
  drawText('', 520, 520, { size: 9 }); // Empty field

  // Date/Time Accomplished
  drawText(formatDateTime(memo.accomplished_at) || formatDateTime(memo.closed_at) || '', 520, 545, { size: 9, maxWidth: 100 });

  // Second Date/Time Received (bottom)
  drawText(formatDateTime(memo.created_at), 130, 570, { size: 9, maxWidth: 150 });

  // Serialize the PDF
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
 * Print the filled PDF in a new window
 * @param {Uint8Array} pdfBytes - The PDF bytes
 */
export function printPdf(pdfBytes) {
  const blob = new Blob([pdfBytes], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);

  // Open in new window and trigger print
  const printWindow = window.open(url, '_blank');

  if (printWindow) {
    printWindow.onload = () => {
      setTimeout(() => {
        printWindow.print();
      }, 500);
    };
  }

  // Clean up after printing
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}
