import React, { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Power } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabaseClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export async function fetchInventoryMasterData() {
  const [categories, brands, models, supplies, suppliers] = await Promise.all([
    supabase.from('inventory_equipment_categories').select('*').order('name'),
    supabase.from('inventory_equipment_brands').select('*').order('name'),
    supabase.from('inventory_equipment_models').select('*').order('name'),
    supabase.from('inventory_purchase_supplies').select('*').order('supply_name'),
    supabase.from('inventory_suppliers').select('*').order('supplier_name'),
  ]);

  const failed = [categories, brands, models, supplies, suppliers].find((result) => result.error);
  if (failed?.error) throw failed.error;

  return {
    categories: categories.data || [],
    brands: brands.data || [],
    models: models.data || [],
    supplies: supplies.data || [],
    suppliers: suppliers.data || [],
  };
}

const EMPTY_SUPPLY = {
  supply_name: '',
  part_number: '',
  category_id: '',
  brand_id: '',
  model_id: '',
  unit_of_measure: 'Unit',
  description: '',
};

const EMPTY_SUPPLIER = {
  supplier_name: '', contact_person: '', phone: '', email: '', address: '',
  tax_identification_number: '', registration_number: '', payment_terms: '',
  bank_name: '', bank_account_name: '', bank_account_number: '', notes: '',
};

