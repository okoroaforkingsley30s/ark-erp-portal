import { useEffect, useMemo, useState } from "react";
import { useOutletContext, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

import {
  Search,
  Plus,
  PackagePlus,
  Trash2,
  Loader2,
  Wrench,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { useFormDraft } from "@/hooks/useFormDraft";

const cardClass =
  "bg-[#102969]/90 border border-[#ff5a00]/20 text-white shadow-sm rounded-xl";

const inputClass =
  "bg-[#08153d]/80 border-[#ff5a00]/20 text-white placeholder:text-slate-400 focus-visible:ring-[#ff5a00]";

const outlineButtonClass =
  "border-[#ff5a00]/30 text-white hover:bg-[#ff5a00]/10 hover:text-[#ff5a00]";

const emptyItem = {
  spare_part_id: "",
  item_name: "",
  part_number: "",
  available_stock: 0,
  quantity: 1,
  reason: "",
};

function normalize(value) {
  return String(value || "").toLowerCase().trim();
}

function isRRHod(user) {
  const role = normalize(user?.role || user?.user_role || user?.position);
  const department = normalize(user?.department);
  const email = normalize(user?.email || user?.user_email);

  return (
    role.includes("admin") ||
    role.includes("hod") ||
    role.includes("head") ||
    role.includes("rr_hod") ||
    role.includes("repair_head") ||
    department.includes("management") ||
    email.includes("admin")
  );
}

function isInventoryUser(user) {
  const role = normalize(user?.role || user?.user_role || user?.position);
  return ["system_admin", "inventory", "inventory_head", "inventory_manager"].includes(role);
}

function isRRUser(user) {
  const role = normalize(user?.role || user?.user_role || user?.position);
  return [
    "system_admin", "repair_head", "rr_hod", "repair_hod", "head_of_rr",
    "repair_technician", "rr_technician", "rr_tech",
  ].includes(role);
}

function getJobTitle(job) {
  return (
    job?.item_name ||
    job?.device_name ||
    job?.part_name ||
    job?.part_type ||
    "R/R Item"
  );
}

function isSupportEligibleJob(job) {
  return ["refurbishing", "under_repair", "qa_failed"].includes(normalize(job?.status));
}

function getStockQty(part) {
  return Number(
    part?.quantity_available ??
      part?.quantity ??
      part?.current_stock ??
      part?.stock_quantity ??
      part?.available_quantity ??
      0
  );
}

function getPartDisplayName(part) {
  return (
    part?.part_name ||
    part?.item_name ||
    part?.name ||
    part?.description ||
    "Consumable"
  );
}

export default function RRConsumableRequests() {
  const outlet = useOutletContext() || {};
  const user = outlet.user || outlet.profile || outlet.currentUser || null;

  const [searchParams] = useSearchParams();
  const jobId = searchParams.get("job_id") || searchParams.get("job");

  const [requests, setRequests] = useState([]);
  const [repairJobs, setRepairJobs] = useState([]);
  const [spareParts, setSpareParts] = useState([]);
  const [selectedJob, setSelectedJob] = useState(null);

  const [search, setSearch] = useState("");
  const [stockSearch, setStockSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [profileName, setProfileName] = useState("");
  const [profileId, setProfileId] = useState(null);
  const [profileResolved, setProfileResolved] = useState(false);

  const [items, setItems] = useState([{ ...emptyItem }]);
  const [notes, setNotes] = useState("");

  const userEmail = user?.email || user?.user_email || "";
  const userIsRRHod = isRRHod(user);
  const userIsInventory = isInventoryUser(user);
  const userIsRR = isRRUser(user);

  const consumableDraft = useMemo(() => ({
    selectedJob,
    items,
    notes,
  }), [selectedJob, items, notes]);

  const restoreConsumableDraft = (draft) => {
    setSelectedJob(draft?.selectedJob || null);
    setItems(Array.isArray(draft?.items) && draft.items.length ? draft.items : [{ ...emptyItem }]);
    setNotes(draft?.notes || "");
  };

  useFormDraft({
    key: `rr-consumable-request:${jobId || 'new'}`,
    form: consumableDraft,
    setForm: restoreConsumableDraft,
    userId: user?.id || userEmail,
    storage: 'session',
    maxAgeMs: 8 * 60 * 60 * 1000,
  });

  useEffect(() => {
    const loadProfile = async () => {
      setProfileResolved(false);
      if (!userEmail) {
        setProfileName(userEmail || "RR Technician");
        setProfileResolved(true);
        return;
      }

      const { data, error } = await supabase
        .from("user_profiles")
        .select("id, user_email, role, department")
        .eq("user_email", userEmail)
        .maybeSingle();

      if (error) {
        console.error(error);
        setProfileName(userEmail || "RR Technician");
        setProfileResolved(true);
        return;
      }

      setProfileId(data?.id || null);
      setProfileName(data?.user_email || userEmail || "RR Technician");
      setProfileResolved(true);
    };

    loadProfile();
  }, [userEmail, user?.id]);

  const fetchData = async () => {
    setLoading(true);

    const [reqResult, jobsResult, partsResult] = await Promise.all([
      supabase
        .from("rr_consumable_requests")
        .select("*")
        .order("created_at", { ascending: false }),

      supabase
        .from("repair_jobs")
        .select("*")
        .order("created_at", { ascending: false }),

      supabase
        .from("spare_parts")
        .select("*")
        .order("part_name", { ascending: true }),
    ]);

    if (reqResult.error) {
      console.error(reqResult.error);
      toast.error("Failed to load RR consumable requests");
    } else {
      setRequests(reqResult.data || []);
    }

    if (jobsResult.error) {
      console.error(jobsResult.error);
      toast.error("Failed to load repair jobs");
    } else {
      const jobs = (jobsResult.data || []).filter((job) =>
        isSupportEligibleJob(job) && (
          userIsRRHod ||
          String(job.assigned_rr_technician || "") === String(profileId || "") ||
          String(job.assigned_to || "") === String(profileId || "")
        )
      );
      setRepairJobs(jobs);

      if (jobId) {
        const found = jobs.find((job) => String(job.id) === String(jobId));
        if (found) setSelectedJob(found);
        else {
          setSelectedJob(null);
          toast.error("That repair job is already completed or is not currently eligible for a consumable request.");
        }
      }
    }

    if (partsResult.error) {
      console.error(partsResult.error);
      toast.error("Failed to load inventory stock");
    } else {
      setSpareParts(partsResult.data || []);
    }

    setLoading(false);
  };

  useEffect(() => {
    if (!profileResolved) return;
    fetchData();
  }, [jobId, profileId, profileResolved]);

  const filteredStock = useMemo(() => {
    const q = stockSearch.toLowerCase().trim();

    if (!q) return spareParts.slice(0, 20);

    return spareParts
      .filter((part) =>
        [
          part.part_name,
          part.item_name,
          part.name,
          part.part_number,
          part.category,
          part.description,
        ]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(q))
      )
      .slice(0, 20);
  }, [spareParts, stockSearch]);

  const selectJob = (jobIdValue) => {
    const job = repairJobs.find((item) => String(item.id) === String(jobIdValue));
    setSelectedJob(job || null);
  };

  const updateItem = (index, field, value) => {
    setItems((prev) => {
      const next = [...prev];
      next[index] = {
        ...next[index],
        [field]: value,
      };
      return next;
    });
  };

  const selectStockItem = (index, sparePartId) => {
    const part = spareParts.find((item) => String(item.id) === String(sparePartId));

    if (!part) return;

    setItems((prev) => {
      const next = [...prev];
      next[index] = {
        ...next[index],
        spare_part_id: part.id,
        item_name: getPartDisplayName(part),
        part_number: part.part_number || "",
        available_stock: getStockQty(part),
      };
      return next;
    });
  };

  const addItem = () => {
    setItems((prev) => [...prev, { ...emptyItem }]);
  };

  const removeItem = (index) => {
    setItems((prev) => {
      if (prev.length === 1) return prev;
      return prev.filter((_, i) => i !== index);
    });
  };

  const cleanItems = useMemo(() => {
    return items
      .filter((item) => item.spare_part_id && Number(item.quantity) > 0)
      .map((item) => ({
        spare_part_id: item.spare_part_id,
        item_name: item.item_name,
        part_number: item.part_number || "",
        available_stock: Number(item.available_stock) || 0,
        quantity: Number(item.quantity) || 1,
        reason: item.reason || "",
      }));
  }, [items]);

  const createRequest = async () => {
    if (!selectedJob) {
      toast.error("Select a repair job first");
      return;
    }

    if (cleanItems.length === 0) {
      toast.error("Add at least one consumable item from inventory");
      return;
    }

    setSubmitting(true);
    try {
      const { data, error } = await supabase.rpc("rr_create_consumable_request_v2", {
        p_repair_job_id: selectedJob.id,
        p_items: cleanItems,
        p_notes: notes || null,
      });
      if (error) throw error;

      toast.success(
        data?.created === false
          ? "The active consumable request already exists."
          : "Consumable request submitted to RR HOD"
      );
      setItems([{ ...emptyItem }]);
      setNotes("");
      fetchData();
    } catch (error) {
      console.error(error);
      toast.error(error.message || "Failed to create consumable request");
    } finally {
      setSubmitting(false);
    }
  };

  const transitionRequest = async (id, action, message) => {
    const { error } = await supabase.rpc("rr_transition_consumable_request", {
      p_request_id: id,
      p_action: action,
      p_note: null,
    });

    if (error) {
      console.error(error);
      toast.error("Update failed");
      return;
    }

    toast.success(message);
    fetchData();
  };

  const approveToInventory = async (request) => {
    if (!userIsRRHod) {
      toast.error("Only RR HOD/Admin can approve consumables to Inventory");
      return;
    }

    await transitionRequest(request.id, "hod_approve", "Approved by RR HOD and sent to Inventory");
  };

  const rejectByHod = async (request) => {
    if (!userIsRRHod) {
      toast.error("Only RR HOD/Admin can reject this request");
      return;
    }

    await transitionRequest(request.id, "hod_reject", "Request rejected by RR HOD");
  };

  const releaseFromInventory = async (request) => {
    if (!userIsInventory) return toast.error("Only Inventory can release consumables");
    await transitionRequest(request.id, "inventory_release", "Consumables released to RR");
  };

  const rejectByInventory = async (request) => {
    if (!userIsInventory) return toast.error("Only Inventory can reject this request");
    await transitionRequest(request.id, "inventory_reject", "Request returned by Inventory");
  };

  const confirmUsed = async (request) => {
    if (!userIsRR) return toast.error("Only RR can confirm use");
    await transitionRequest(request.id, "confirm_used", "Consumables attached to repair job and marked used");
  };

  const filtered = useMemo(() => {
    if (!search.trim()) return requests;

    const q = search.toLowerCase();

    return requests.filter((request) =>
      [
        request.job_number,
        request.failed_part,
        request.status,
        request.notes,
        request.item_name,
        request.reason,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(q))
    );
  }, [requests, search]);

  const counts = {
    pendingHod: requests.filter((r) => r.status === "pending_hod").length,
    pendingInventory: requests.filter((r) => r.status === "pending_inventory").length,
    released: requests.filter((r) => r.status === "released").length,
    rejected: requests.filter(
      (r) => ["rejected", "rejected_by_hod", "rejected_by_inventory"].includes(r.status)
    ).length,
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#08153d] via-[#0b1f5e] to-[#102969] p-4 md:p-6 space-y-6 text-white">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-white flex items-center gap-2">
          <PackagePlus className="w-7 h-7 text-[#ff5a00]" />
          RR Consumable Requests
        </h1>
        <p className="text-sm text-slate-300 mt-1">
          RR Technician submits consumable requests to RR HOD. RR HOD approves before Inventory releases.
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className={cardClass}>
          <CardContent className="p-4">
            <p className="text-xs text-slate-300">Pending RR HOD</p>
            <h2 className="text-3xl font-bold text-[#ff5a00]">{counts.pendingHod}</h2>
          </CardContent>
        </Card>

        <Card className={cardClass}>
          <CardContent className="p-4">
            <p className="text-xs text-slate-300">Pending Inventory</p>
            <h2 className="text-3xl font-bold text-[#ff5a00]">{counts.pendingInventory}</h2>
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

        <CardContent className="space-y-4">
          <div className="grid md:grid-cols-3 gap-3">
            <div className="space-y-1.5 md:col-span-2">
              <Label>Repair Job</Label>
              <select
                value={selectedJob?.id || ""}
                onChange={(e) => selectJob(e.target.value)}
                className="w-full rounded-md border border-[#ff5a00]/20 bg-[#08153d]/80 px-3 py-2 text-white outline-none focus:ring-2 focus:ring-[#ff5a00]"
              >
                <option className="bg-[#08153d] text-white" value="">
                  Select Repair Job
                </option>
                {repairJobs.map((job) => (
                  <option className="bg-[#08153d] text-white" key={job.id} value={job.id}>
                    {job.job_number || job.id} - {getJobTitle(job)}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <Label>Requested By</Label>
              <Input className={inputClass} value={profileName || "RR Technician"} readOnly />
            </div>
          </div>

          {selectedJob && (
            <div className="rounded-xl border border-[#ff5a00]/20 bg-[#08153d]/80 p-4">
              <div className="flex items-center gap-2 mb-2">
                <Wrench className="w-4 h-4 text-[#ff5a00]" />
                <p className="font-bold text-white">{selectedJob.job_number || selectedJob.id}</p>
              </div>

              <div className="grid md:grid-cols-3 gap-3 text-sm text-slate-300">
                <p>Failed Part: {getJobTitle(selectedJob)}</p>
                <p>Status: {selectedJob.status || "—"}</p>
                <p>Fault: {selectedJob.fault_description || selectedJob.reason || "—"}</p>
              </div>
            </div>
          )}

          <div className="border-t border-white/10 pt-4 space-y-3">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
              <div>
                <h3 className="font-bold text-white">Consumable Items</h3>
                <p className="text-xs text-slate-300">
                  Search stock from spare_parts and add multiple items for one repair job.
                </p>
              </div>

              <Input
                className={`md:w-72 ${inputClass}`}
                placeholder="Search inventory e.g. Solder"
                value={stockSearch}
                onChange={(e) => setStockSearch(e.target.value)}
              />
            </div>

            {items.map((item, index) => (
              <div
                key={index}
                className="rounded-xl border border-[#ff5a00]/20 bg-[#08153d]/70 p-3 space-y-3"
              >
                <div className="grid md:grid-cols-4 gap-3">
                  <div className="space-y-1.5 md:col-span-2">
                    <Label>Consumable Item</Label>
                    <select
                      value={item.spare_part_id}
                      onChange={(e) => selectStockItem(index, e.target.value)}
                      className="w-full rounded-md border border-[#ff5a00]/20 bg-[#08153d]/80 px-3 py-2 text-white outline-none focus:ring-2 focus:ring-[#ff5a00]"
                    >
                      <option className="bg-[#08153d] text-white" value="">
                        Select item
                      </option>
                      {filteredStock.map((part) => (
                        <option className="bg-[#08153d] text-white" key={part.id} value={part.id}>
                          {getPartDisplayName(part)} {part.part_number ? `(${part.part_number})` : ""} - Stock: {getStockQty(part)}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <Label>Quantity</Label>
                    <Input
                      className={inputClass}
                      type="number"
                      min="1"
                      value={item.quantity}
                      onChange={(e) => updateItem(index, "quantity", e.target.value)}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label>Available</Label>
                    <Input className={inputClass} value={item.available_stock} readOnly />
                  </div>
                </div>

                <div className="grid md:grid-cols-[1fr_auto] gap-3">
                  <Textarea
                    className={`min-h-[70px] ${inputClass}`}
                    placeholder="Reason / purpose for this item"
                    value={item.reason}
                    onChange={(e) => updateItem(index, "reason", e.target.value)}
                  />

                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => removeItem(index)}
                    className={outlineButtonClass}
                    disabled={items.length === 1}
                  >
                    <Trash2 className="w-4 h-4 mr-1" />
                    Remove
                  </Button>
                </div>
              </div>
            ))}

            <Button type="button" variant="outline" onClick={addItem} className={outlineButtonClass}>
              <Plus className="w-4 h-4 mr-2" />
              Add Another Item
            </Button>
          </div>

          <Textarea
            className={`min-h-[80px] ${inputClass}`}
            placeholder="General notes optional"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />

          <Button
            onClick={createRequest}
            disabled={submitting}
            className="w-full bg-[#ff5a00] hover:bg-[#ff5a00]/90 text-white"
          >
            {submitting ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <PackagePlus className="w-4 h-4 mr-2" />
            )}
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
            <div className="flex items-center gap-2 text-sm text-slate-300">
              <Loader2 className="w-4 h-4 animate-spin text-[#ff5a00]" />
              Loading...
            </div>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-slate-300">No request found.</p>
          ) : (
            <div className="space-y-3">
              {filtered.map((request) => {
                const requestItems = Array.isArray(request.items)
                  ? request.items
                  : request.item_name ? [
                      {
                        item_name: request.item_name,
                        quantity: request.quantity,
                        reason: request.reason,
                      },
                    ]
                  : [];

                return (
                  <div
                    key={request.id}
                    className="rounded-xl border border-[#ff5a00]/20 bg-[#08153d]/80 p-4 shadow-sm"
                  >
                    <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
                      <div>
                        <h3 className="font-bold text-white">
                          {request.job_number || "RR Consumable Request"}
                        </h3>

                        <p className="text-sm text-slate-300 mt-1">
                          Failed Part: {request.failed_part || "—"}
                        </p>

                        <div className="mt-2 space-y-1">
                          {requestItems.length > 0 ? (
                            requestItems.map((item, index) => (
                              <p key={index} className="text-sm text-slate-200">
                                {index + 1}. {item.item_name} — Qty: {item.quantity}
                                {item.reason ? ` | ${item.reason}` : ""}
                              </p>
                            ))
                          ) : (
                            <p className="text-sm text-slate-300">No item details.</p>
                          )}
                        </div>

                        {request.notes && (
                          <p className="text-sm mt-2 text-slate-200">{request.notes}</p>
                        )}

                        <p className="text-xs text-orange-300 mt-2">
                          Status: {request.status || "pending_hod"}
                        </p>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        {request.status === "pending_hod" && userIsRRHod && (
                          <>
                            <Button
                              size="sm"
                              className="bg-green-600 hover:bg-green-700 text-white"
                              onClick={() => approveToInventory(request)}
                            >
                              <ShieldCheck className="w-4 h-4 mr-1" />
                              Approve To Inventory
                            </Button>

                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => rejectByHod(request)}
                            >
                              <XCircle className="w-4 h-4 mr-1" />
                              Reject
                            </Button>
                          </>
                        )}

                        {request.status === "pending_inventory" && (
                          userIsInventory ? <>
                            <Button size="sm" className="bg-green-600 hover:bg-green-700" onClick={() => releaseFromInventory(request)}>
                              Release From Stock
                            </Button>
                            <Button size="sm" variant="destructive" onClick={() => rejectByInventory(request)}>
                              Reject / Out of Stock
                            </Button>
                          </> : <span className="text-xs text-blue-200 uppercase">Waiting Inventory Release</span>
                        )}

                        {request.status === "released" && (
                          userIsRR ? <Button size="sm" className="bg-green-600 hover:bg-green-700" onClick={() => confirmUsed(request)}>
                            Confirm Received / Used
                          </Button> : <span className="text-xs text-green-300 uppercase">Released To RR</span>
                        )}

                        {request.status === "used" && <span className="text-xs text-green-300 uppercase">Used On Repair Job</span>}

                        {request.status === "rejected_by_hod" && (
                          <span className="text-xs text-red-300 uppercase">
                            Rejected By RR HOD
                          </span>
                        )}
                        {request.status === "rejected_by_inventory" && (
                          <span className="text-xs text-red-300 uppercase">Rejected By Inventory</span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
