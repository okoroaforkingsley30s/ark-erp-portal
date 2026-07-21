import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, PackageCheck, Hash, MapPin, User, Building2, CalendarDays } from 'lucide-react';

const statusTone = {
  active: 'bg-green-500/15 text-green-300 border-green-500/30',
  assigned: 'bg-blue-500/15 text-blue-300 border-blue-500/30',
  under_repair: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
  disposed: 'bg-slate-500/15 text-slate-300 border-slate-500/30',
  lost: 'bg-red-500/15 text-red-300 border-red-500/30',
  retired: 'bg-slate-500/15 text-slate-300 border-slate-500/30',
};

const pretty = (value) => String(value || 'Not set').replace(/_/g, ' ');

async function fetchArkAssets() {
  const { data, error } = await supabase
    .from('finance_fixed_assets')
    .select('*')
    .order('asset_name', { ascending: true });

  if (error) throw error;
  return data || [];
}

export default function Assets() {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');

  const { data: assets = [], isLoading, error } = useQuery({
    queryKey: ['finance_fixed_assets'],
    queryFn: fetchArkAssets,
  });

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return assets.filter((asset) => {
      const matchesStatus = status === 'all' || asset.status === status;
      const searchable = [
        asset.asset_code,
        asset.asset_name,
        asset.asset_type,
        asset.serial_number,
        asset.assigned_department,
        asset.assigned_employee_name,
        asset.current_location,
      ].filter(Boolean).join(' ').toLowerCase();
      return matchesStatus && (!query || searchable.includes(query));
    });
  }, [assets, search, status]);

  const counts = useMemo(() => ({
    total: assets.length,
    active: assets.filter((asset) => ['active', 'assigned'].includes(asset.status)).length,
    repair: assets.filter((asset) => asset.status === 'under_repair').length,
    retired: assets.filter((asset) => ['retired', 'disposed'].includes(asset.status)).length,
  }), [assets]);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2 text-white">
          <PackageCheck className="w-7 h-7 text-primary" />
          ARK Assets
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          ARK-owned or ARK-supplied products. Customer bank machines and supported devices remain under Machines/Devices.
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          ['Total Assets', counts.total],
          ['Active / Assigned', counts.active],
          ['Under Repair', counts.repair],
          ['Retired / Disposed', counts.retired],
        ].map(([label, value]) => (
          <Card key={label} className="p-4">
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="text-2xl font-bold mt-1">{value}</p>
          </Card>
        ))}
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search asset code, product, serial, custodian or location..."
            className="pl-9"
          />
        </div>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-48"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {['active', 'assigned', 'under_repair', 'retired', 'disposed', 'lost'].map((item) => (
              <SelectItem key={item} value={item}>{pretty(item)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading && <p className="py-12 text-center text-muted-foreground">Loading ARK assets…</p>}
      {error && <p className="py-8 text-center text-red-400">Assets could not be loaded: {error.message}</p>}

      {!isLoading && !error && (
        <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((asset) => (
            <Card key={asset.id} className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold truncate">{asset.asset_name}</p>
                  <p className="text-xs text-muted-foreground">{asset.asset_type || 'ARK product'}</p>
                </div>
                <Badge variant="outline" className={statusTone[asset.status] || ''}>{pretty(asset.status)}</Badge>
              </div>
              <div className="mt-4 space-y-2 text-xs text-muted-foreground">
                <p className="flex gap-2"><Hash className="w-3.5 h-3.5" /> {asset.asset_code}</p>
                {asset.serial_number && <p className="flex gap-2"><PackageCheck className="w-3.5 h-3.5" /> Serial: {asset.serial_number}</p>}
                {asset.assigned_department && <p className="flex gap-2"><Building2 className="w-3.5 h-3.5" /> {asset.assigned_department}</p>}
                {asset.assigned_employee_name && <p className="flex gap-2"><User className="w-3.5 h-3.5" /> {asset.assigned_employee_name}</p>}
                {asset.current_location && <p className="flex gap-2"><MapPin className="w-3.5 h-3.5" /> {asset.current_location}</p>}
                {asset.purchase_date && <p className="flex gap-2"><CalendarDays className="w-3.5 h-3.5" /> Acquired {asset.purchase_date}</p>}
              </div>
            </Card>
          ))}
          {filtered.length === 0 && (
            <Card className="col-span-full py-14 text-center text-muted-foreground">
              No ARK assets match this filter. Add and maintain fixed assets from the Finance asset register.
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
