import React, { useState } from 'react';
import { Download, FileDown, FileSpreadsheet, MessageCircle, Printer, Share2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  exportFinanceReportCsv,
  exportFinanceReportExcel,
  exportFinanceReportPdf,
  openWhatsAppShare,
  printFinanceReport,
  shareFinanceReport,
} from '@/lib/financeReportExport';

export default function FinanceReportToolbar({
  title,
  columns = [],
  rows = [],
  filters,
  totals,
  metadata,
  dateRange,
  disabled = false,
  className = '',
}) {
  const [busy, setBusy] = useState('');
  const report = { title, columns, rows, filters, totals, metadata, dateRange };
  const isDisabled = disabled || columns.length === 0;

  const run = async (action, handler) => {
    try {
      setBusy(action);
      await handler();
    } catch (error) {
      alert(error.message || `Unable to ${action} report.`);
    } finally {
      setBusy('');
    }
  };

  return (
    <div className={`flex flex-wrap items-center gap-2 ${className}`}>
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={isDisabled || busy === 'print'}
        onClick={() => run('print', () => printFinanceReport(report))}
      >
        <Printer className="w-4 h-4 mr-2" />
        Print
      </Button>
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={isDisabled || busy === 'excel'}
        onClick={() => run('excel', () => exportFinanceReportExcel(report))}
      >
        <FileSpreadsheet className="w-4 h-4 mr-2" />
        Excel
      </Button>
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={isDisabled || busy === 'csv'}
        onClick={() => run('csv', () => exportFinanceReportCsv(report))}
      >
        <Download className="w-4 h-4 mr-2" />
        CSV
      </Button>
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={isDisabled || busy === 'pdf'}
        onClick={() => run('pdf', () => exportFinanceReportPdf(report))}
      >
        <FileDown className="w-4 h-4 mr-2" />
        PDF
      </Button>
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={busy === 'share'}
        onClick={() => run('share', () => shareFinanceReport({ title }))}
      >
        <Share2 className="w-4 h-4 mr-2" />
        Share
      </Button>
      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={() => openWhatsAppShare({ title })}
      >
        <MessageCircle className="w-4 h-4 mr-2" />
        WhatsApp
      </Button>
    </div>
  );
}
