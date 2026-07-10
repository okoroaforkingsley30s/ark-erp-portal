import { jsPDF } from 'jspdf';
import * as XLSX from 'xlsx';

const currencyFormatter = new Intl.NumberFormat('en-NG', {
  style: 'currency',
  currency: 'NGN',
  maximumFractionDigits: 2,
});

const dateTimeFormatter = new Intl.DateTimeFormat('en-NG', {
  dateStyle: 'medium',
  timeStyle: 'short',
});

const escapeHtml = (value) =>
  String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');

const toFileName = (title, extension) => {
  const safeTitle = String(title || 'finance-report')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  return `${safeTitle || 'finance-report'}-${new Date().toISOString().slice(0, 10)}.${extension}`;
};

const formatCellValue = (value, column = {}) => {
  if (value === null || value === undefined || value === '') return '';
  if (column.type === 'currency') return currencyFormatter.format(Number(value || 0));
  if (column.type === 'date') {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? String(value) : parsed.toLocaleDateString('en-NG');
  }
  if (column.type === 'number') return Number(value || 0).toLocaleString();
  return String(value);
};

const normalizeRows = (rows = [], columns = []) =>
  rows.map((row) =>
    columns.reduce((acc, column) => {
      const value = typeof column.accessor === 'function' ? column.accessor(row) : row[column.key];
      acc[column.label || column.key] = formatCellValue(value, column);
      return acc;
    }, {})
  );

const totalsToRows = (totals = {}) =>
  Object.entries(totals)
    .filter(([, value]) => value !== null && value !== undefined && value !== '')
    .map(([label, value]) => ({ label, value }));

export const buildFinanceReportMeta = ({
  title,
  filters,
  dateRange,
  metadata,
  totals,
} = {}) => {
  const meta = [
    ['Report', title || 'Finance Report'],
    ['Generated', dateTimeFormatter.format(new Date())],
  ];

  if (dateRange?.from || dateRange?.to) {
    meta.push(['Date Range', `${dateRange.from || 'Start'} to ${dateRange.to || 'Today'}`]);
  }

  Object.entries(filters || {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') meta.push([key, value]);
  });

  Object.entries(metadata || {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') meta.push([key, value]);
  });

  totalsToRows(totals).forEach((item) => meta.push([item.label, item.value]));

  return meta;
};

export const exportFinanceReportCsv = ({ title, columns, rows, filters, totals, metadata, dateRange }) => {
  const normalizedRows = normalizeRows(rows, columns);
  const metaRows = buildFinanceReportMeta({ title, filters, totals, metadata, dateRange });
  const csvRows = [
    ...metaRows.map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(',')),
    '',
    columns.map((column) => `"${String(column.label || column.key).replaceAll('"', '""')}"`).join(','),
    ...normalizedRows.map((row) =>
      columns
        .map((column) => `"${String(row[column.label || column.key] ?? '').replaceAll('"', '""')}"`)
        .join(',')
    ),
  ];

  downloadBlob(csvRows.join('\n'), toFileName(title, 'csv'), 'text/csv;charset=utf-8;');
};

export const exportFinanceReportExcel = ({ title, columns, rows, filters, totals, metadata, dateRange }) => {
  const normalizedRows = normalizeRows(rows, columns);
  const workbook = XLSX.utils.book_new();
  const metaRows = buildFinanceReportMeta({ title, filters, totals, metadata, dateRange });
  const sheetRows = [
    ...metaRows,
    [],
    columns.map((column) => column.label || column.key),
    ...normalizedRows.map((row) => columns.map((column) => row[column.label || column.key] ?? '')),
  ];
  const worksheet = XLSX.utils.aoa_to_sheet(sheetRows);
  worksheet['!cols'] = columns.map((column) => ({ wch: Math.max(14, String(column.label || column.key).length + 4) }));
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Report');
  XLSX.writeFile(workbook, toFileName(title, 'xlsx'));
};

