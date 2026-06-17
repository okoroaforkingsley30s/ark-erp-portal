import React, {
  useMemo,
  useState,
} from 'react';

import { useQuery } from '@tanstack/react-query';

import { supabase } from '@/lib/supabaseClient';

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

import { Badge } from '@/components/ui/badge';

import {
  User,
  Cpu,
  MapPin,
} from 'lucide-react';

const REGIONS = [
  {
    key: 'NORTH',
    label: 'North',
    color: 'bg-blue-500',
    light:
      'bg-blue-50 dark:bg-blue-950/20 border-blue-200',
  },

  {
    key: 'SE',
    label: 'South East',
    color: 'bg-green-500',
    light:
      'bg-green-50 dark:bg-green-950/20 border-green-200',
  },

  {
    key: 'SW',
    label: 'South West',
    color: 'bg-yellow-500',
    light:
      'bg-yellow-50 dark:bg-yellow-950/20 border-yellow-200',
  },

  {
    key: 'S/SOUTH',
    label: 'South South',
    color: 'bg-purple-500',
    light:
      'bg-purple-50 dark:bg-purple-950/20 border-purple-200',
  },
];

async function fetchEngineers() {
  const { data, error } =
    await supabase
      .from('engineers')
      .select('*')
      .order('engineer_name', {
        ascending: true,
      });

  if (error) throw error;

  return data || [];
}

async function fetchBankDevices() {
  const { data, error } =
    await supabase
      .from('bank_devices')
      .select('*')
      .order('created_at', {
        ascending: false,
      })
      .limit(2000);

  if (error) throw error;

  return data || [];
}

