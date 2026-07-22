import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useOutletContext } from "react-router-dom";
import { Search, ShieldCheck, AlertTriangle, CheckCircle2, Database, Package, Wrench, Ticket, Bell, Cpu, History, Printer, FileText } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { reportError } from "@/lib/errorReporting";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

const sectionConfig = [
  ["tickets", "Tickets", Ticket, "The service call and its present closure state."],
  ["part_requests", "Part Requests", Package, "Parts requested for the job and the department currently responsible."],
  ["repair_jobs", "RR Repair Jobs", Wrench, "Diagnosis, technician assignment, QA and return-to-stock progress."],
  ["consumable_requests", "RR Consumable Requests", Package, "Materials requested by RR and their approval/release position."],
  ["fund_requests", "Fund Requests", Database, "Funding approval and disbursement position."],
  ["inventory_movements", "Inventory Movements", Package, "Every matching stock increase, deduction or transfer."],
  ["assets", "ARK Assets", Cpu, "ARK-owned or ARK-supplied assets, custodians, locations and status."],
  ["customer_machines", "Customer Machines / Devices", Cpu, "Customer bank equipment supported by ARK; shown separately from ARK assets."],
  ["events", "Operational Timeline", History, "System-recorded actions in date order."],
  ["lifecycle", "Part Lifecycle", History, "Movement of the physical part between people and departments."],
  ["asset_audit", "Asset Audit History", History, "Recorded changes made to the asset register."],
  ["notifications", "Notification Delivery", Bell, "In-app and major-email notifications generated for the workflow."],
];

function firstValue(row, keys) {
  for (const key of keys) if (row?.[key] !== null && row?.[key] !== undefined && row?.[key] !== "") return row[key];
  return "—";
}

function referenceFor(row) {
  return firstValue(row, ["ticket_number", "job_number", "asset_code", "part_number", "terminal_id", "request_number", "id"]);
}

function titleFor(row) {
  return firstValue(row, ["title", "asset_name", "item_name", "part_name", "device_name", "machine_name", "purpose", "event_type", "movement_type"]);
}

function statusFor(row) {
  return firstValue(row, ["status", "completion_status", "inventory_status", "finance_status", "device_status", "action"]);
}

function dateFor(row) {
  return firstValue(row, ["updated_at", "created_at", "received_at", "changed_at", "purchase_date"]);
}

