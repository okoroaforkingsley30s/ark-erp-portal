const BLOCKED_KEYS = new Set(['__proto__', 'prototype', 'constructor']);
const MAX_FILE_BYTES = 10 * 1024 * 1024;
const MAX_ROWS = 10000;
const MAX_COLUMNS = 200;

async function createWorkbook() {
  const module = await import('exceljs');
  const ExcelJS = module.default || module;
  return new ExcelJS.Workbook();
}

function cellText(cell) {
  const value = cell?.value;
  if (value == null) return '';
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'object') {
    if ('result' in value) return String(value.result ?? '');
    if ('text' in value) return String(value.text ?? '');
    if (Array.isArray(value.richText)) return value.richText.map((part) => part.text || '').join('');
    return '';
  }
  return String(value);
}

export async function readWorkbookRows(file, { allSheets = true } = {}) {
  if (!file) throw new Error('Choose a workbook to import.');
  if (file.size <= 0 || file.size > MAX_FILE_BYTES) throw new Error('Workbook must be 10 MB or smaller.');
  if (!/\.(xlsx|xlsm)$/i.test(file.name)) throw new Error('Only XLSX or XLSM workbooks are allowed.');

  const workbook = await createWorkbook();
  await workbook.xlsx.load(await file.arrayBuffer(), { ignoreNodes: ['dataValidations'] });
  const worksheets = allSheets ? workbook.worksheets : workbook.worksheets.slice(0, 1);
  const result = [];

  for (const sheet of worksheets) {
    if (sheet.rowCount > MAX_ROWS + 1 || sheet.columnCount > MAX_COLUMNS) {
      throw new Error(`Worksheet ${sheet.name} exceeds the ${MAX_ROWS}-row or ${MAX_COLUMNS}-column import limit.`);
    }
    const headers = [];
    sheet.getRow(1).eachCell({ includeEmpty: true }, (cell, column) => {
      const header = cellText(cell).trim();
      headers[column] = BLOCKED_KEYS.has(header.toLowerCase()) ? '' : header;
    });
    sheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;
      const record = Object.create(null);
      headers.forEach((header, column) => {
        if (header) record[header] = cellText(row.getCell(column));
      });
      result.push(record);
    });
  }
  return result;
}

function safeExportValue(value) {
  if (value == null) return '';
  if (value instanceof Date || typeof value === 'number' || typeof value === 'boolean') return value;
  const text = typeof value === 'object' ? JSON.stringify(value) : String(value);
  return /^[=+\-@]/.test(text) ? `'${text}` : text;
}

async function saveWorkbook(workbook, filename) {
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

export async function exportWorkbook(sheets, filename = 'export') {
  const workbook = await createWorkbook();
  const entries = Array.isArray(sheets) ? [['Sheet1', sheets]] : Object.entries(sheets || {});
  for (const [name, sourceRows] of entries) {
    const rows = Array.isArray(sourceRows) && sourceRows.length ? sourceRows : [{}];
    const headers = [...new Set(rows.flatMap((row) => Object.keys(row || {})))].filter((key) => !BLOCKED_KEYS.has(key.toLowerCase()));
    const sheet = workbook.addWorksheet(String(name || 'Sheet').slice(0, 31));
    sheet.columns = headers.map((header) => ({ header, key: header, width: Math.min(60, Math.max(14, header.length + 4)) }));
    rows.forEach((row) => sheet.addRow(Object.fromEntries(headers.map((header) => [header, safeExportValue(row?.[header])]))));
    sheet.getRow(1).font = { bold: true };
    sheet.views = [{ state: 'frozen', ySplit: 1 }];
  }
  await saveWorkbook(workbook, filename);
}

export async function exportArrayWorkbook(rows, sheetName, filename, widths = []) {
  const workbook = await createWorkbook();
  const sheet = workbook.addWorksheet(String(sheetName || 'Sheet').slice(0, 31));
  rows.forEach((row) => sheet.addRow((row || []).map(safeExportValue)));
  widths.forEach((width, index) => { sheet.getColumn(index + 1).width = width; });
  await saveWorkbook(workbook, filename);
}
// @ts-check
