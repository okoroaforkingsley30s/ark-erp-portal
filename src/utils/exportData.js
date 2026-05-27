import * as XLSX from 'xlsx';

/**
 * Export data as CSV file
 * @param {Array} rows - array of objects
 * @param {string} filename - filename without extension
 */
export function exportCSV(rows, filename = 'export') {
  if (!rows?.length) return;
  const headers = Object.keys(rows[0]);
  const csv = [
    headers.join(','),
    ...rows.map(row =>
      headers.map(h => {
        const val = row[h] ?? '';
        const str = String(val).replace(/"/g, '""');
        return str.includes(',') || str.includes('\n') || str.includes('"') ? `"${str}"` : str;
      }).join(',')
    )
  ].join('\n');

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${filename}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Export data as Excel (.xlsx) file
 * @param {Array|Object} sheets - single array or { sheetName: rows[] } map
 * @param {string} filename - filename without extension
 */
export function exportExcel(sheets, filename = 'export') {
  const wb = XLSX.utils.book_new();

  if (Array.isArray(sheets)) {
    const ws = XLSX.utils.json_to_sheet(sheets);
    XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
  } else {
    Object.entries(sheets).forEach(([name, rows]) => {
      const ws = XLSX.utils.json_to_sheet(rows.length ? rows : [{}]);
      XLSX.utils.book_append_sheet(wb, ws, name.slice(0, 31));
    });
  }

  XLSX.writeFile(wb, `${filename}.xlsx`);
}