function humanize(value) {
  if (value === null || value === undefined || value === "") return "Not recorded";
  return String(value).replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatDate(value) {
  if (!value || value === "—") return "Not recorded";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? String(value) : parsed.toLocaleString();
}

function responsibilityFor(row) {
  const status = String(statusFor(row)).toLowerCase();
  if (row.current_department) return humanize(row.current_department);
  if (["pending_rr", "received", "assigned", "refurbishing", "under_repair", "testing", "qa_failed"].includes(status)) return "Repair & Refurbishment";
  if (["sent_to_inventory", "returned_inventory"].includes(status) && row.stock_intake_status !== "received") return "Inventory";
  if (["pending_inventory", "waiting_inventory"].includes(status)) return "Inventory";
  if (status.includes("finance") || status.includes("account") || status.includes("disbur")) return "Finance & Accounts";
  if (["closed", "approved", "completed", "inventory_received", "disposed", "retired"].includes(status)) return "No further operational action";
  return humanize(firstValue(row, ["department", "assigned_department", "source_module"]));
}

function nextActionFor(row) {
  const status = String(statusFor(row)).toLowerCase();
  if (status === "pending_rr") return "RR HOD should receive the job.";
  if (status === "received") return "RR HOD should assign an RR technician.";
  if (status === "assigned") return "The assigned RR technician should start the work.";
  if (["refurbishing", "under_repair"].includes(status)) return "The assigned technician should complete the repair or submit it for QA.";
  if (["testing", "waiting_qa"].includes(status)) return "RR HOD should review the submitted work and pass or reject QA.";
  if (status === "qa_failed") return "The assigned technician should correct the work and resubmit for QA.";
  if (["sent_to_inventory", "returned_inventory"].includes(status) && row.stock_intake_status !== "received") return "Inventory should receive the QA-passed quantity into stock.";
  if (status === "pending_hod") return "The department HOD should approve or reject the request.";
  if (status === "pending_inventory") return "Inventory should release, reject or mark the requested item out of stock.";
  if (status.includes("pending") && row.finance_status) return "The next configured approver should review the funding request.";
  if (["closed", "approved", "completed", "inventory_received", "released", "disbursed"].includes(status)) return "No further action is required unless the record is disputed.";
  if (row.asset_code && status === "assigned" && !row.assigned_employee_name) return "Asset Control should identify and record the current custodian.";
  if (row.asset_code && !row.current_location) return "Asset Control should confirm and record the current location.";
  return "Review the detailed timeline and findings below to identify the responsible user.";
}

function actionForFinding(finding) {
  const message = String(finding?.message || "").toLowerCase();
  if (message.includes("no assigned technician")) return "RR HOD should assign a valid RR technician before work continues.";
  if (message.includes("stock intake")) return "Inventory should open Awaiting Stock Intake and receive the QA-passed quantity.";
  if (message.includes("completion approval")) return "Helpdesk should verify the completion review and final closure records.";
  if (message.includes("no custodian")) return "Asset Control should identify the person holding the asset and update the custodian.";
  if (message.includes("no current location")) return "Asset Control should physically verify and record the asset location.";
  if (message.includes("warranty has expired")) return "Asset Control should review maintenance cover and replacement planning.";
  if (message.includes("status/disposal")) return "Finance and Asset Control should verify the disposal or loss documentation.";
  return "The responsible department should verify this finding and report the corrective action to the System Administrator.";
}

function importantDetails(row, asset) {
  if (asset) return [
    ["Custodian", firstValue(row, ["assigned_employee_name", "assigned_engineer_name", "assigned_engineer"])],
    ["Department", firstValue(row, ["assigned_department", "department"])],
    ["Location", firstValue(row, ["current_location", "location", "branch_name", "branch"])],
    ["Serial Number", firstValue(row, ["serial_number", "terminal_id", "atm_terminal_id"])],
    ["Warranty Expiry", firstValue(row, ["warranty_expiry"])],
  ];
  return [
    ["Responsible Department", responsibilityFor(row)],
    ["Assigned To", firstValue(row, ["assigned_to_name", "assigned_engineer_email", "assigned_to", "assigned_rr_technician"])],
    ["Quantity", firstValue(row, ["quantity", "quantity_received", "quantity_changed"])],
    ["Last Updated", formatDate(dateFor(row))],
  ];
}

function DiagnosticRow({ row, asset = false }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="rounded-lg border border-white/10 bg-[#08153d]/70 p-3 text-white">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-semibold text-orange-200">{referenceFor(row)}</p>
          <p className="text-sm text-white">{titleFor(row)}</p>
          <p className="mt-1 text-xs text-blue-100">Current responsibility: {responsibilityFor(row)}</p>
        </div>
        <div className="text-right">
          <Badge className="bg-blue-500/15 text-blue-100 border-blue-400/30">{String(statusFor(row))}</Badge>
          <p className="mt-1 text-[11px] text-blue-100/70">{formatDate(dateFor(row))}</p>
        </div>
      </div>
      <dl className="mt-3 grid gap-2 text-xs sm:grid-cols-2">
        {importantDetails(row, asset).map(([label, value]) => (
          <div key={label}><dt className="text-blue-100/70">{label}</dt><dd className="font-medium text-white">{String(value)}</dd></div>
        ))}
      </dl>
      <div className="mt-3 rounded border border-orange-300/20 bg-orange-500/10 p-2 text-xs">
        <strong>Next action:</strong> {nextActionFor(row)}
      </div>
      <Button size="sm" variant="ghost" className="no-print mt-2 h-7 text-xs text-orange-200 hover:text-orange-100" onClick={() => setExpanded((value) => !value)}>
        {expanded ? "Hide record" : "Inspect record"}
      </Button>
      {expanded && <pre className="no-print mt-2 max-h-80 overflow-auto whitespace-pre-wrap rounded bg-black/30 p-3 text-[11px] text-blue-100">{JSON.stringify(row, null, 2)}</pre>}
    </div>
  );
}