export default function RegionalCoverage() {
  const [
    activeRegion,
    setActiveRegion,
  ] = useState(null);

  const {
    data: engineers = [],
  } = useQuery({
    queryKey: ['engineers'],

    queryFn: fetchEngineers,
  });

  const {
    data: devices = [],
  } = useQuery({
    queryKey: [
      'bankDevices-full',
    ],

    queryFn: fetchBankDevices,
  });

  const regionData = useMemo(
    () =>
      REGIONS.map((r) => {
        const regionEngineers =
          engineers.filter(
            (e) =>
              e.region === r.key
          );

        const regionDevices =
          devices.filter((d) => {
            const eng =
              regionEngineers.find(
                (e) =>
                  e.engineer_name ===
                  d.assigned_engineer
              );

            return !!eng;
          });

        const active =
          regionDevices.filter(
            (d) =>
              d.device_status ===
              'Active'
          ).length;

        const faulty =
          regionDevices.filter(
            (d) =>
              d.device_status ===
              'Faulty'
          ).length;

        return {
          ...r,

          engineers:
            regionEngineers,

          deviceCount:
            regionDevices.length,

          active,

          faulty,
        };
      }),
    [engineers, devices]
  );

  const selected =
    activeRegion
      ? regionData.find(
          (r) =>
            r.key === activeRegion
        )
      : null;

  const selectedEngineers =
    selected
      ? selected.engineers
      : [];

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">
          Regional Coverage
        </h1>

        <p className="text-muted-foreground text-sm">
          Engineer deployment and
          device coverage by region
        </p>
      </div>

      {/* Region cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {regionData.map((r) => (
          <Card
            key={r.key}
            className={`cursor-pointer transition-all hover:shadow-lg ${
              activeRegion === r.key
                ? `${r.light} border-2`
                : ''
            }`}
            onClick={() =>
              setActiveRegion(
                activeRegion ===
                  r.key
                  ? null
                  : r.key
              )
            }
          >
            <div
              className={`h-2 ${r.color} rounded-t-xl`}
            />

            <CardContent className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-bold">
                  {r.label}
                </h3>

                <Badge
                  variant="outline"
                  className="text-[10px]"
                >
                  {r.key}
                </Badge>
              </div>

              <div className="grid grid-cols-3 gap-2 text-center">
                <div>
                  <p className="text-2xl font-bold text-[#ff5a00]">
                    {
                      r.engineers
                        .length
                    }
                  </p>

                  <p className="text-[10px] text-muted-foreground">
                    Engineers
                  </p>
                </div>

                <div>
                  <p className="text-2xl font-bold text-[#ff5a00]">
                    {
                      r.deviceCount
                    }
                  </p>

                  <p className="text-[10px] text-muted-foreground">
                    Devices
                  </p>
                </div>

                <div>
                  <p className="text-xl font-bold text-red-500">
                    {r.faulty}
                  </p>

                  <p className="text-[10px] text-muted-foreground">
                    Faulty
                  </p>
                </div>
              </div>

              {r.deviceCount >
                0 && (
                <div>
                  <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                    <div
                      className={`h-full ${r.color} rounded-full`}
                      style={{
                        width: `${
                          (r.active /
                            r.deviceCount) *
                          100
                        }%`,
                      }}
                    />
                  </div>

                  <p className="text-[10px] text-muted-foreground mt-1">
                    {r.active}{' '}
                    active /{' '}
                    {
                      r.deviceCount
                    }{' '}
                    total
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Engineer detail */}
      {selected && (
        <div>
          <h2 className="font-bold text-lg mb-4">
            {selected.label} —
            Engineers (
            {
              selectedEngineers.length
            }
            )
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {selectedEngineers.map(
              (eng) => {
                const engDevices =
                  devices.filter(
                    (d) =>
                      d.assigned_engineer ===
                      eng.engineer_name
                  );

                const active =
                  engDevices.filter(
                    (d) =>
                      d.device_status ===
                      'Active'
                  ).length;

                const banks = [
                  ...new Set(
                    engDevices
                      .map(
                        (d) =>
                          d.bank_name
                      )
                      .filter(Boolean)
                  ),
                ];

                return (
                  <Card
                    key={eng.id}
                  >
                    <CardContent className="p-4 space-y-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                          <User className="w-5 h-5 text-primary" />
                        </div>

                        <div>
                          <p className="font-semibold text-sm">
                            {
                              eng.engineer_name
                            }
                          </p>

                          <p className="text-xs text-muted-foreground flex items-center gap-1">
                            <MapPin className="w-3 h-3" />
                            {
                              eng.assigned_location
                            }
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-4 text-sm">
                        <span className="flex items-center gap-1 text-muted-foreground">
                          <Cpu className="w-3.5 h-3.5" />
                          {
                            engDevices.length
                          }{' '}
                          devices
                        </span>

                        <span className="text-green-600 font-medium">
                          {active}{' '}
                          active
                        </span>
                      </div>

                      {banks.length >
                        0 && (
                        <div className="flex flex-wrap gap-1">
                          {banks.map(
                            (b) => (
                              <Badge
                                key={b}
                                variant="outline"
                                className="text-[10px]"
                              >
                                {b}
                              </Badge>
                            )
                          )}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              }
            )}
          </div>
        </div>
      )}

      {/* All engineers table */}
      {!selected && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">
              All Engineers
              Coverage Summary
            </CardTitle>
          </CardHeader>

          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground text-xs">
                    <th className="pb-2 pr-4 font-medium">
                      Engineer
                    </th>

                    <th className="pb-2 pr-4 font-medium">
                      Region
                    </th>

                    <th className="pb-2 pr-4 font-medium">
                      Coverage Area
                    </th>

                    <th className="pb-2 pr-4 font-medium">
                      Devices
                    </th>

                    <th className="pb-2 font-medium">
                      Banks
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {engineers.map(
                    (eng) => {
                      const engDevices =
                        devices.filter(
                          (
                            d
                          ) =>
                            d.assigned_engineer ===
                            eng.engineer_name
                        );

                      const banks =
                        [
                          ...new Set(
                            engDevices
                              .map(
                                (
                                  d
                                ) =>
                                  d.bank_name
                              )
                              .filter(
                                Boolean
                              )
                          ),
                        ];

                      return (
                        <tr
                          key={
                            eng.id
                          }
                          className="border-b hover:bg-muted/30"
                        >
                          <td className="py-2 pr-4 font-medium">
                            {
                              eng.engineer_name
                            }
                          </td>

                          <td className="py-2 pr-4">
                            <Badge
                              variant="secondary"
                              className="text-[10px]"
                            >
                              {
                                eng.region
                              }
                            </Badge>
                          </td>

                          <td className="py-2 pr-4 text-xs text-muted-foreground max-w-[200px] truncate">
                            {
                              eng.assigned_location
                            }
                          </td>

                          <td className="py-2 pr-4">
                            <Badge variant="outline">
                              {
                                engDevices.length
                              }
                            </Badge>
                          </td>

                          <td className="py-2 flex flex-wrap gap-1">
                            {banks.map(
                              (
                                b
                              ) => (
                                <Badge
                                  key={
                                    b
                                  }
                                  variant="outline"
                                  className="text-[10px]"
                                >
                                  {b}
                                </Badge>
                              )
                            )}
                          </td>
                        </tr>
                      );
                    }
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}