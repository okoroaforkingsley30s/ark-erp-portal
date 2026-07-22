import React, { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { readWorkbookRows } from '@/lib/safeWorkbook';
import { DEPARTMENT_IMPORTS, validateImportRows } from '@/lib/departmentImportContracts';
import { supabase } from '@/lib/supabaseClient';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  FileCheck2,
  FileSpreadsheet,
  History,
  Loader2,
  RefreshCw,
  ShieldCheck,
  Upload,
} from 'lucide-react';

const IMPORT_MODES = {
  merge: {
    label: 'Merge (recommended)',
    description: 'Insert new records and update matching records with the uploaded values.',
  },
  insert_only: {
    label: 'Insert only',
    description: 'Insert new records and skip identifiers that already exist.',
  },
  update_only: {
    label: 'Update only',
    description: 'Update matching records and skip identifiers that do not exist.',
  },
  replace: {
    label: 'Replace active snapshot',
    description: 'Merge the file and deactivate missing master records. Nothing is permanently deleted.',
  },
};

const REPLACE_BLOCKED = new Set(['device_assignments', 'repair_intake']);

function contractLabel(department, dataset) {
  return Object.values(DEPARTMENT_IMPORTS).find((item) => (item.department || '') === department && item.dataset === dataset)?.label
    || Object.values(DEPARTMENT_IMPORTS).find((item) => item.dataset === dataset)?.label
    || department;
}

function formatDate(value) {
  if (!value) return '—';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? String(value) : parsed.toLocaleString();
}

