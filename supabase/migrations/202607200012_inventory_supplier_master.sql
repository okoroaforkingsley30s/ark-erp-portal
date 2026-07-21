-- Registered supplier master used by Inventory and Procurement purchase orders.

create table if not exists public.inventory_suppliers (
  id uuid primary key default gen_random_uuid(),
  supplier_name text not null,
  contact_person text,
  phone text,
  email text,
  address text,
  tax_identification_number text,
  registration_number text,
  payment_terms text,
  bank_name text,
  bank_account_name text,
  bank_account_number text,
  notes text,
  status text not null default 'active' check (status in ('active', 'inactive')),
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists inventory_suppliers_name_uidx
  on public.inventory_suppliers (lower(trim(supplier_name)));

create unique index if not exists inventory_suppliers_email_uidx
  on public.inventory_suppliers (lower(trim(email)))
  where email is not null and trim(email) <> '';

alter table public.lpos
  add column if not exists supplier_master_id uuid
    references public.inventory_suppliers(id) on delete restrict,
  add column if not exists supplier_tax_identification_number text,
  add column if not exists supplier_registration_number text,
  add column if not exists supplier_payment_terms text,
  add column if not exists supplier_bank_name text,
  add column if not exists supplier_bank_account_name text,
  add column if not exists supplier_bank_account_number text;

create index if not exists lpos_supplier_master_idx
  on public.lpos (supplier_master_id);

alter table public.inventory_suppliers enable row level security;

drop policy if exists ark_inventory_suppliers_read on public.inventory_suppliers;
create policy ark_inventory_suppliers_read
  on public.inventory_suppliers for select to authenticated
  using (true);

drop policy if exists ark_inventory_suppliers_manage on public.inventory_suppliers;
create policy ark_inventory_suppliers_manage
  on public.inventory_suppliers for all to authenticated
  using (public.ark_has_any_role(array['system_admin','admin','manager','inventory','procurement','procurement_head']::text[]))
  with check (public.ark_has_any_role(array['system_admin','admin','manager','inventory','procurement','procurement_head']::text[]));

grant select, insert, update on public.inventory_suppliers to authenticated;