export default function AdminDiagnostics() {
  const outlet = useOutletContext() || {};
  const admin = outlet.user || outlet.profile || outlet.currentUser || null;
  const [search, setSearch] = useState("");
  const [requestedBy, setRequestedBy] = useState("");
  const [reportedIssue, setReportedIssue] = useState("");
  const [result, setResult] = useState(null);
  const mailHealth = useQuery({
    queryKey: ["admin-notification-email-health"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("ark_notification_email_delivery_health");
      if (error) throw error;
      return data;
    },
    retry: false,
  });
  const installMailSchedule = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc("ark_install_notification_email_schedule");
      if (error) throw error;
      return data;
    },
    onSuccess: () => mailHealth.refetch(),
    onError: (error) => reportError(error, {
      context: "admin.notification_email.install_schedule",
      userMessage: "Notification email schedule could not be installed.",
    }),
  });
  const diagnostics = useMutation({
    mutationFn: async (value) => {
      const { data, error } = await supabase.rpc("ark_admin_diagnose", { p_search: value.trim() });
      if (error) throw error;
      return data;
    },
    onSuccess: setResult,
    onError: (error) => reportError(error, { context: "admin.diagnostics.search", userMessage: "Diagnostics search failed." }),
  });

  const totalMatches = useMemo(() => result?.summary
    ? Object.entries(result.summary).filter(([key]) => key !== "findings").reduce((sum, [, value]) => sum + Number(value || 0), 0)
    : 0, [result]);

  const primaryRecord = useMemo(() => {
    if (!result) return null;
    return result.tickets?.[0] || result.repair_jobs?.[0] || result.part_requests?.[0] ||
      result.assets?.[0] || result.customer_machines?.[0] || result.consumable_requests?.[0] || result.fund_requests?.[0] || null;
  }, [result]);

  const reportStatus = !result
    ? "Not generated"
    : totalMatches === 0
    ? "No matching record"
    : (result.findings || []).some((finding) => finding.severity === "high")
    ? "Attention required"
    : (result.findings || []).length > 0
    ? "Review required"
    : "No configured blocker detected";

  const runSearch = () => {
    if (search.trim().length < 3) return alert("Enter at least 3 characters from a ticket, job, request, part, asset or serial number.");
    diagnostics.mutate(search);
  };

  return (
    <div className="min-h-screen space-y-5 bg-[#0b1f5e] p-4 text-white">
      <style>{`
        .print-only { display: none; }
        @media print {
          @page { size: A4; margin: 12mm; }
          body { background: white !important; color: #102969 !important; }
          body * { visibility: hidden; }
          #diagnostic-print-area, #diagnostic-print-area * { visibility: visible; }
          #diagnostic-print-area { position: absolute; inset: 0; width: 100%; background: white !important; color: #102969 !important; }
          #diagnostic-print-area .print-card { background: white !important; color: #102969 !important; border: 1px solid #cbd5e1 !important; box-shadow: none !important; break-inside: avoid; }
          #diagnostic-print-area .text-white, #diagnostic-print-area .text-blue-100 { color: #102969 !important; }
          #diagnostic-print-area .bg-\[\#08153d\]\/70, #diagnostic-print-area .bg-\[\#102969\] { background: white !important; }
          #diagnostic-print-area pre, .no-print { display: none !important; }
          .print-only { display: block !important; }
        }
      `}</style>
      <Card className="no-print border-orange-400/30 bg-[#102969] text-white">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-2xl"><ShieldCheck className="text-[#ff5a00]" /> ERP Administrator Diagnostics</CardTitle>
          <p className="text-sm text-blue-100">Read-only workflow and asset trace. No record can be changed from this tool.</p>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-2 md:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-3 h-4 w-4 text-blue-200" />
              <Input className="border-white/20 bg-[#08153d] pl-9 text-white" placeholder="Ticket, RR job, request ID, part number, asset code, serial or employee…"
                value={search} onChange={(event) => setSearch(event.target.value)} onKeyDown={(event) => event.key === "Enter" && runSearch()} />
            </div>
            <Button className="bg-[#ff5a00] hover:bg-[#e24f00]" disabled={diagnostics.isPending} onClick={runSearch}>
              {diagnostics.isPending ? "Tracing…" : "Run Diagnostics"}
            </Button>
          </div>
          <p className="mt-2 text-xs text-blue-100/70">Examples: TCK-20260720-3541, RR-20260721-2087, asset code, serial number or staff email.</p>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <div><label className="text-xs text-blue-100">Requested by / complaint owner</label><Input className="mt-1 border-white/20 bg-[#08153d] text-white" placeholder="Name, department or email" value={requestedBy} onChange={(event) => setRequestedBy(event.target.value)} /></div>
            <div><label className="text-xs text-blue-100">Issue reported</label><Input className="mt-1 border-white/20 bg-[#08153d] text-white" placeholder="What did the user report?" value={reportedIssue} onChange={(event) => setReportedIssue(event.target.value)} /></div>
          </div>
        </CardContent>
      </Card>

      <Card className="no-print border-white/10 bg-[#102969] text-white">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Bell className="text-[#ff5a00]" /> Notification Email Delivery</CardTitle>
          <p className="text-sm text-blue-100">Checks the one-minute email worker and its queued, retry, failed and sent records.</p>
        </CardHeader>
        <CardContent>
          {mailHealth.isLoading ? <p className="text-sm text-blue-100">Checking delivery service…</p> : mailHealth.isError ? (
            <p className="text-sm text-red-200">Delivery health is unavailable until the mail-reliability migration is applied.</p>
          ) : (
            <>
              <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
                <div><p className="text-xs text-blue-100/70">Configuration</p><p className="font-semibold">{mailHealth.data?.configuration_ready ? "Ready" : "Missing Vault setup"}</p></div>
                <div><p className="text-xs text-blue-100/70">Schedule</p><p className="font-semibold">{mailHealth.data?.schedule_installed ? "Active" : "Not installed"}</p></div>
                <div><p className="text-xs text-blue-100/70">Queued</p><p className="font-semibold">{mailHealth.data?.queued || 0}</p></div>
                <div><p className="text-xs text-blue-100/70">Retrying</p><p className="font-semibold">{mailHealth.data?.retrying || 0}</p></div>
                <div><p className="text-xs text-blue-100/70">Failed</p><p className="font-semibold text-orange-300">{mailHealth.data?.failed || 0}</p></div>
                <div><p className="text-xs text-blue-100/70">Sent</p><p className="font-semibold text-emerald-300">{mailHealth.data?.sent || 0}</p></div>
              </div>
              {!mailHealth.data?.schedule_installed && (
                <Button
                  className="mt-4 bg-[#ff5a00] hover:bg-[#e24f00]"
                  disabled={!mailHealth.data?.configuration_ready || installMailSchedule.isPending}
                  onClick={() => installMailSchedule.mutate()}
                >
                  {installMailSchedule.isPending ? "Installing…" : "Install / Repair Email Schedule"}
                </Button>
              )}
              {!mailHealth.data?.configuration_ready && (
                <p className="mt-3 text-xs text-amber-200">System Administration must configure the two protected Vault entries described in the mail deployment guide.</p>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {result && (
        <div id="diagnostic-print-area" className="space-y-5">
          <div className="print-card flex flex-col gap-3 rounded-xl border border-orange-400/30 bg-[#102969] p-5 text-white sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3"><img src="/logo.png" alt="ARK ONE" className="h-12 w-12 object-contain" /><div><h1 className="text-2xl font-bold">ARK ONE Diagnostic Report</h1><p className="text-sm text-blue-100">Workflow, inventory and asset tracking assessment</p></div></div>
            <Button className="no-print bg-white text-[#102969] hover:bg-blue-50" onClick={() => window.print()}><Printer className="mr-2 h-4 w-4" /> Print / Save PDF</Button>
          </div>

          <Card className="print-card border-white/10 bg-[#102969] text-white">
            <CardHeader><CardTitle className="flex items-center gap-2"><FileText className="text-[#ff5a00]" /> Report Information</CardTitle></CardHeader>
            <CardContent className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
              <div><p className="text-xs text-blue-100/70">Search reference</p><p className="font-semibold">{result.search}</p></div>
              <div><p className="text-xs text-blue-100/70">Requested by</p><p className="font-semibold">{requestedBy || "Not supplied"}</p></div>
              <div><p className="text-xs text-blue-100/70">Issue reported</p><p className="font-semibold">{reportedIssue || "Not supplied"}</p></div>
              <div><p className="text-xs text-blue-100/70">Prepared by</p><p className="font-semibold">{admin?.full_name || admin?.name || admin?.email || admin?.user_email || "System Administrator"}</p></div>
              <div><p className="text-xs text-blue-100/70">Generated</p><p className="font-semibold">{formatDate(result.generated_at)}</p></div>
              <div><p className="text-xs text-blue-100/70">Report status</p><p className="font-semibold text-orange-300">{reportStatus}</p></div>
            </CardContent>
          </Card>

          <Card className="print-card border-white/10 bg-[#102969] text-white">
            <CardHeader><CardTitle>Plain-language conclusion</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              {totalMatches === 0 ? <p>No ERP record matched <strong>{result.search}</strong>. Confirm the reference and search again.</p> : (
                <>
                  <p>The system found <strong>{totalMatches}</strong> related record(s). The main reference is <strong>{primaryRecord ? referenceFor(primaryRecord) : result.search}</strong>.</p>
                  <p><strong>Current status:</strong> {primaryRecord ? humanize(statusFor(primaryRecord)) : "See the detailed records below"}.</p>
                  <p><strong>Current responsibility:</strong> {primaryRecord ? responsibilityFor(primaryRecord) : "Not determined"}.</p>
                  <p><strong>Recommended next action:</strong> {primaryRecord ? nextActionFor(primaryRecord) : "Review the findings and timeline below."}</p>
                </>
              )}
            </CardContent>
          </Card>

          <div className="grid gap-3 sm:grid-cols-3">
            <Card className="print-card border-white/10 bg-[#102969] p-4 text-white"><p className="text-xs text-blue-100">Records found</p><p className="text-3xl font-bold">{totalMatches}</p></Card>
            <Card className="print-card border-white/10 bg-[#102969] p-4 text-white"><p className="text-xs text-blue-100">Diagnostic findings</p><p className="text-3xl font-bold text-orange-300">{result.summary?.findings || 0}</p></Card>
            <Card className="print-card border-white/10 bg-[#102969] p-4 text-white"><p className="text-xs text-blue-100">Mode</p><p className="mt-1 flex items-center gap-2 font-bold text-emerald-300"><CheckCircle2 className="h-5 w-5" /> READ ONLY</p></Card>
          </div>

          <Card className="print-card border-white/10 bg-[#102969] text-white">
            <CardHeader><CardTitle className="flex items-center gap-2"><AlertTriangle className="text-orange-300" /> Findings and blockers</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {(result.findings || []).length === 0 ? <p className="text-emerald-300">No configured inconsistency was detected in the matching records.</p> :
                result.findings.map((finding, index) => (
                  <div key={`${finding.entity_id}-${index}`} className={`rounded-lg border p-3 ${finding.severity === "high" ? "border-red-400/40 bg-red-500/10" : "border-amber-400/40 bg-amber-500/10"}`}>
                    <p className="font-semibold">{finding.reference || finding.entity_id}</p><p className="text-sm">{finding.message}</p><p className="mt-1 text-xs"><strong>Required response:</strong> {actionForFinding(finding)}</p>
                  </div>
                ))}
            </CardContent>
          </Card>

          {sectionConfig.map(([key, label, Icon, explanation]) => {
            const rows = result[key] || [];
            if (!rows.length) return null;
            return (
              <Card key={key} className="print-card border-white/10 bg-[#102969] text-white">
                <CardHeader><CardTitle className="flex items-center gap-2"><Icon className="h-5 w-5 text-[#ff5a00]" /> {label} ({rows.length})</CardTitle><p className="text-sm text-blue-100">{explanation}</p></CardHeader>
                <CardContent className="grid gap-3 lg:grid-cols-2">
                  {rows.map((row, index) => <DiagnosticRow key={row.id || index} row={row} asset={key === "assets" || key === "customer_machines"} />)}
                </CardContent>
              </Card>
            );
          })}
          <div className="print-only mt-8 border-t border-slate-300 pt-4 text-xs text-slate-600">
            <p>This report is a read-only snapshot generated from ARK ONE ERP. It does not modify any operational or financial record.</p>
            <div className="mt-8 grid grid-cols-2 gap-16"><div className="border-t border-slate-500 pt-1">Prepared by / System Administrator</div><div className="border-t border-slate-500 pt-1">Acknowledged by / Requesting User</div></div>
          </div>
        </div>
      )}
    </div>
  );
}
