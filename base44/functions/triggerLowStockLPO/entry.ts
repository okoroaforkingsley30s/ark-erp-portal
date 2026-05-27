import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();

    const { event, data } = body;

    // Called by entity automation when InventoryItem is updated
    const item = data;
    if (!item) return Response.json({ skipped: true, reason: 'No item data' });

    const qty = Number(item.quantity_available ?? 0);
    const minQty = Number(item.minimum_stock_level ?? 2);

    if (qty >= minQty) {
      return Response.json({ skipped: true, reason: 'Stock level OK' });
    }

    // Check if there's already a pending/draft LPO for this item
    const existingLPOs = await base44.asServiceRole.entities.LPO.filter({
      status: { $in: ['Draft', 'Pending Approval', 'Approved'] }
    });

    const alreadyExists = existingLPOs.some(lpo =>
      Array.isArray(lpo.linked_inventory_items) &&
      lpo.linked_inventory_items.includes(item.id)
    );

    if (alreadyExists) {
      return Response.json({ skipped: true, reason: 'Active LPO already exists for this item' });
    }

    const qtyNeeded = Math.max(minQty * 3, minQty - qty + minQty);
    const lpoNumber = `LPO-${new Date().getFullYear()}-${Date.now().toString().slice(-5)}`;

    const newLPO = await base44.asServiceRole.entities.LPO.create({
      lpo_number: lpoNumber,
      title: `Replenishment: ${item.description || item.part_number}`,
      status: 'Draft',
      trigger_type: 'auto_low_stock',
      items: [{
        item_id: item.id,
        part_number: item.part_number || '',
        description: item.description || '',
        quantity_requested: qtyNeeded,
        unit_price_usd: item.supplier_price_usd || 0,
        unit_price_ngn: item.unit_price_ngn || 0,
        total_ngn: (item.unit_price_ngn || 0) * qtyNeeded,
      }],
      total_amount_ngn: (item.unit_price_ngn || 0) * qtyNeeded,
      total_amount_usd: (item.supplier_price_usd || 0) * qtyNeeded,
      notes: `Auto-generated: ${item.description} dropped to ${qty} units (min: ${minQty})`,
      linked_inventory_items: [item.id],
    });

    console.log('Auto LPO created:', newLPO.id, 'for item:', item.description);
    return Response.json({ success: true, lpo_id: newLPO.id, lpo_number: lpoNumber });

  } catch (error) {
    console.error('triggerLowStockLPO error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});