export const exportFinanceReportPdf = ({ title, columns, rows, filters, totals, metadata, dateRange }) => {
  const doc = new jsPDF({ orientation: columns.length > 6 ? 'landscape' : 'portrait', unit: 'pt', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 36;
  const usableWidth = pageWidth - margin * 2;
  const normalizedRows = normalizeRows(rows, columns);
  const colWidth = usableWidth / Math.max(columns.length, 1);
  let y = margin;

  const addPageIfNeeded = (height = 18) => {
    if (y + height > pageHeight - margin) {
      doc.addPage();
      y = margin;
    }
  };

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text(title || 'Finance Report', margin, y);
  y += 18;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  buildFinanceReportMeta({ title, filters, totals, metadata, dateRange })
    .slice(1)
    .forEach(([label, value]) => {
      addPageIfNeeded(12);
      doc.text(`${label}: ${value}`, margin, y);
      y += 12;
    });
  y += 8;

  doc.setFont('helvetica', 'bold');
  columns.forEach((column, index) => {
    doc.text(String(column.label || column.key).slice(0, 18), margin + index * colWidth, y, {
      maxWidth: colWidth - 4,
    });
  });
  y += 14;

  doc.setFont('helvetica', 'normal');
  normalizedRows.forEach((row) => {
    addPageIfNeeded(16);
    columns.forEach((column, index) => {
      const label = column.label || column.key;
      doc.text(String(row[label] ?? '').slice(0, 40), margin + index * colWidth, y, {
        maxWidth: colWidth - 4,
      });
    });
    y += 14;
  });

  if (normalizedRows.length === 0) {
    addPageIfNeeded(16);
    doc.text('No records found.', margin, y);
  }

  doc.save(toFileName(title, 'pdf'));
};

export const printFinanceReport = ({ title, columns, rows, filters, totals, metadata, dateRange }) => {
  const normalizedRows = normalizeRows(rows, columns);
  const metaRows = buildFinanceReportMeta({ title, filters, totals, metadata, dateRange });
  const printWindow = window.open('', '_blank', 'width=1100,height=800');
  if (!printWindow) throw new Error('Unable to open print window. Please allow popups for ARK ONE.');

  const tableHead = columns.map((column) => `<th>${escapeHtml(column.label || column.key)}</th>`).join('');
  const tableRows = normalizedRows.length
    ? normalizedRows
        .map(
          (row) =>
            `<tr>${columns
              .map((column) => `<td>${escapeHtml(row[column.label || column.key])}</td>`)
              .join('')}</tr>`
        )
        .join('')
    : `<tr><td colspan="${columns.length}">No records found.</td></tr>`;

  printWindow.document.write(`
    <!doctype html>
    <html>
      <head>
        <title>${escapeHtml(title || 'Finance Report')}</title>
        <style>
          @page { size: A4; margin: 14mm; }
          * { box-sizing: border-box; }
          body { font-family: Arial, sans-serif; color: #111827; margin: 0; }
          h1 { font-size: 20px; margin: 0 0 10px; }
          .meta { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 4px 18px; font-size: 11px; margin-bottom: 14px; }
          table { width: 100%; border-collapse: collapse; font-size: 10px; }
          th { text-align: left; background: #f1f5f9; }
          th, td { border: 1px solid #d1d5db; padding: 6px; vertical-align: top; }
          tr { break-inside: avoid; }
          .timestamp { margin-top: 14px; font-size: 10px; color: #6b7280; }
          @media print { .no-print { display: none !important; } }
        </style>
      </head>
      <body>
        <h1>${escapeHtml(title || 'Finance Report')}</h1>
        <div class="meta">
          ${metaRows.map(([label, value]) => `<div><strong>${escapeHtml(label)}:</strong> ${escapeHtml(value)}</div>`).join('')}
        </div>
        <table>
          <thead><tr>${tableHead}</tr></thead>
          <tbody>${tableRows}</tbody>
        </table>
        <div class="timestamp">Generated by ARK ONE Finance.</div>
      </body>
    </html>
  `);
  printWindow.document.close();
  printWindow.focus();
  printWindow.print();
};

export const shareFinanceReport = async ({ title, text }) => {
  const url = window.location.href;
  const payload = {
    title: title || 'ARK ONE Finance Report',
    text: text || `${title || 'Finance report'} is ready in ARK ONE.`,
    url,
  };

  if (navigator.share) {
    await navigator.share(payload);
    return 'shared';
  }

  await navigator.clipboard.writeText(`${payload.text}\n${url}`);
  return 'copied';
};

export const openWhatsAppShare = ({ title, text }) => {
  const message = encodeURIComponent(`${text || title || 'ARK ONE Finance report'}\n${window.location.href}`);
  window.open(`https://wa.me/?text=${message}`, '_blank', 'noopener,noreferrer');
};

export function downloadBlob(content, fileName, type) {
  const blob = content instanceof Blob ? content : new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
