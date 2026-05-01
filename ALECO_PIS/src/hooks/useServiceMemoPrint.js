import { useState, useCallback } from 'react';
import { fillServiceMemoPdf, downloadPdf, printPdf } from '../utils/fillServiceMemoPdf';

/**
 * Hook for printing service memos using the official ALECO PDF template
 */
export function useServiceMemoPrint() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  /**
   * Print a service memo using the official PDF template
   * @param {Object} memo - The service memo data
   * @param {Object} options - Print options
   * @param {boolean} options.download - Download instead of print (default: false)
   * @param {string} options.templatePath - Path to PDF template (default: '/templates/Consumer Complaint Form_template.pdf')
   */
  const printMemo = useCallback(async (memo, options = {}) => {
    const { download = false, templatePath = '/templates/Consumer Complaint Form_template.pdf' } = options;

    setIsLoading(true);
    setError(null);

    try {
      // Fetch the PDF template
      const response = await fetch(templatePath);
      if (!response.ok) {
        throw new Error(`Failed to load PDF template: ${response.status} ${response.statusText}`);
      }

      const pdfTemplateBytes = await response.arrayBuffer();

      // Fill the PDF with memo data
      const filledPdfBytes = await fillServiceMemoPdf(pdfTemplateBytes, memo);

      // Generate filename
      const filename = `ALECO_Service_Memo_${memo.control_number || memo.memo_id || 'unknown'}_${new Date().toISOString().slice(0, 10)}.pdf`;

      // Either download or print
      if (download) {
        downloadPdf(filledPdfBytes, filename);
      } else {
        printPdf(filledPdfBytes);
      }

      return { success: true };
    } catch (err) {
      console.error('[useServiceMemoPrint] Error:', err);
      setError(err.message || 'Failed to print service memo');

      // Fallback to browser print if PDF generation fails
      if (typeof window !== 'undefined') {
        console.warn('[useServiceMemoPrint] Falling back to browser print');
        window.print();
      }

      return { success: false, error: err.message, fallback: true };
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Download a service memo as PDF
   */
  const downloadMemo = useCallback(async (memo, templatePath) => {
    return printMemo(memo, { download: true, templatePath });
  }, [printMemo]);

  return {
    printMemo,
    downloadMemo,
    isLoading,
    error,
    clearError: () => setError(null),
  };
}
