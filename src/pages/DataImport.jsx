import React, { useMemo, useState } from 'react';
import { readWorkbookRows } from '@/lib/safeWorkbook';
import { supabase } from '@/lib/supabaseClient';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

import {
  Upload,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';

const clean = (v) => String(v || '').trim();

const BANKS = [
  'ACCESS',
  'ACCESS BANK',
  'FIDELITY',
  'FIDELITY BANK',
  'UNITY',
  'UNITY BANK',
  'KEYSTONE',
  'UBA',
  'GTB',
  'ZENITH',
  'FIRST BANK',
  'FCMB',
  'STERLING',
  'WEMA',
  'ECOBANK',
  'POLARIS',
];

const isTerminal = (v) => /^[0-9A-Z]{7,}$/i.test(clean(v));

const normalizeBank = (bank = '') => {
  const b = clean(bank).toUpperCase();

  if (b.includes('ACCESS')) return 'ACCESS BANK';
  if (b.includes('FIDELITY')) return 'FIDELITY BANK';
  if (b.includes('UNITY')) return 'UNITY BANK';
  if (b.includes('KEYSTONE')) return 'KEYSTONE BANK';
  if (b.includes('ZENITH')) return 'ZENITH BANK';
  if (b.includes('UBA')) return 'UBA';
  if (b.includes('GTB')) return 'GTBANK';

  return b;
};

const detectBank = (values) =>
  values.find(v =>
    BANKS.some(b =>
      clean(v).toUpperCase().includes(b)
    )
  ) || '';

const emailFromName = (name) => {
  const slug = clean(name)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '.')
    .replace(/^\.|\.$/g, '');

  return `${slug || 'engineer'}@ark.local`;
};

const parseWorkbook = (rows) => {

  let currentEngineer = '';
  let currentState = '';

  const devices = [];

  rows.forEach(row => {

    const values = Object
      .values(row)
      .map(clean)
      .filter(Boolean);

    const joined =
      values.join(' ').toUpperCase();

    if (!values.length) return;

    // Detect location/state/region row
    if (
      joined.includes('STATE') ||
      [
        'ABUJA',
        'KADUNA',
        'KANO',
        'GOMBE',
        'SOKOTO',
        'JOS',
        'PLATEAU'
      ].includes(joined)
    ) {
      currentState = values[0];
      return;
    }

    // Detect engineer row
    if (
      joined.includes('MACHINES') ||
      joined.includes('PHONE') ||
      joined.includes('EMAIL')
    ) {
      const name = values.find(v => {
        const u = v.toUpperCase();

        return (
          !u.includes('PHONE') &&
          !u.includes('EMAIL') &&
          !u.includes('MACHINES') &&
          !u.includes('@') &&
          !/^\d+$/.test(u)
        );
      });

      if (name) currentEngineer = name;

      return;
    }

    // Ignore table header rows
    if (
      joined.includes('S/N') ||
      joined.includes('TERMINAL ID') ||
      joined.includes('BRANCH BANK')
    ) {
      return;
    }

    const terminal_id =
      values.find(isTerminal);

    const detectedBank =
      detectBank(values);

    if (!terminal_id || !detectedBank)
      return;

    const bank_name =
      normalizeBank(detectedBank);

    const branch_name =
      values.find(v => {

        const upper = v.toUpperCase();

        return (
          v !== terminal_id &&
          v !== detectedBank &&
          !isTerminal(v) &&
          !BANKS.some(b => upper.includes(b)) &&
          !/^\d+$/.test(v)
        );
      }) || '';

    devices.push({
      terminal_id,

      bank_name,

      branch_name,

      state: currentState,

      location: currentState,

      assigned_engineer_name:
        currentEngineer,

      assigned_engineer_email:
        currentEngineer
          ? emailFromName(currentEngineer)
          : null,

      status:
        joined.includes('DOWN') ||
        joined.includes('DWON')
          ? 'down'
          : 'active',

      created_at:
        new Date().toISOString(),

      updated_at:
        new Date().toISOString(),
    });
  });

  const seen = new Set();

  return devices.filter(d => {

    if (seen.has(d.terminal_id))
      return false;

    seen.add(d.terminal_id);

    return true;
  });
};

