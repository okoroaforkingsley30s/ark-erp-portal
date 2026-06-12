import { supabase } from "@/integrations/supabase/client";

export async function logOperationEvent(event = {}) {
  try {
    const payload = {
      event_type: event.event_type || event.type || "system_event",
      entity_type: event.entity_type || null,
      entity_id: event.entity_id || null,
      title: event.title || "Operation Event",
      description: event.description || null,
      severity: event.severity || "info",
      actor_name: event.actor_name || null,
      department: event.department || null,
      metadata: event.metadata || {},
    };

    const { error } = await supabase.from("operations_events").insert(payload);
    if (error) console.warn("OIN logOperationEvent failed:", error.message);
  } catch (error) {
    console.warn("OIN logOperationEvent error:", error);
  }
}

export async function upsertOperationStatus(status = {}) {
  try {
    const payload = {
      entity_type: status.entity_type || "user",
      entity_id: status.entity_id || status.user_id || status.email || "unknown",
      title: status.title || status.name || "Status Update",
      department: status.department || null,
      status: status.status || "active",
      lat: status.lat || null,
      lng: status.lng || null,
      metadata: status.metadata || {},
      last_seen: new Date().toISOString(),
    };

    const { error } = await supabase
      .from("operations_status")
      .upsert(payload, { onConflict: "entity_type,entity_id" });

    if (error) console.warn("OIN upsertOperationStatus failed:", error.message);
  } catch (error) {
    console.warn("OIN upsertOperationStatus error:", error);
  }
}