import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { Search, MapPin, Cpu, User, Loader2 } from 'lucide-react';

export default function BranchesPage() {
  const [search, setSearch] = useState('');
  const [filterBank, setFilterBank] = useState('all');
  const [filterRegion, setFilterRegion] = useState('all');

  const { data: branches = [], isLoading } = useQuery({
    queryKey: ['branches'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('branches')
        .select('*')
        .order('branch_name', { ascending: true });

      if (error) {
        console.error('Branches fetch error:', error);
        return [];
      }

      return data || [];
    },
  });

  const { data: devices = [] } = useQuery({
    queryKey: ['devices'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('devices')
        .select('*');

      if (error) {
        console.error('Devices fetch error:', error);
        return [];
      }

      return data || [];
    },
  });

  const { data: banks = [] } = useQuery({
    queryKey: ['banks'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('banks')
        .select('*')
        .order('bank_name', { ascending: true });

      if (error) {
        console.error('Banks fetch error:', error);
        return [];
      }

      return data || [];
    },
  });

  const regions = useMemo(() => {
    return [...new Set(branches.map(b => b.region).filter(Boolean))];
  }, [branches]);

  const filtered = useMemo(() => {
    return branches.filter(b => {
      const matchSearch =
        !search ||
        b.branch_name?.toLowerCase().includes(search.toLowerCase()) ||
        b.location?.toLowerCase().includes(search.toLowerCase());

      const matchBank =
        filterBank === 'all' ||
        b.bank_name === filterBank;

      const matchRegion =
        filterRegion === 'all' ||
        b.region === filterRegion;

      return matchSearch && matchBank && matchRegion;
    });
  }, [branches, search, filterBank, filterRegion]);

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Branches</h1>
        <p className="text-muted-foreground text-sm">
          {filtered.length} of {branches.length} branches
        </p>
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />

          <Input
            placeholder="Search branches..."
            className="pl-9"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        <Select value={filterBank} onValueChange={setFilterBank}>
          <SelectTrigger className="w-36">
            <SelectValue placeholder="All Banks" />
          </SelectTrigger>

          <SelectContent>
            <SelectItem value="all">All Banks</SelectItem>

            {banks.map(b => (
              <SelectItem key={b.id} value={b.bank_name}>
                {b.bank_name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filterRegion} onValueChange={setFilterRegion}>
          <SelectTrigger className="w-36">
            <SelectValue placeholder="All Regions" />
          </SelectTrigger>

          <SelectContent>
            <SelectItem value="all">All Regions</SelectItem>

            {regions.map(r => (
              <SelectItem key={r} value={r}>
                {r}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {filtered.map(branch => {
            const branchDevices = devices.filter(d =>
              (d.branch_name === branch.branch_name || d.branch === branch.branch_name) &&
              d.bank_name === branch.bank_name
            );

            return (
              <Card key={branch.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-primary flex-shrink-0" />
                      <span className="font-semibold text-sm leading-tight">
                        {branch.branch_name}
                      </span>
                    </div>

                    <Badge variant="outline" className="text-[10px]">
                      {branch.bank_name}
                    </Badge>
                  </div>

                  {branch.region && (
                    <Badge variant="secondary" className="text-[10px]">
                      {branch.region}
                    </Badge>
                  )}

                  {branch.location && (
                    <p className="text-xs text-muted-foreground">
                      {branch.location}
                    </p>
                  )}

                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Cpu className="w-3 h-3" />
                      {branchDevices.length} devices
                    </span>

                    {branch.assigned_engineer && (
                      <span className="flex items-center gap-1">
                        <User className="w-3 h-3" />
                        {branch.assigned_engineer}
                      </span>
                    )}
                  </div>

                  <Badge
                    variant={branch.status === 'active' ? 'default' : 'secondary'}
                    className="text-[10px]"
                  >
                    {branch.status || 'active'}
                  </Badge>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}