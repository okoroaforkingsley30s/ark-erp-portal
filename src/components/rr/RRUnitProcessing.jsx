import { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { supabase } from '@/lib/supabaseClient';
import { toast } from 'sonner';

const HOD_ROLES = ['system_admin','ceo','agm','manager','repair_head','rr_hod','repair_hod','head_of_rr'];
const normalize = (value) => String(value || '')
  .trim()
  .toLowerCase()
  .replace(/[\s-]+/g, '_');
const label = (value) => String(value || '').replaceAll('_', ' ').toUpperCase();

export default function RRUnitProcessing({ user, technicians = [], repairJobId = null }) {
  const qc = useQueryClient();
  const [working, setWorking] = useState(null);
  const [selectedTech, setSelectedTech] = useState({});
  const [notes, setNotes] = useState({});
  const [serials, setSerials] = useState({});
  const role = normalize(user?.role || user?.user_role || user?.position);
  const isHod = HOD_ROLES.includes(role);

  const { data: units = [], isLoading, error: unitsError } = useQuery({
    queryKey: ['rr-repair-units', repairJobId || 'all'],
    queryFn: async () => {
      let query = supabase.from('rr_repair_units').select('*, repair_jobs(job_number,ticket_id,item_name,device_name,quantity_received)').order('created_at', { ascending: false });
      if (repairJobId) query = query.eq('repair_job_id', repairJobId);
      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
  });

  useEffect(() => {
    const channel = supabase.channel(`rr-units-${repairJobId || 'all'}`).on('postgres_changes', { event: '*', schema: 'public', table: 'rr_repair_units' }, () => qc.invalidateQueries({ queryKey: ['rr-repair-units'] })).subscribe();
    return () => supabase.removeChannel(channel);
  }, [qc, repairJobId]);

  const summaries = useMemo(() => {
    const map = new Map();
    units.forEach((unit) => {
      const current = map.get(unit.repair_job_id) || { total: 0 };
      current.total += 1;
      current[unit.status] = (current[unit.status] || 0) + 1;
      map.set(unit.repair_job_id, current);
    });
    return map;
  }, [units]);

  const act = async (unit, action) => {
    if (action === 'assign' && !selectedTech[unit.id]) return toast.error('Select an RR technician.');
    if (action === 'submit_qa' && !String(notes[unit.id] || '').trim()) return toast.error('Enter diagnosis and repair work before QA submission.');
    setWorking(unit.id);
    const { error } = await supabase.rpc('ark_rr_transition_unit', {
      p_unit_id: unit.id,
      p_action: action,
      p_technician_id: action === 'assign' ? selectedTech[unit.id] : null,
      p_serial_number: serials[unit.id] || unit.serial_number || null,
      p_notes: notes[unit.id] || null,
    });
    if (error) toast.error(error.message); else {
      toast.success(`${unit.tracking_number}: ${label(action)} completed`);
      await Promise.all([
        qc.invalidateQueries({ queryKey: ['rr-repair-units'] }),
        qc.invalidateQueries({ queryKey: ['repair-jobs'] }),
      ]);
    }
    setWorking(null);
  };

  if (isLoading) return <p className="text-sm text-slate-300">Loading physical RR units…</p>;
  if (unitsError) return <Card className="border-red-400/30 bg-red-500/10 text-red-100"><CardContent className="p-4"><p className="font-semibold">Physical RR units could not be loaded.</p><p className="mt-1 text-xs">{unitsError.message}</p></CardContent></Card>;
  if (!units.length) return null;

  return <Card id="rr-unit-processing" className="bg-[#102969]/90 border-white/10 text-white">
    <CardHeader><CardTitle>Physical Unit Processing</CardTitle><p className="text-xs text-slate-300">Every quantity is tracked independently. Passed units can return without waiting for unfinished units.</p></CardHeader>
    <CardContent className="space-y-4">
      {[...summaries.entries()].map(([jobId, summary]) => <div key={jobId} className="rounded-lg border border-white/10 bg-[#08153d]/70 p-3 text-xs">
        <strong>Total: {summary.total}</strong> · Received: {summary.received || 0} · Assigned: {summary.assigned || 0} · Under Repair: {summary.under_repair || 0} · Waiting QA: {summary.waiting_qa || 0} · Passed: {summary.qa_passed || 0} · Failed: {summary.qa_failed || 0} · Returned: {summary.returned_inventory || 0} · Scrapped: {summary.scrapped || 0}
      </div>)}
      <div className="grid gap-3">
        {units.map((unit) => <div key={unit.id} className="rounded-xl border border-white/10 bg-[#08153d]/70 p-4">
          <div className="flex flex-wrap justify-between gap-3"><div><p className="font-mono text-xs text-orange-200">{unit.tracking_number}</p><p className="font-bold">{unit.item_name} · Unit {unit.unit_number}</p><p className="text-xs text-slate-300">Ticket: {unit.ticket_id || unit.repair_jobs?.ticket_id || '—'} · Job: {unit.repair_jobs?.job_number || '—'}</p></div><Badge>{label(unit.status)}</Badge></div>
          <div className="mt-3 grid gap-2 md:grid-cols-2"><Input placeholder="Serial number (if available)" value={serials[unit.id] ?? unit.serial_number ?? ''} onChange={(event) => setSerials((old) => ({ ...old, [unit.id]: event.target.value }))} className="bg-[#102969] border-white/10 text-white" /><Input placeholder="Diagnosis, repair action or QA note" value={notes[unit.id] || ''} onChange={(event) => setNotes((old) => ({ ...old, [unit.id]: event.target.value }))} className="bg-[#102969] border-white/10 text-white" /></div>
          <div className="mt-3 flex flex-wrap gap-2">
            {isHod && unit.status === 'received' && <><select value={selectedTech[unit.id] || ''} onChange={(event) => setSelectedTech((old) => ({ ...old, [unit.id]: event.target.value }))} className="rounded-md bg-[#102969] border border-white/10 px-2"><option value="">Select technician</option>{technicians.map((tech) => <option key={tech.id} value={tech.id}>{tech.full_name || tech.user_email}</option>)}</select><Button disabled={working===unit.id} onClick={() => act(unit,'assign')}>Assign Unit</Button></>}
            {!isHod && ['assigned','qa_failed'].includes(unit.status) && <Button disabled={working===unit.id} onClick={() => act(unit,'start_repair')}>{unit.status==='qa_failed' ? 'Start Rework' : 'Start Repair'}</Button>}
            {!isHod && unit.status === 'under_repair' && <Button disabled={working===unit.id} onClick={() => act(unit,'submit_qa')}>Submit Unit to QA</Button>}
            {isHod && unit.status === 'waiting_qa' && <><Button disabled={working===unit.id} onClick={() => act(unit,'qa_pass')} className="bg-emerald-600">QA Pass</Button><Button disabled={working===unit.id} onClick={() => act(unit,'qa_fail')} variant="destructive">QA Fail</Button></>}
            {isHod && unit.status === 'qa_passed' && <Button disabled={working===unit.id} onClick={() => act(unit,'return_inventory')} className="bg-orange-600">Send Unit to Inventory</Button>}
            {isHod && ['qa_failed','waiting_qa'].includes(unit.status) && <Button disabled={working===unit.id} onClick={() => act(unit,'scrap')} variant="destructive">Scrap Unit</Button>}
          </div>
        </div>)}
      </div>
    </CardContent>
  </Card>;
}
