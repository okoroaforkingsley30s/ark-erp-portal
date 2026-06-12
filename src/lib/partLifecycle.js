import { supabase } from '@/lib/supabaseClient';
import { logOperationEvent } from '@/lib/operationsIntelligence';

export async function logPartLifecycle({
  part_id = null,
  part_request_id = null,
  repair_job_id = null,
  ticket_id = null,
  part_name,
  part_number = null,
  serial_number = null,
  movement_type,
  from_location = null,
  to_location = null,
  from_department = null,
  to_department = null,
  issued_to_name = null,
  issued_to_email = null,
  quantity = 1,
  status_before = null,
  status_after = null,
  notes = null,
  evidence = [],
  actor_name = null,
  actor_email = null,
  actor_department = null,
}) {
  const payload = {
    part_id,
    part_request_id,
    repair_job_id,
    ticket_id,
    part_name,
    part_number,
    serial_number,
    movement_type,
    from_location,
    to_location,
    from_department,
    to_department,
    issued_to_name,
    issued_to_email,
    quantity,
    status_before,
    status_after,
    notes,
    evidence,
    actor_name,
    actor_email,
    actor_department,
  };

  const { data, error } = await supabase
    .from('part_lifecycle_logs')
    .insert(payload)
    .select()
    .single();

  if (error) {
    console.error('Part lifecycle log failed:', error);
    alert('Part lifecycle log failed: ' + error.message);
    return null;
  }

  await logOperationEvent({
    event_type: 'part_lifecycle',
    entity_type: 'part',
    entity_id: part_id || part_request_id || part_name,
    title: `Part Movement: ${movement_type}`,
    description: `${part_name} moved from ${from_department || from_location || 'N/A'} to ${to_department || to_location || 'N/A'}`,
    actor_name,
    actor_id: actor_email,
    department: actor_department,
    severity: 'info',
    metadata: payload,
  });

  return data;
}