export default function InventoryMasterData() {
  const queryClient = useQueryClient();
  const [categoryName, setCategoryName] = useState('');
  const [brand, setBrand] = useState({ category_id: '', name: '' });
  const [model, setModel] = useState({ brand_id: '', name: '' });
  const [supply, setSupply] = useState(EMPTY_SUPPLY);
  const [supplier, setSupplier] = useState(EMPTY_SUPPLIER);
  const [saving, setSaving] = useState(false);

  const { data = { categories: [], brands: [], models: [], supplies: [], suppliers: [] }, isLoading } = useQuery({
    queryKey: ['inventory-master-data'],
    queryFn: fetchInventoryMasterData,
  });

  const activeCategories = data.categories.filter((item) => item.status === 'active');
  const activeBrands = data.brands.filter((item) => item.status === 'active');
  const activeModels = data.models.filter((item) => item.status === 'active');
  const supplyBrands = activeBrands.filter((item) => item.category_id === supply.category_id);
  const supplyModels = activeModels.filter((item) => item.brand_id === supply.brand_id);

  const categoryNames = useMemo(
    () => Object.fromEntries(data.categories.map((item) => [item.id, item.name])),
    [data.categories]
  );
  const brandNames = useMemo(
    () => Object.fromEntries(data.brands.map((item) => [item.id, item.name])),
    [data.brands]
  );
  const modelNames = useMemo(
    () => Object.fromEntries(data.models.map((item) => [item.id, item.name])),
    [data.models]
  );

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['inventory-master-data'] });

  const insertRecord = async (table, payload, reset) => {
    setSaving(true);
    try {
      const { error } = await supabase.from(table).insert(payload);
      if (error) throw error;
      reset();
      await refresh();
      toast.success('Master record created.');
    } catch (error) {
      toast.error(error?.message || 'Could not create master record.');
    } finally {
      setSaving(false);
    }
  };

  const toggleStatus = async (table, record) => {
    const { error } = await supabase
      .from(table)
      .update({ status: record.status === 'active' ? 'inactive' : 'active', updated_at: new Date().toISOString() })
      .eq('id', record.id);
    if (error) return toast.error(error.message);
    await refresh();
  };

  const RecordList = ({ title, records, table, render }) => (
    <Card>
      <CardHeader><CardTitle className="text-base">{title}</CardTitle></CardHeader>
      <CardContent className="space-y-2">
        {records.length === 0 && <p className="text-sm text-muted-foreground">No record created yet.</p>}
        {records.map((record) => (
          <div key={record.id} className="flex items-center justify-between gap-3 rounded-lg border p-3">
            <div className={record.status === 'inactive' ? 'opacity-50' : ''}>{render(record)}</div>
            <Button type="button" size="icon" variant="ghost" onClick={() => toggleStatus(table, record)}>
              <Power className="h-4 w-4" />
            </Button>
          </div>
        ))}
      </CardContent>
    </Card>
  );

  if (isLoading) return <p className="text-sm text-muted-foreground">Loading Inventory master data…</p>;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 xl:grid-cols-3">
        <Card><CardHeader><CardTitle className="text-base">Add Category</CardTitle></CardHeader><CardContent className="space-y-3">
          <Label>Category name</Label><Input value={categoryName} onChange={(event) => setCategoryName(event.target.value)} placeholder="ATM, POS, Card Printer…" />
          <Button disabled={saving || !categoryName.trim()} onClick={() => insertRecord('inventory_equipment_categories', { name: categoryName.trim() }, () => setCategoryName(''))}><Plus className="mr-1 h-4 w-4" />Add Category</Button>
        </CardContent></Card>

        <Card><CardHeader><CardTitle className="text-base">Add Brand</CardTitle></CardHeader><CardContent className="space-y-3">
          <Label>Category</Label><Select value={brand.category_id} onValueChange={(value) => setBrand({ ...brand, category_id: value })}><SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger><SelectContent>{activeCategories.map((item) => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}</SelectContent></Select>
          <Label>Brand name</Label><Input value={brand.name} onChange={(event) => setBrand({ ...brand, name: event.target.value })} placeholder="NCR, Hyosung, Entrust…" />
          <Button disabled={saving || !brand.category_id || !brand.name.trim()} onClick={() => insertRecord('inventory_equipment_brands', { category_id: brand.category_id, name: brand.name.trim() }, () => setBrand({ category_id: '', name: '' }))}><Plus className="mr-1 h-4 w-4" />Add Brand</Button>
        </CardContent></Card>

        <Card><CardHeader><CardTitle className="text-base">Add Model</CardTitle></CardHeader><CardContent className="space-y-3">
          <Label>Brand</Label><Select value={model.brand_id} onValueChange={(value) => setModel({ ...model, brand_id: value })}><SelectTrigger><SelectValue placeholder="Select brand" /></SelectTrigger><SelectContent>{activeBrands.map((item) => <SelectItem key={item.id} value={item.id}>{categoryNames[item.category_id]} → {item.name}</SelectItem>)}</SelectContent></Select>
          <Label>Model name</Label><Input value={model.name} onChange={(event) => setModel({ ...model, name: event.target.value })} placeholder="NCR 2050, 5600ST…" />
          <Button disabled={saving || !model.brand_id || !model.name.trim()} onClick={() => insertRecord('inventory_equipment_models', { brand_id: model.brand_id, name: model.name.trim() }, () => setModel({ brand_id: '', name: '' }))}><Plus className="mr-1 h-4 w-4" />Add Model</Button>
        </CardContent></Card>
      </div>

      <Card><CardHeader><CardTitle>Purchase Supply Catalogue</CardTitle></CardHeader><CardContent className="grid gap-3 md:grid-cols-3">
        <div><Label>Supply name</Label><Input value={supply.supply_name} onChange={(event) => setSupply({ ...supply, supply_name: event.target.value })} /></div>
        <div><Label>Part number</Label><Input value={supply.part_number} onChange={(event) => setSupply({ ...supply, part_number: event.target.value })} /></div>
        <div><Label>Unit of measure</Label><Input value={supply.unit_of_measure} onChange={(event) => setSupply({ ...supply, unit_of_measure: event.target.value })} placeholder="Unit, Pack, Roll…" /></div>
        <div><Label>Category</Label><Select value={supply.category_id} onValueChange={(value) => setSupply({ ...supply, category_id: value, brand_id: '', model_id: '' })}><SelectTrigger><SelectValue placeholder="Optional" /></SelectTrigger><SelectContent>{activeCategories.map((item) => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}</SelectContent></Select></div>
        <div><Label>Brand</Label><Select value={supply.brand_id} onValueChange={(value) => setSupply({ ...supply, brand_id: value, model_id: '' })}><SelectTrigger><SelectValue placeholder="Optional" /></SelectTrigger><SelectContent>{supplyBrands.map((item) => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}</SelectContent></Select></div>
        <div><Label>Model</Label><Select value={supply.model_id} onValueChange={(value) => setSupply({ ...supply, model_id: value })}><SelectTrigger><SelectValue placeholder="Optional" /></SelectTrigger><SelectContent>{supplyModels.map((item) => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}</SelectContent></Select></div>
        <div className="md:col-span-3"><Label>Description</Label><Textarea value={supply.description} onChange={(event) => setSupply({ ...supply, description: event.target.value })} /></div>
        <Button className="md:col-span-3" disabled={saving || !supply.supply_name.trim() || !supply.unit_of_measure.trim()} onClick={() => insertRecord('inventory_purchase_supplies', { ...supply, category_id: supply.category_id || null, brand_id: supply.brand_id || null, model_id: supply.model_id || null, supply_name: supply.supply_name.trim(), unit_of_measure: supply.unit_of_measure.trim() }, () => setSupply(EMPTY_SUPPLY))}><Plus className="mr-1 h-4 w-4" />Add Supply</Button>
      </CardContent></Card>

      <Card><CardHeader><CardTitle>Registered Suppliers</CardTitle></CardHeader><CardContent className="grid gap-3 md:grid-cols-3">
        <div><Label>Supplier / company name *</Label><Input value={supplier.supplier_name} onChange={(event) => setSupplier({ ...supplier, supplier_name: event.target.value })} /></div>
        <div><Label>Contact person</Label><Input value={supplier.contact_person} onChange={(event) => setSupplier({ ...supplier, contact_person: event.target.value })} /></div>
        <div><Label>Phone</Label><Input value={supplier.phone} onChange={(event) => setSupplier({ ...supplier, phone: event.target.value })} /></div>
        <div><Label>Email</Label><Input type="email" value={supplier.email} onChange={(event) => setSupplier({ ...supplier, email: event.target.value })} /></div>
        <div><Label>Tax Identification Number</Label><Input value={supplier.tax_identification_number} onChange={(event) => setSupplier({ ...supplier, tax_identification_number: event.target.value })} /></div>
        <div><Label>Registration Number</Label><Input value={supplier.registration_number} onChange={(event) => setSupplier({ ...supplier, registration_number: event.target.value })} /></div>
        <div><Label>Payment terms</Label><Input value={supplier.payment_terms} onChange={(event) => setSupplier({ ...supplier, payment_terms: event.target.value })} placeholder="Net 30, payment on delivery…" /></div>
        <div><Label>Bank name</Label><Input value={supplier.bank_name} onChange={(event) => setSupplier({ ...supplier, bank_name: event.target.value })} /></div>
        <div><Label>Account name</Label><Input value={supplier.bank_account_name} onChange={(event) => setSupplier({ ...supplier, bank_account_name: event.target.value })} /></div>
        <div><Label>Account number</Label><Input value={supplier.bank_account_number} onChange={(event) => setSupplier({ ...supplier, bank_account_number: event.target.value })} /></div>
        <div className="md:col-span-2"><Label>Address</Label><Textarea value={supplier.address} onChange={(event) => setSupplier({ ...supplier, address: event.target.value })} /></div>
        <div><Label>Notes</Label><Textarea value={supplier.notes} onChange={(event) => setSupplier({ ...supplier, notes: event.target.value })} /></div>
        <Button className="md:col-span-3" disabled={saving || !supplier.supplier_name.trim()} onClick={() => insertRecord('inventory_suppliers', Object.fromEntries(Object.entries(supplier).map(([key, value]) => [key, typeof value === 'string' ? value.trim() || null : value])), () => setSupplier(EMPTY_SUPPLIER))}><Plus className="mr-1 h-4 w-4" />Register Supplier</Button>
      </CardContent></Card>

      <div className="grid gap-4 xl:grid-cols-4">
        <RecordList title="Categories" records={data.categories} table="inventory_equipment_categories" render={(item) => <><p className="font-medium">{item.name}</p><p className="text-xs text-muted-foreground">{item.status}</p></>} />
        <RecordList title="Brands" records={data.brands} table="inventory_equipment_brands" render={(item) => <><p className="font-medium">{item.name}</p><p className="text-xs text-muted-foreground">{categoryNames[item.category_id]} · {item.status}</p></>} />
        <RecordList title="Models" records={data.models} table="inventory_equipment_models" render={(item) => <><p className="font-medium">{item.name}</p><p className="text-xs text-muted-foreground">{brandNames[item.brand_id]} · {item.status}</p></>} />
        <RecordList title="Supplies" records={data.supplies} table="inventory_purchase_supplies" render={(item) => <><p className="font-medium">{item.supply_name}</p><p className="text-xs text-muted-foreground">{item.part_number || 'No part number'} · {item.unit_of_measure} · {modelNames[item.model_id] || brandNames[item.brand_id] || categoryNames[item.category_id] || 'General'}</p></>} />
      </div>

      <RecordList title="Supplier Register" records={data.suppliers} table="inventory_suppliers" render={(item) => <><p className="font-medium">{item.supplier_name}</p><p className="text-xs text-muted-foreground">{item.contact_person || 'No contact person'} · {item.phone || item.email || 'No contact details'} · {item.status}</p></>} />
    </div>
  );
}
