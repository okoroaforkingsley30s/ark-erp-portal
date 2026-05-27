import React, { useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import { supabase } from '@/lib/supabaseClient';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Upload, FileSpreadsheet, CheckCircle2, AlertTriangle } from 'lucide-react';

const clean = (v) => String(v || '').trim();

const BANKS = ['ACCESS', 'ACCESS BANK', 'FIDELITY', 'FIDELITY BANK', 'UNITY', 'KEYSTONE', 'UBA', 'GTB', 'ZENITH'];

const isTerminal = (v) => /^[0-9A-Z]{7,}$/i.test(clean(v));

const detectBank = (values) =>
  values.find(v => BANKS.some(b => clean(v).toUpperCase().includes(b))) || '';

const parseWorkbook = (rows) => {
  let currentEngineer = '';
  let currentState = '';
  const devices = [];

  rows.forEach(row => {
    const values = Object.values(row).map(clean).filter(Boolean);
    const joined = values.join(' ').toUpperCase();

    if (!values.length) return;

    if (joined.includes('STATE') || ['ABUJA', 'KADUNA', 'KANO', 'GOMBE', 'SOKOTO', 'JOS'].includes(joined)) {
      currentState = values[0];
      return;
    }

    if (joined.includes('MACHINES') || joined.includes('PHONE') || joined.includes('EMAIL')) {
      const name = values.find(v => {
        const u = v.toUpperCase();
        return !u.includes('PHONE') && !u.includes('EMAIL') && !u.includes('MACHINES') && !u.includes('@');
      });
      if (name) currentEngineer = name;
      return;
    }

    if (joined.includes('S/N') || joined.includes('TERMINAL ID')) return;

    const terminal_id = values.find(isTerminal);
    const bank_name = detectBank(values);

    if (!terminal_id || !bank_name) return;

    const branch_name =
      values.find(v =>
        v !== terminal_id &&
        v !== bank_name &&
        !isTerminal(v) &&
        !BANKS.some(b => v.toUpperCase().includes(b)) &&
        !/^\d+$/.test(v)
      ) || '';

    devices.push({
      terminal_id,
      bank_name: bank_name.toUpperCase().includes('ACCESS') ? 'ACCESS BANK' : bank_name,
      branch_name,
      state: currentState,
      location: currentState,
      assigned_engineer_name: currentEngineer,
      status: joined.includes('DOWN') || joined.includes('DWON') ? 'down' : 'active',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
  });

  const seen = new Set();
  return devices.filter(d => {
    if (seen.has(d.terminal_id)) return false;
    seen.add(d.terminal_id);
    return true;
  });
};

export default function DataImport() {
  const [devices, setDevices] = useState([]);
  const [rawCount, setRawCount] = useState(0);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState(null);

  const banks = useMemo(() => {
    const map = new Map();
    devices.forEach(d => map.set(d.bank_name, {
      bank_name: d.bank_name,
      name: d.bank_name,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }));
    return [...map.values()];
  }, [devices]);

  const branches = useMemo(() => {
  const map = new Map();

  devices.forEach(d => {
    if (!d.branch_name || !d.bank_name) return;

    const key = `${d.bank_name}-${d.branch_name}`;

    map.set(key, {
      bank_name: d.bank_name,
      branch_name: d.branch_name,
      location: d.location || d.state || '',
      branch_key: key,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
  });

  return [...map.values()];
}, [devices]);

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setResult(null);

    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: 'array' });

    let allRows = [];

    workbook.SheetNames.forEach(sheetName => {
      const sheet = workbook.Sheets[sheetName];
      const rows = XLSX.utils.sheet_to_json(sheet, {
        defval: '',
        raw: false,
      });
      allRows = [...allRows, ...rows];
    });

    const cleanedRows = allRows.filter(r =>
      Object.values(r).some(v => clean(v))
    );

    setRawCount(cleanedRows.length);
    setDevices(parseWorkbook(cleanedRows));
  };

  const upsert = async (table, rows, conflict) => {
    if (!rows.length) return;
    const { error } = await supabase.from(table).upsert(rows, { onConflict: conflict });
    if (error) throw new Error(`${table}: ${error.message}`);
  };

  const handleImport = async () => {
    try {
      setImporting(true);

      await upsert('banks', banks, 'bank_name');
      const uniqueBranches = Array.from(
  new Map(
    branches.map(b => [b.branch_key, b])
  ).values()
);

await upsert('branches', uniqueBranches, 'branch_key');
      const uniqueDevices = Array.from(
  new Map(
    devices.map(d => [d.terminal_id, d])
  ).values()
);

await upsert('devices', uniqueDevices, 'terminal_id');

      setResult({
        success: true,
        message: `Imported ${banks.length} banks, ${branches.length} branches and ${devices.length} devices.`,
      });
    } catch (err) {
      setResult({
        success: false,
        message: err.message,
      });
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <FileSpreadsheet className="w-6 h-6 text-primary" />
          Smart Excel Import Wizard
        </h1>
        <p className="text-sm text-muted-foreground">
          Upload messy engineer Excel reports. ARK ONE will clean, classify and import devices automatically.
        </p>
      </div>

      <Card className="p-5">
        <label className="border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center cursor-pointer hover:bg-muted/40">
          <Upload className="w-8 h-8 text-muted-foreground mb-2" />
          <p className="font-medium">Click to upload Excel file</p>
          <p className="text-xs text-muted-foreground">Supports .xlsx and .xls</p>
          <input type="file" accept=".xlsx,.xls" className="hidden" onChange={handleFile} />
        </label>
      </Card>

      {rawCount > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <Card className="p-4">
            <p className="text-2xl font-bold">{rawCount}</p>
            <p className="text-xs text-muted-foreground">Raw Rows Read</p>
          </Card>
          <Card className="p-4">
            <p className="text-2xl font-bold">{devices.length}</p>
            <p className="text-xs text-muted-foreground">Devices Detected</p>
          </Card>
          <Card className="p-4">
            <p className="text-2xl font-bold">{banks.length}</p>
            <p className="text-xs text-muted-foreground">Banks Detected</p>
          </Card>
          <Card className="p-4">
            <p className="text-2xl font-bold">{branches.length}</p>
            <p className="text-xs text-muted-foreground">Branches Detected</p>
          </Card>
        </div>
      )}

      {devices.length > 0 && (
        <>
          <Card className="p-4 overflow-x-auto">
            <p className="font-semibold mb-3">Clean Preview</p>

            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left">
                  <th className="py-2">Terminal ID</th>
                  <th>Bank</th>
                  <th>Branch</th>
                  <th>State</th>
                  <th>Engineer</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {devices.slice(0, 100).map((d, i) => (
                  <tr key={i} className="border-b">
                    <td className="py-2 font-mono">{d.terminal_id}</td>
                    <td>{d.bank_name}</td>
                    <td>{d.branch_name}</td>
                    <td>{d.state}</td>
                    <td>{d.assigned_engineer_name}</td>
                    <td>{d.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {devices.length > 100 && (
              <p className="text-xs text-muted-foreground mt-2">
                Showing first 100 devices only.
              </p>
            )}
          </Card>

          <Button onClick={handleImport} disabled={importing}>
            {importing ? 'Importing...' : 'Import Clean Data to Supabase'}
          </Button>
        </>
      )}

      {rawCount > 0 && devices.length === 0 && (
        <Card className="p-4 border-amber-200 bg-amber-50">
          <p className="text-amber-700 text-sm">
            Excel was read, but no devices were detected. Send me a screenshot of the first rows and I will tune the parser.
          </p>
        </Card>
      )}

      {result && (
        <Card className={`p-4 ${result.success ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}`}>
          <div className="flex items-center gap-2">
            {result.success ? (
              <CheckCircle2 className="w-5 h-5 text-green-600" />
            ) : (
              <AlertTriangle className="w-5 h-5 text-red-600" />
            )}
            <p className={result.success ? 'text-green-700' : 'text-red-700'}>
              {result.message}
            </p>
          </div>
        </Card>
      )}
    </div>
  );
}