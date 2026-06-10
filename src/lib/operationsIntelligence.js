import { supabase } from '@/lib/supabaseClient';

export async function logOperationEvent({
  event_type,
  entity_type,
  entity_id,
  title,
  description,
  actor_name,
  actor_id,
  department,
  severity = 'info',
  metadata = {},
}) {
  const payload = {
    event_type,
    entity_type,
    entity_id: entity_id ? String(entity_id) : null,
    title,
    description,
    actor_name,
    actor_id: actor_id ? String(actor_id) : null,
    department,
    severity,
    metadata,
  };

  console.log('OIN EVENT PAYLOAD:', payload);

  const { data, error } = await supabase
    .from('operations_events')
    .insert(payload)
    .select();

  if (error) {
    console.error('OIN event log failed:', error);
    alert('OIN event failed: ' + error.message);
    return null;
  }

  console.log('OIN EVENT SAVED:', data);
  return data;
}

export async function upsertOperationStatus({
  entity_type,
  entity_id,
  entity_name,
  status,
  latitude = null,
  longitude = null,
  last_seen = new Date().toISOString(),
  source_module,
  metadata = {},
}) {
  const payload = {
    entity_type,
    entity_id: String(entity_id),
    entity_name,
    status,
    latitude,
    longitude,
    last_seen,
    source_module,
    metadata,
    updated_at: new Date().toISOString(),
  };

  console.log('OIN STATUS PAYLOAD:', payload);

  const { data, error } = await supabase
    .from('operations_status')
    .upsert(payload, {
      onConflict: 'entity_type,entity_id',
    })
    .select();

  if (error) {
    console.error('OIN status update failed:', error);
    alert('OIN status failed: ' + error.message);
    return null;
  }

  console.log('OIN STATUS SAVED:', data);
  return data;
}