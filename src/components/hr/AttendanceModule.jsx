import React, { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabaseClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Card } from "@/components/ui/card";
import { Plus, Search } from "lucide-react";
import { format } from "date-fns";

const STATUS_COLOR = {
  Present: "bg-green-50 text-green-700",
  Absent: "bg-red-50 text-red-700",
  "Half Day": "bg-amber-50 text-amber-700",
  "On Leave": "bg-blue-50 text-blue-700",
  Holiday: "bg-purple-50 text-purple-700",
};

const PUNCT_COLOR = {
  "On Time": "bg-green-50 text-green-700",
  Late: "bg-amber-50 text-amber-700",
  "Very Late": "bg-red-50 text-red-700",
};

const COUNTRIES = [
  "Nigeria",
  "Ghana",
  "Cameroon",
  "Benin Republic",
  "Sierra Leone",
  "Liberia",
  "Ivory Coast",
  "Senegal",
  "Gambia",
  "Guinea",
  "Congo Brazzaville",
];

const EMPTY = {
  employee_name: "",
  staff_id: "",
  department: "",
  country: "Nigeria",
  date: format(new Date(), "yyyy-MM-dd"),
  time_in: "",
  time_out: "",
  punctuality_status: "On Time",
  attendance_status: "Present",
  notes: "",
};