export default function DataImport() {

  const [devices, setDevices] =
    useState([]);

  const [rawCount, setRawCount] =
    useState(0);

  const [importing, setImporting] =
    useState(false);

  const [result, setResult] =
    useState(null);

  const banks = useMemo(() => {

    const map = new Map();

    devices.forEach(d => {

      if (!d.bank_name) return;

      map.set(d.bank_name, {
        bank_name: d.bank_name,
        name: d.bank_name,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
    });

    return [...map.values()];
  }, [devices]);

  const branches = useMemo(() => {

    const map = new Map();

    devices.forEach(d => {

      if (!d.branch_name || !d.bank_name)
        return;

      const key =
        `${d.bank_name}-${d.branch_name}`;

      map.set(key, {
        bank_name: d.bank_name,
        branch_name: d.branch_name,
        location:
          d.location || d.state || '',
        branch_key: key,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
    });

    return [...map.values()];
  }, [devices]);

  const engineers = useMemo(() => {

    const map = new Map();

    devices.forEach(d => {

      if (!d.assigned_engineer_name)
        return;

      const name =
        d.assigned_engineer_name.trim();

      const email =
        d.assigned_engineer_email ||
        emailFromName(name);

      map.set(email, {
        full_name: name,
        email,
        role: 'engineer',
        department: 'Engineering',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
    });

    return [...map.values()];
  }, [devices]);

  const employees = useMemo(() => {

    return engineers.map(e => ({
      full_name: e.full_name,
      email: e.email,
      role: 'engineer',
      department: 'Engineering',
      job_title: 'Field Engineer',
      employee_status: 'active',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }));
  }, [engineers]);

  const handleFile = async (e) => {

    const file =
      e.target.files?.[0];

    if (!file) return;

    setResult(null);

    const allRows = await readWorkbookRows(file, { allSheets: true });

    const cleanedRows =
      allRows.filter(r =>
        Object.values(r).some(v => clean(v))
      );

    setRawCount(
      cleanedRows.length
    );

    setDevices(
      parseWorkbook(cleanedRows)
    );
  };

  const upsert = async (
    table,
    rows,
    conflict
  ) => {

    if (!rows.length) return;

    const uniqueRows =
      Array.from(
        new Map(
          rows.map(row => [
            row[conflict],
            row,
          ])
        ).values()
      );

    const { error } =
      await supabase
        .from(table)
        .upsert(uniqueRows, {
          onConflict: conflict,
        });

    if (error)
      throw new Error(
        `${table}: ${error.message}`
      );
  };

  const handleImport = async () => {

    try {

      setImporting(true);

      await upsert(
        'users',
        engineers,
        'email'
      );

      await upsert(
        'employees',
        employees,
        'email'
      );

      await upsert(
        'banks',
        banks,
        'bank_name'
      );

      await upsert(
        'branches',
        branches,
        'branch_key'
      );

      await upsert(
        'devices',
        devices,
        'terminal_id'
      );

      setResult({
        success: true,
        message:
          `Imported ${engineers.length} engineers, ` +
          `${employees.length} employees, ` +
          `${banks.length} banks, ` +
          `${branches.length} branches and ` +
          `${devices.length} devices.`,
      });

    } catch (err) {

      setResult({
        success: false,
        message:
          err.message || 'Import failed',
      });

    } finally {

      setImporting(false);
    }
  };

  return (
    <div className="space-y-5">

      <div>

        <h1 className="text-3xl font-bold flex items-center gap-2 text-white">

          <FileSpreadsheet className="w-6 h-6 text-primary" />

          Smart Excel Import Wizard
        </h1>

        <p className="text-sm text-muted-foreground">

          Upload messy engineer Excel reports. ARK ONE will clean, classify and import engineers, banks, branches and devices.
        </p>
      </div>

      <Card className="p-5">

        <label className="border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center cursor-pointer hover:bg-muted/40">

          <Upload className="w-8 h-8 text-muted-foreground mb-2" />

          <p className="font-medium">
            Click to upload Excel file
          </p>

          <p className="text-xs text-muted-foreground">
            Supports .xlsx and .xlsm (10 MB maximum)
          </p>

          <input
            type="file"
            accept=".xlsx,.xlsm"
            className="hidden"
            onChange={handleFile}
          />
        </label>
      </Card>

      {rawCount > 0 && (

        <div className="grid grid-cols-1 md:grid-cols-5 gap-3">

          <Card className="p-4">
            <p className="text-2xl font-bold">
              {rawCount}
            </p>
            <p className="text-xs text-muted-foreground">
              Raw Rows Read
            </p>
          </Card>

          <Card className="p-4">
            <p className="text-2xl font-bold">
              {engineers.length}
            </p>
            <p className="text-xs text-muted-foreground">
              Engineers
            </p>
          </Card>

          <Card className="p-4">
            <p className="text-2xl font-bold">
              {devices.length}
            </p>
            <p className="text-xs text-muted-foreground">
              Devices
            </p>
          </Card>

          <Card className="p-4">
            <p className="text-2xl font-bold">
              {banks.length}
            </p>
            <p className="text-xs text-muted-foreground">
              Banks
            </p>
          </Card>

          <Card className="p-4">
            <p className="text-2xl font-bold">
              {branches.length}
            </p>
            <p className="text-xs text-muted-foreground">
              Branches
            </p>
          </Card>
        </div>
      )}

      {devices.length > 0 && (

        <>

          <Card className="p-4 overflow-x-auto">

            <p className="font-semibold mb-3">
              Clean Preview
            </p>

            <table className="w-full text-sm">

              <thead>

                <tr className="border-b text-left">

                  <th className="py-2">
                    Terminal ID
                  </th>

                  <th>Bank</th>

                  <th>Branch</th>

                  <th>State</th>

                  <th>Engineer</th>

                  <th>Status</th>
                </tr>
              </thead>

              <tbody>

                {devices.slice(0, 100).map((d, i) => (

                  <tr
                    key={i}
                    className="border-b"
                  >

                    <td className="py-2 font-mono">
                      {d.terminal_id}
                    </td>

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

          <Button
            onClick={handleImport}
            disabled={importing}
          >

            {importing
              ? 'Importing...'
              : 'Import Clean Data to Supabase'}
          </Button>
        </>
      )}

      {rawCount > 0 && devices.length === 0 && (

        <Card className="p-4 border-amber-500/30 bg-amber-500/15 text-white">

          <p className="text-amber-700 text-sm">

            Excel was read, but no devices were detected. Send me a screenshot of the first rows and I will tune the parser.
          </p>
        </Card>
      )}

      {result && (

        <Card
          className={`p-4 ${
            result.success
              ? 'border-green-500/30 bg-green-500/15 text-white'
              : 'border-red-500/30 bg-red-500/15 text-white'
          }`}
        >

          <div className="flex items-center gap-2">

            {result.success ? (

              <CheckCircle2 className="w-5 h-5 text-green-600" />

            ) : (

              <AlertTriangle className="w-5 h-5 text-red-600" />
            )}

            <p
              className={
                result.success
                  ? 'text-green-700'
                  : 'text-red-700'
              }
            >

              {result.message}
            </p>
          </div>
        </Card>
      )}
    </div>
  );
}
