import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';

import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';

import {
  Search,
  AlertCircle,
  CheckCircle,
  Loader2
} from 'lucide-react';

import { toast } from 'sonner';

export default function DeviceAssignment() {

  const qc = useQueryClient();

  const [search, setSearch] = useState('');
  const [filterBank, setFilterBank] = useState('all');
  const [filterAssigned, setFilterAssigned] = useState('all');

  const [bulkEngineer, setBulkEngineer] = useState('');
  const [selected, setSelected] = useState(new Set());

  const { data: devices = [], isLoading } = useQuery({
    queryKey: ['devices-full'],

    queryFn: async () => {
      const { data, error } = await supabase
        .from('devices')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error(error);
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
        console.error(error);
        return [];
      }

      return data || [];
    },
  });

  const { data: engineers = [] } = useQuery({
    queryKey: ['engineers'],

    queryFn: async () => {
      const { data, error } = await supabase
        .from('engineers')
        .select('*')
        .order('engineer_name', { ascending: true });

      if (error) {
        console.error(error);
        return [];
      }

      return data || [];
    },
  });

  const filtered = useMemo(() => {
    return devices.filter(d => {

      const q = search.toLowerCase();

      const matchSearch =
        !search ||
        d.device_name?.toLowerCase().includes(q) ||
        d.branch_name?.toLowerCase().includes(q) ||
        d.terminal_id?.toString().includes(q);

      const matchBank =
        filterBank === 'all' ||
        d.bank_name === filterBank;

      const matchAssigned =
        filterAssigned === 'all' ||
        (
          filterAssigned === 'unassigned'
            ? !d.assigned_engineer
            : !!d.assigned_engineer
        );

      return (
        matchSearch &&
        matchBank &&
        matchAssigned
      );
    });
  }, [
    devices,
    search,
    filterBank,
    filterAssigned
  ]);

  const assignSingle = useMutation({

    mutationFn: async ({ id, engineer }) => {

      const { error } = await supabase
        .from('devices')
        .update({
          assigned_engineer: engineer
        })
        .eq('id', id);

      if (error) throw error;
    },

    onSuccess: () => {
      qc.invalidateQueries({
        queryKey: ['devices-full']
      });

      toast.success('Engineer assigned');
    },

    onError: (err) => {
      toast.error(err.message);
    }
  });

  const assignBulk = async () => {

    if (!bulkEngineer || selected.size === 0) {
      return;
    }

    try {

      for (const id of selected) {

        const { error } = await supabase
          .from('devices')
          .update({
            assigned_engineer: bulkEngineer
          })
          .eq('id', id);

        if (error) throw error;
      }

      qc.invalidateQueries({
        queryKey: ['devices-full']
      });

      setSelected(new Set());
      setBulkEngineer('');

      toast.success(
        `Assigned ${selected.size} devices to ${bulkEngineer}`
      );

    } catch (err) {
      console.error(err);
      toast.error(err.message);
    }
  };

  const toggleSelect = (id) => {
    setSelected(prev => {

      const s = new Set(prev);

      s.has(id)
        ? s.delete(id)
        : s.add(id);

      return s;
    });
  };

  const selectAll = () => {
    setSelected(
      new Set(filtered.map(d => d.id))
    );
  };

  const clearAll = () => {
    setSelected(new Set());
  };

  const unassigned = devices.filter(
    d => !d.assigned_engineer
  ).length;

  return (
    <div className="p-6 space-y-6">

      <div className="flex items-start justify-between">

        <div>
          <h1 className="text-2xl font-bold">
            Device Assignment
          </h1>

          <p className="text-muted-foreground text-sm">
            Manage engineer-to-device assignments
          </p>
        </div>

        {unassigned > 0 && (
          <div className="flex items-center gap-2 bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 rounded-lg px-3 py-2">

            <AlertCircle className="w-4 h-4 text-yellow-600" />

            <span className="text-sm text-yellow-700 dark:text-yellow-400">
              {unassigned} unassigned devices
            </span>

          </div>
        )}

      </div>

      {selected.size > 0 && (

        <Card className="bg-primary/5 border-primary/20">

          <CardContent className="p-4 flex flex-wrap items-center gap-3">

            <Badge className="text-sm">
              {selected.size} selected
            </Badge>

            <Select
              value={bulkEngineer}
              onValueChange={setBulkEngineer}
            >

              <SelectTrigger className="w-48">
                <SelectValue placeholder="Select engineer..." />
              </SelectTrigger>

              <SelectContent>

                {engineers.map(e => (
                  <SelectItem
                    key={e.id}
                    value={e.engineer_name}
                  >
                    {e.engineer_name}
                  </SelectItem>
                ))}

              </SelectContent>

            </Select>

            <Button
              size="sm"
              onClick={assignBulk}
              disabled={!bulkEngineer}
            >
              <CheckCircle className="w-4 h-4 mr-1" />
              Assign All
            </Button>

            <Button
              size="sm"
              variant="ghost"
              onClick={clearAll}
            >
              Clear
            </Button>

          </CardContent>

        </Card>
      )}

      <div className="flex flex-wrap gap-3">

        <div className="relative flex-1 min-w-[200px]">

          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />

          <Input
            placeholder="Search devices..."
            className="pl-9"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />

        </div>

        <Select
          value={filterBank}
          onValueChange={setFilterBank}
        >

          <SelectTrigger className="w-32">
            <SelectValue placeholder="Bank" />
          </SelectTrigger>

          <SelectContent>

            <SelectItem value="all">
              All Banks
            </SelectItem>

            {banks.map(b => (
              <SelectItem
                key={b.id}
                value={b.bank_name}
              >
                {b.bank_name}
              </SelectItem>
            ))}

          </SelectContent>

        </Select>

        <Select
          value={filterAssigned}
          onValueChange={setFilterAssigned}
        >

          <SelectTrigger className="w-36">
            <SelectValue placeholder="Assignment" />
          </SelectTrigger>

          <SelectContent>

            <SelectItem value="all">
              All
            </SelectItem>

            <SelectItem value="assigned">
              Assigned
            </SelectItem>

            <SelectItem value="unassigned">
              Unassigned
            </SelectItem>

          </SelectContent>

        </Select>

        <Button
          variant="outline"
          size="sm"
          onClick={selectAll}
        >
          Select All ({filtered.length})
        </Button>

      </div>

      {isLoading ? (

        <div className="flex justify-center py-16">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>

      ) : (

        <div className="overflow-x-auto">

          <table className="w-full text-sm">

            <thead>

              <tr className="border-b text-left text-muted-foreground text-xs">

                <th className="pb-2 pr-3 w-8" />

                <th className="pb-2 pr-4 font-medium">
                  Terminal ID
                </th>

                <th className="pb-2 pr-4 font-medium">
                  Branch / Location
                </th>

                <th className="pb-2 pr-4 font-medium">
                  Bank
                </th>

                <th className="pb-2 pr-4 font-medium">
                  Status
                </th>

                <th className="pb-2 font-medium">
                  Assigned Engineer
                </th>

              </tr>

            </thead>

            <tbody>

              {filtered.map(device => (

                <tr
                  key={device.id}
                  className={`border-b transition-colors hover:bg-muted/30 ${
                    selected.has(device.id)
                      ? 'bg-primary/5'
                      : ''
                  }`}
                >

                  <td className="py-2 pr-3">

                    <input
                      type="checkbox"
                      checked={selected.has(device.id)}
                      onChange={() =>
                        toggleSelect(device.id)
                      }
                      className="rounded"
                    />

                  </td>

                  <td className="py-2 pr-4 font-mono text-xs text-primary">
                    {device.terminal_id || '—'}
                  </td>

                  <td className="py-2 pr-4 font-medium max-w-[180px] truncate">
                    {device.branch_name || device.device_name}
                  </td>

                  <td className="py-2 pr-4">

                    <Badge
                      variant="outline"
                      className="text-[10px]"
                    >
                      {device.bank_name}
                    </Badge>

                  </td>

                  <td className="py-2 pr-4">

                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-full ${
                        device.device_status === 'Active'
                          ? 'bg-green-100 text-green-700'
                          : 'bg-red-100 text-red-700'
                      }`}
                    >
                      {device.device_status || 'Active'}
                    </span>

                  </td>

                  <td className="py-2">

                    <Select
                      value={device.assigned_engineer || ''}
                      onValueChange={v =>
                        assignSingle.mutate({
                          id: device.id,
                          engineer: v
                        })
                      }
                    >

                      <SelectTrigger className="h-7 text-xs w-48">
                        <SelectValue placeholder="Assign engineer..." />
                      </SelectTrigger>

                      <SelectContent>

                        {engineers.map(e => (
                          <SelectItem
                            key={e.id}
                            value={e.engineer_name}
                          >
                            {e.engineer_name}
                          </SelectItem>
                        ))}

                      </SelectContent>

                    </Select>

                  </td>

                </tr>
              ))}

            </tbody>

          </table>

        </div>
      )}

    </div>
  );
}