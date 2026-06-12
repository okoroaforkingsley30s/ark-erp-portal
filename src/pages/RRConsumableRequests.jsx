import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Search, Plus, CheckCircle, XCircle, PackageCheck } from "lucide-react";
import { toast } from "sonner";

const cardClass =
  "bg-[#102969]/90 border border-[#ff5a00]/20 text-white shadow-sm rounded-xl";

const inputClass =
  "bg-[#08153d]/80 border-[#ff5a00]/20 text-white placeholder:text-slate-400 focus-visible:ring-[#ff5a00]";

const selectClass =
  "rounded-md border border-[#ff5a00]/20 bg-[#08153d]/80 px-3 py-2 text-white outline-none focus:ring-2 focus:ring-[#ff5a00]";

const outlineButtonClass =
  "border-[#ff5a00]/30 text-white hover:bg-[#ff5a00]/10 hover:text-[#ff5a00]";

export default function RRConsumableRequests() {
  const [requests, setRequests] = useState([]);
  const [repairJobs, setRepairJobs] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  const [form, setForm] = useState({
    repair_job_id: "",
    item_name: "",
    quantity: 1,
    reason: "",
    requested_by: "",
  });

  const fetchData = async () => {
    setLoading(true);

    const { data: reqs, error: reqError } = await supabase
      .from("repair_consumable_requests")
      .select("*")
      .order("created_at", { ascending: false });

    const { data: jobs } = await supabase
      .from("repair_jobs")
      .select("id, job_number, item_name, device_name, status")
      .order("created_at", { ascending: false });

    if (reqError) {
      console.error(reqError);
      toast.error("Failed to load consumable requests");
    } else {
      setRequests(reqs || []);
      setRepairJobs(jobs || []);
    }

    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const createRequest = async () => {
    if (!form.item_name.trim()) {
      toast.error("Consumable item name is required");
      return;
    }

    const { error } = await supabase.from("repair_consumable_requests").insert({
      repair_job_id: form.repair_job_id || null,
      item_name: form.item_name,
      quantity: Number(form.quantity) || 1,
      reason: form.reason,
      requested_by: form.requested_by || "RR",
      status: "pending_hod",
      hod_status: "pending",
      inventory_status: "waiting_hod",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    if (error) {
      console.error(error);
      toast.error("Failed to create request");
      return;
    }

    toast.success("Consumable request sent to RR HOD");
    setForm({
      repair_job_id: "",
      item_name: "",
      quantity: 1,
      reason: "",
      requested_by: "",
    });
    fetchData();
  };

  const updateRequest = async (id, payload, message) => {
    const { error } = await supabase
      .from("repair_consumable_requests")
      .update({
        ...payload,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);

    if (error) {
      console.error(error);
      toast.error("Update failed");
      return;
    }

    toast.success(message);
    fetchData();
  };

  const filtered = useMemo(() => {
    if (!search.trim()) return requests;

    const q = search.toLowerCase();

    return requests.filter((item) =>
      [
        item.item_name,
        item.reason,
        item.status,
        item.hod_status,
        item.inventory_status,
        item.requested_by,
      ]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q))
    );
  }, [requests, search]);

  const counts = {
    pending: requests.filter((r) => r.status === "pending_hod").length,
    approved: requests.filter((r) => r.status === "pending_inventory").length,
    released: requests.filter((r) => r.status === "released").length,
    rejected: requests.filter((r) => r.status === "rejected_by_hod").length,
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#08153d] via-[#0b1f5e] to-[#102969] p-4 md:p-6 space-y-6 text-white">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-white">
          RR Consumable Requests
        </h1>
        <p className="text-sm text-slate-300 mt-1">
          RR requests consumables, HOD approves, Inventory releases.
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className={cardClass}>
          <CardContent className="p-4">
            <p className="text-xs text-slate-300">Pending HOD</p>
            <h2 className="text-3xl font-bold text-[#ff5a00]">{counts.pending}</h2>
          </CardContent>
        </Card>

        <Card className={cardClass}>
          <CardContent className="p-4">
            <p className="text-xs text-slate-300">Pending Inventory</p>
            <h2 className="text-3xl font-bold text-[#ff5a00]">{counts.approved}</h2>
          </CardContent>
        </Card>

        <Card className={cardClass}>
          <CardContent className="p-4">
            <p className="text-xs text-slate-300">Released</p>
            <h2 className="text-3xl font-bold text-[#ff5a00]">{counts.released}</h2>
          </CardContent>
        </Card>

        <Card className={cardClass}>
          <CardContent className="p-4">
            <p className="text-xs text-slate-300">Rejected</p>
            <h2 className="text-3xl font-bold text-[#ff5a00]">{counts.rejected}</h2>
          </CardContent>
        </Card>
      </div>

      <Card className={cardClass}>
        <CardHeader>
          <CardTitle className="text-white">New Consumable Request</CardTitle>
        </CardHeader>

        <CardContent className="grid md:grid-cols-2 gap-3">
          <select
            value={form.repair_job_id}
            onChange={(e) =>
              setForm((p) => ({ ...p, repair_job_id: e.target.value }))
            }
            className={selectClass}
          >
            <option className="bg-[#08153d] text-white" value="">
              Select Repair Job Optional
            </option>
            {repairJobs.map((job) => (
              <option className="bg-[#08153d] text-white" key={job.id} value={job.id}>
                {job.job_number} - {job.item_name || job.device_name}
              </option>
            ))}
          </select>

          <Input
            className={inputClass}
            placeholder="Consumable item name"
            value={form.item_name}
            onChange={(e) =>
              setForm((p) => ({ ...p, item_name: e.target.value }))
            }
          />

          <Input
            className={inputClass}
            type="number"
            placeholder="Quantity"
            value={form.quantity}
            onChange={(e) =>
              setForm((p) => ({ ...p, quantity: e.target.value }))
            }
          />

          <Input
            className={inputClass}
            placeholder="Requested by"
            value={form.requested_by}
            onChange={(e) =>
              setForm((p) => ({ ...p, requested_by: e.target.value }))
            }
          />

          <Textarea
            className={`md:col-span-2 min-h-[90px] ${inputClass}`}
            placeholder="Reason / purpose"
            value={form.reason}
            onChange={(e) =>
              setForm((p) => ({ ...p, reason: e.target.value }))
            }
          />

          <Button
            onClick={createRequest}
            className="md:col-span-2 bg-[#ff5a00] hover:bg-[#ff5a00]/90 text-white"
          >
            <Plus className="w-4 h-4 mr-2" />
            Submit To RR HOD
          </Button>
        </CardContent>
      </Card>

      <Card className={cardClass}>
        <CardHeader>
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <CardTitle className="text-white">Requests</CardTitle>

            <div className="relative w-full md:w-80">
              <Search className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
              <Input
                className={`pl-9 ${inputClass}`}
                placeholder="Search requests..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
        </CardHeader>

        <CardContent>
          {loading ? (
            <p className="text-sm text-slate-300">Loading...</p>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-slate-300">No request found.</p>
          ) : (
            <div className="space-y-3">
              {filtered.map((item) => (
                <div
                  key={item.id}
                  className="rounded-xl border border-[#ff5a00]/20 bg-[#08153d]/80 p-4 shadow-sm"
                >
                  <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
                    <div>
                      <h3 className="font-bold text-white">{item.item_name}</h3>

                      <p className="text-sm text-slate-300 mt-1">
                        Qty: {item.quantity} | Requested by:{" "}
                        {item.requested_by || "RR"}
                      </p>

                      <p className="text-sm mt-1 text-slate-200">
                        {item.reason || "No reason added"}
                      </p>

                      <p className="text-xs text-orange-300 mt-2">
                        Status: {item.status} | HOD: {item.hod_status} |
                        Inventory: {item.inventory_status}
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className={outlineButtonClass}
                        onClick={() =>
                          updateRequest(
                            item.id,
                            {
                              status: "pending_inventory",
                              hod_status: "approved",
                              inventory_status: "pending",
                            },
                            "Approved by RR HOD"
                          )
                        }
                      >
                        <CheckCircle className="w-4 h-4 mr-1" />
                        HOD Approve
                      </Button>

                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() =>
                          updateRequest(
                            item.id,
                            {
                              status: "rejected_by_hod",
                              hod_status: "rejected",
                            },
                            "Rejected by RR HOD"
                          )
                        }
                      >
                        <XCircle className="w-4 h-4 mr-1" />
                        Reject
                      </Button>

                      <Button
                        size="sm"
                        className="bg-[#ff5a00] hover:bg-[#ff5a00]/90 text-white"
                        onClick={() =>
                          updateRequest(
                            item.id,
                            {
                              status: "released",
                              inventory_status: "released",
                            },
                            "Released by Inventory"
                          )
                        }
                      >
                        <PackageCheck className="w-4 h-4 mr-1" />
                        Release
                      </Button>

                      <Button
                        size="sm"
                        variant="outline"
                        className={outlineButtonClass}
                        onClick={() =>
                          updateRequest(
                            item.id,
                            {
                              status: "out_of_stock",
                              inventory_status: "out_of_stock",
                            },
                            "Marked out of stock"
                          )
                        }
                      >
                        Out of Stock
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