export default function DataImport() {
  const qc = useQueryClient();
  const [department, setDepartment] = useState('business_development');
  const [mode, setMode] = useState('merge');
  const [file, setFile] = useState(null);
  const [parsedRows, setParsedRows] = useState([]);
  const [reading, setReading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState(null);

  const contract = DEPARTMENT_IMPORTS[department];
  const markedRows = useMemo(() => validateImportRows(parsedRows, contract), [parsedRows, contract]);
  const validCount = markedRows.filter((item) => item.valid).length;
  const errorCount = markedRows.length - validCount;

  const historyQuery = useQuery({
    queryKey: ['department-import-batches'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ark_department_import_batches')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20);
      if (error) throw error;
      return data || [];
    },
  });

  const chooseDepartment = (value) => {
    setDepartment(value);
    setMode('merge');
    setFile(null);
    setParsedRows([]);
    setResult(null);
  };

  const handleFile = async (event) => {
    const selected = event.target.files?.[0];
    if (!selected) return;
    setReading(true);
    setResult(null);
    try {
      const rows = await readWorkbookRows(selected, { allSheets: false });
      const nonEmpty = rows.filter((row) => Object.values(row || {}).some((value) => String(value ?? '').trim()));
      if (!nonEmpty.length) throw new Error('The Data sheet has no records. Keep the template headers in row 1 and add records from row 2.');
      if (nonEmpty.length > 2000) throw new Error('A single import is limited to 2,000 records. Split this workbook into smaller files.');
      setFile(selected);
      setParsedRows(nonEmpty);
    } catch (error) {
      setFile(null);
      setParsedRows([]);
      setResult({ success: false, message: error.message || 'Workbook could not be read.' });
    } finally {
      setReading(false);
      event.target.value = '';
    }
  };

  const runImport = async () => {
    if (!file || !markedRows.length) return;
    if (errorCount) {
      setResult({ success: false, message: `Correct the ${errorCount} marked row${errorCount === 1 ? '' : 's'} before importing.` });
      return;
    }
    if (mode === 'replace' && REPLACE_BLOCKED.has(contract.dataset)) {
      setResult({ success: false, message: 'Replace is not allowed for workflow or assignment imports. Use Merge, Insert only or Update only.' });
      return;
    }
    if (mode === 'replace' && !window.confirm(`Replace the active ${contract.label} master snapshot? Records missing from this file will be deactivated, not deleted.`)) return;

    setImporting(true);
    setResult(null);
    try {
      const { data, error } = await supabase.rpc('ark_admin_import_department_data', {
        p_department: contract.department || department,
        p_dataset: contract.dataset,
        p_filename: file.name,
        p_rows: markedRows.map((item) => item.row),
        p_mode: mode,
      });
      if (error) throw error;
      setResult({
        success: true,
        message: `Import completed: ${data?.inserted || 0} inserted, ${data?.updated || 0} updated, ${data?.skipped || 0} skipped, ${data?.errors || 0} errors${data?.deactivated ? `, ${data.deactivated} deactivated` : ''}.`,
        detail: data,
      });
      qc.invalidateQueries({ queryKey: ['department-import-batches'] });
    } catch (error) {
      setResult({ success: false, message: error.message || 'Department import failed.' });
    } finally {
      setImporting(false);
    }
  };

  const previewFields = contract.fields.slice(0, 6);

  return (
    <div className="space-y-6 pb-20">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-3xl font-bold text-white">
            <FileSpreadsheet className="h-7 w-7 text-[#ff5a00]" />
            Department Data Import Center
          </h1>
          <p className="mt-1 text-sm text-slate-300">
            System Administrator-controlled templates, validation, import modes and permanent audit history.
          </p>
        </div>
        <Badge className="border-emerald-400/30 bg-emerald-500/10 px-3 py-2 text-emerald-200">
          <ShieldCheck className="mr-2 h-4 w-4" />System Administrator only
        </Badge>
      </div>

      <Card className="border-white/10 bg-[#102969]/90 p-5">
        <div className="grid gap-4 lg:grid-cols-3">
          <div>
            <p className="mb-2 text-sm font-semibold text-white">1. Select department</p>
            <Select value={department} onValueChange={chooseDepartment}>
              <SelectTrigger className="border-white/10 bg-[#08153d] text-white"><SelectValue /></SelectTrigger>
              <SelectContent>{Object.entries(DEPARTMENT_IMPORTS).map(([key, item]) => <SelectItem key={key} value={key}>{item.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <p className="mb-2 text-sm font-semibold text-white">2. Select import behavior</p>
            <Select value={mode} onValueChange={setMode}>
              <SelectTrigger className="border-white/10 bg-[#08153d] text-white"><SelectValue /></SelectTrigger>
              <SelectContent>{Object.entries(IMPORT_MODES).map(([key, item]) => <SelectItem key={key} value={key} disabled={key === 'replace' && REPLACE_BLOCKED.has(contract.dataset)}>{item.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="flex items-end">
            <Button asChild className="w-full bg-[#ff5a00] text-white hover:bg-[#ff5a00]/90">
              <a href={contract.template} download><Download className="mr-2 h-4 w-4" />Download {contract.label} template</a>
            </Button>
          </div>
        </div>
        <div className="mt-4 rounded-xl border border-blue-400/20 bg-blue-500/10 p-3 text-sm text-blue-100">
          <b>{contract.dataset.replaceAll('_', ' ')}:</b> {contract.description}
          <p className="mt-1 text-xs text-blue-200">{IMPORT_MODES[mode].description}</p>
        </div>
      </Card>

      <Card className="border-white/10 bg-[#102969]/90 p-5">
        <p className="mb-3 text-sm font-semibold text-white">3. Upload the completed template</p>
        <label className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-white/15 p-8 hover:bg-white/5">
          {reading ? <Loader2 className="mb-2 h-8 w-8 animate-spin text-[#ff5a00]" /> : <Upload className="mb-2 h-8 w-8 text-slate-300" />}
          <p className="font-medium text-white">{file ? file.name : 'Choose the department XLSX template'}</p>
          <p className="text-xs text-slate-400">XLSX/XLSM · 10 MB · 2,000 records maximum</p>
          <input type="file" accept=".xlsx,.xlsm" className="hidden" onChange={handleFile} disabled={reading || importing} />
        </label>
      </Card>

      {!!markedRows.length && (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <Card className="border-white/10 bg-[#102969] p-4"><p className="text-2xl font-bold text-white">{markedRows.length}</p><p className="text-xs text-slate-300">Rows read</p></Card>
            <Card className="border-emerald-400/20 bg-emerald-500/10 p-4"><p className="text-2xl font-bold text-emerald-300">{validCount}</p><p className="text-xs text-emerald-100">Ready</p></Card>
            <Card className={`p-4 ${errorCount ? 'border-red-400/20 bg-red-500/10' : 'border-white/10 bg-[#102969]'}`}><p className={`text-2xl font-bold ${errorCount ? 'text-red-300' : 'text-white'}`}>{errorCount}</p><p className="text-xs text-slate-300">Rows requiring correction</p></Card>
          </div>

          <Card className="overflow-x-auto border-white/10 bg-[#102969]/90 p-4">
            <div className="mb-3 flex items-center justify-between"><p className="font-semibold text-white">Marked preview</p><p className="text-xs text-slate-400">Showing first 100 rows</p></div>
            <table className="min-w-full text-left text-xs text-slate-200">
              <thead><tr className="border-b border-white/10"><th className="p-2">Row</th><th className="p-2">Check</th>{previewFields.map((item) => <th key={item.key} className="p-2">{item.label}</th>)}</tr></thead>
              <tbody>{markedRows.slice(0, 100).map((item) => <tr key={item.rowNumber} className={`border-b border-white/5 ${item.valid ? '' : 'bg-red-500/10'}`}><td className="p-2 font-mono">{item.rowNumber}</td><td className="p-2">{item.valid ? <Badge className="bg-emerald-500/15 text-emerald-200">Ready</Badge> : <span className="text-red-200">{item.errors.join('; ')}</span>}</td>{previewFields.map((field) => <td key={field.key} className="max-w-52 truncate p-2">{String(item.row[field.key] ?? '')}</td>)}</tr>)}</tbody>
            </table>
          </Card>

          <Button onClick={runImport} disabled={importing || errorCount > 0} className="bg-emerald-600 text-white hover:bg-emerald-700">
            {importing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileCheck2 className="mr-2 h-4 w-4" />}
            {importing ? 'Importing…' : `Import ${validCount} marked record${validCount === 1 ? '' : 's'}`}
          </Button>
        </>
      )}

      {result && <Card className={`p-4 ${result.success ? 'border-emerald-400/30 bg-emerald-500/10' : 'border-red-400/30 bg-red-500/10'}`}><div className="flex gap-2">{result.success ? <CheckCircle2 className="h-5 w-5 text-emerald-300" /> : <AlertTriangle className="h-5 w-5 text-red-300" />}<p className={result.success ? 'text-emerald-100' : 'text-red-100'}>{result.message}</p></div></Card>}

      <Card className="border-white/10 bg-[#102969]/90 p-5">
        <div className="mb-4 flex items-center justify-between"><div><h2 className="flex items-center gap-2 font-bold text-white"><History className="h-4 w-4 text-[#ff5a00]" />Import audit history</h2><p className="text-xs text-slate-400">Who imported what, when, and the result.</p></div><Button size="sm" variant="outline" onClick={() => historyQuery.refetch()}><RefreshCw className="mr-1 h-3 w-3" />Refresh</Button></div>
        <div className="space-y-2">{(historyQuery.data || []).map((batch) => <div key={batch.id} className="grid gap-2 rounded-lg border border-white/10 bg-[#08153d]/70 p-3 text-xs text-slate-200 md:grid-cols-6"><div><b>{contractLabel(batch.department, batch.dataset)}</b><p>{batch.dataset?.replaceAll('_', ' ')}</p></div><div><b>{batch.mode?.replaceAll('_', ' ')}</b><p>{batch.filename}</p></div><div><b>{batch.total_rows} rows</b><p>{batch.imported_rows} imported · {batch.skipped_rows} skipped</p></div><div><b className={batch.error_rows ? 'text-red-300' : 'text-emerald-300'}>{batch.error_rows} errors</b><p>{batch.deactivated_rows || 0} deactivated</p></div><div><b>{batch.imported_by_name || batch.imported_by_email}</b><p>{formatDate(batch.created_at)}</p></div><Badge className="h-fit w-fit bg-white/10 text-white">{batch.status}</Badge></div>)}{!historyQuery.isLoading && !(historyQuery.data || []).length && <p className="py-6 text-center text-sm text-slate-400">No department imports have been recorded.</p>}</div>
      </Card>
    </div>
  );
}
