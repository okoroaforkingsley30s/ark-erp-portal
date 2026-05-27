import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();

    const { data, event } = body;

    // Only process DM messages
    if (!data || data.message_type !== 'dm' || !data.recipient_id) {
      return Response.json({ skipped: true, reason: 'Not a DM or no recipient' });
    }

    // Create a Notification for the DM recipient
    await base44.asServiceRole.entities.Notification.create({
      user_email: data.recipient_id,
      title: `New message from ${data.sender_name || 'Someone'}`,
      message: data.message_body?.length > 120 ? data.message_body.substring(0, 120) + '...' : data.message_body,
      type: 'chat_message',
      reference_id: data.id || event?.entity_id || '',
      read: false,
    });

    return Response.json({ success: true });
  } catch (error) {
    console.error('onNewDMMessage error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});