export default function AttendanceModule({ attendance = [], employees = [], canManage }) {
  const qc = useQueryClient();

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [filterDate, setFilterDate] = useState("");
  const [filterCountry, setFilterCountry] = useState("all");
  const [filterDept, setFilterDept] = useState("all");

  const set = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const departments = [
    ...new Set(attendance.map((a) => a.department).filter(Boolean)),
  ];

  const getDate = (a) => a.date || a.attendance_date;
  const getTimeIn = (a) => a.time_in || a.check_in;
  const getTimeOut = (a) => a.time_out || a.check_out;
  const getStatus = (a) => a.attendance_status || a.status;

  const filtered = attendance.filter((a) => {
    const q = search.toLowerCase();

    const matchSearch =
      !q ||
      (a.employee_name || "").toLowerCase().includes(q) ||
      (a.staff_id || "").toLowerCase().includes(q);

    const matchDate = !filterDate || getDate(a) === filterDate;
    const matchCountry = filterCountry === "all" || a.country === filterCountry;
    const matchDept = filterDept === "all" || a.department === filterDept;

    return matchSearch && matchDate && matchCountry && matchDept;
  });

  const save = async () => {
    try {
      setSaving(true);

      const { error } = await supabase.from("hr_attendance").insert({
        employee_name: form.employee_name,
        staff_id: form.staff_id,
        department: form.department,
        country: form.country,
        attendance_date: form.date,
        check_in: form.time_in || null,
        check_out: form.time_out || null,
        punctuality_status: form.punctuality_status,
        status: form.attendance_status,
        notes: form.notes || "",
      });

      if (error) throw error;

      qc.invalidateQueries({ queryKey: ["hr-attendance"] });

      setForm(EMPTY);
      setOpen(false);
    } catch (err) {
      alert("Error saving attendance: " + (err?.message || "Unknown error"));
    } finally {
      setSaving(false);
    }
  };

  const todayStr = format(new Date(), "yyyy-MM-dd");

  const todayCount = attendance.filter((a) => getDate(a) === todayStr).length;

  const lateCount = attendance.filter(
    (a) =>
      getDate(a) === todayStr &&
      (a.punctuality_status === "Late" ||
        a.punctuality_status === "Very Late")
  ).length;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <Card className="p-3 text-center">
          <p className="text-xs text-muted-foreground">Today's Records</p>
          <p className="text-2xl font-bold">{todayCount}</p>
        </Card>

        <Card className="p-3 text-center border-amber-200">
          <p className="text-xs text-amber-700">Late Today</p>
          <p className="text-2xl font-bold text-amber-700">{lateCount}</p>
        </Card>

        <Card className="p-3 text-center">
          <p className="text-xs text-muted-foreground">Total Records</p>
          <p className="text-2xl font-bold">{attendance.length}</p>
        </Card>
      </div>

      <div className="flex flex-wrap gap-2 items-center justify-between">
        <div className="flex flex-wrap gap-2 flex-1">
          <div className="relative min-w-[180px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search name, ID…"
              className="pl-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <Input
            type="date"
            value={filterDate}
            onChange={(e) => setFilterDate(e.target.value)}
            className="w-36"
          />

          <Select value={filterCountry} onValueChange={setFilterCountry}>
            <SelectTrigger className="w-32">
              <SelectValue placeholder="Country" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Countries</SelectItem>
              {COUNTRIES.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={filterDept} onValueChange={setFilterDept}>
            <SelectTrigger className="w-32">
              <SelectValue placeholder="Dept" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Depts</SelectItem>
              {departments.map((d) => (
                <SelectItem key={d} value={d}>
                  {d}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {canManage && (
          <Button onClick={() => setOpen(true)}>
            <Plus className="w-4 h-4 mr-1" />
            Record Attendance
          </Button>
        )}
      </div>

      <div className="border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/30 border-b text-xs text-muted-foreground uppercase">
              <tr>
                <th className="text-left px-3 py-2.5">Employee</th>
                <th className="text-left px-3 py-2.5 hidden sm:table-cell">
                  Staff ID
                </th>
                <th className="text-left px-3 py-2.5">Date</th>
                <th className="text-left px-3 py-2.5 hidden md:table-cell">
                  Time In
                </th>
                <th className="text-left px-3 py-2.5 hidden md:table-cell">
                  Time Out
                </th>
                <th className="text-center px-3 py-2.5">Punctuality</th>
                <th className="text-center px-3 py-2.5">Status</th>
              </tr>
            </thead>

            <tbody className="divide-y">
              {filtered.length === 0 && (
                <tr>
                  <td
                    colSpan={7}
                    className="text-center py-8 text-muted-foreground text-sm"
                  >
                    No records found.
                  </td>
                </tr>
              )}

              {filtered.slice(0, 50).map((a) => {
                const attendanceStatus = getStatus(a);

                return (
                  <tr key={a.id} className="hover:bg-muted/20">
                    <td className="px-3 py-2.5 font-medium">
                      {a.employee_name}
                    </td>

                    <td className="px-3 py-2.5 font-mono text-xs text-muted-foreground hidden sm:table-cell">
                      {a.staff_id}
                    </td>

                    <td className="px-3 py-2.5 text-xs">
                      {getDate(a)}
                    </td>

                    <td className="px-3 py-2.5 text-xs hidden md:table-cell">
                      {getTimeIn(a) || "—"}
                    </td>

                    <td className="px-3 py-2.5 text-xs hidden md:table-cell">
                      {getTimeOut(a) || "—"}
                    </td>

                    <td className="px-3 py-2.5 text-center">
                      <Badge
                        variant="outline"
                        className={`text-[10px] ${
                          PUNCT_COLOR[a.punctuality_status] || ""
                        }`}
                      >
                        {a.punctuality_status}
                      </Badge>
                    </td>

                    <td className="px-3 py-2.5 text-center">
                      <Badge
                        variant="outline"
                        className={`text-[10px] ${
                          STATUS_COLOR[attendanceStatus] || ""
                        }`}
                      >
                        {attendanceStatus}
                      </Badge>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Record Attendance</DialogTitle>
          </DialogHeader>

          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Employee Name *</Label>
                <Input
                  value={form.employee_name}
                  onChange={(e) => set("employee_name", e.target.value)}
                  className="h-8 text-sm"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Staff ID</Label>
                <Input
                  value={form.staff_id}
                  onChange={(e) => set("staff_id", e.target.value)}
                  className="h-8 text-sm"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Department</Label>
                <Input
                  value={form.department}
                  onChange={(e) => set("department", e.target.value)}
                  className="h-8 text-sm"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Country</Label>
                <Select
                  value={form.country}
                  onValueChange={(v) => set("country", v)}
                >
                  <SelectTrigger className="h-8 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {COUNTRIES.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Date *</Label>
                <Input
                  type="date"
                  value={form.date}
                  onChange={(e) => set("date", e.target.value)}
                  className="h-8 text-sm"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Time In</Label>
                <Input
                  type="time"
                  value={form.time_in}
                  onChange={(e) => set("time_in", e.target.value)}
                  className="h-8 text-sm"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Time Out</Label>
                <Input
                  type="time"
                  value={form.time_out}
                  onChange={(e) => set("time_out", e.target.value)}
                  className="h-8 text-sm"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Status</Label>
                <Select
                  value={form.attendance_status}
                  onValueChange={(v) => set("attendance_status", v)}
                >
                  <SelectTrigger className="h-8 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {["Present", "Absent", "Half Day", "On Leave", "Holiday"].map(
                      (s) => (
                        <SelectItem key={s} value={s}>
                          {s}
                        </SelectItem>
                      )
                    )}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1 col-span-2">
                <Label className="text-xs">Punctuality</Label>
                <Select
                  value={form.punctuality_status}
                  onValueChange={(v) => set("punctuality_status", v)}
                >
                  <SelectTrigger className="h-8 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {["On Time", "Late", "Very Late"].map((s) => (
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Button
              className="w-full"
              onClick={save}
              disabled={!form.employee_name || saving}
            >
              {saving ? "Saving…" : "Record Attendance"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}