import { supabase } from "@/integrations/supabase/client";
import { logOperationEvent } from "@/lib/operationsIntelligence";
import { logPartLifecycle } from "@/lib/partLifecycle";

export async function getPartRequests(filter = {}) {
  let query = supabase
    .from("part_requests")
    .select(`
      *,
      tickets(*),
      engineers(*),
      spare_parts(*)
    `)
    .order("created_at", { ascending: false });

  if (filter.status) query = query.eq("status", filter.status);
  if (filter.engineer_id) query = query.eq("engineer_id", filter.engineer_id);
  if (filter.department_status) {
    query = query.eq("department_status", filter.department_status);
  }

  const { data, error } = await query;

  if (error) throw error;
  return data || [];
}

export async function updatePartRequestStatus({
  requestId,
  status,
  department,
  note,
  userId,
}) {
  const { data, error } = await supabase
    .from("part_requests")
    .update({
      status,
      updated_at: new Date().toISOString(),
    })
    .eq("id", requestId)
    .select()
    .single();

  if (error) throw error;

  await logPartLifecycle({
    part_request_id: requestId,
    status,
    department,
    note,
    user_id: userId,
  });

  await logOperationEvent({
    event_type: "PART_REQUEST_STATUS_UPDATED",
    title: `Part request ${status}`,
    description: note || `Part request updated by ${department}`,
    source_module: department,
    entity_type: "part_request",
    entity_id: requestId,
    severity: "info",
  });

  return data;
}