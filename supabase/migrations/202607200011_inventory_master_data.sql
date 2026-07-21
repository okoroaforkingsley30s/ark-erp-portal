-- Inventory-owned equipment hierarchy and purchase supply catalogue.

create table if not exists public.inventory_equipment_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  status text not null default 'active' check (status in ('active', 'inactive')),
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists inventory_equipment_categories_name_uidx
  on public.inventory_equipment_categories (lower(trim(name)));

create table if not exists public.inventory_equipment_brands (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.inventory_equipment_categories(id) on delete restrict,
  name text not null,
  description text,
  status text not null default 'active' check (status in ('active', 'inactive')),
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists inventory_equipment_brands_category_name_uidx
  on public.inventory_equipment_brands (category_id, lower(trim(name)));

create table if not exists public.inventory_equipment_models (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.inventory_equipment_brands(id) on delete restrict,
  name text not null,
  description text,
  status text not null default 'active' check (status in ('active', 'inactive')),
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists inventory_equipment_models_brand_name_uidx
  on public.inventory_equipment_models (brand_id, lower(trim(name)));

create table if not exists public.inventory_purchase_supplies (
  id uuid primary key default gen_random_uuid(),
  supply_name text not null,
  part_number text,
  category_id uuid references public.inventory_equipment_categories(id) on delete restrict,
  brand_id uuid references public.inventory_equipment_brands(id) on delete restrict,
  model_id uuid references public.inventory_equipment_models(id) on delete restrict,
  unit_of_measure text not null,
  description text,
  status text not null default 'active' check (status in ('active', 'inactive')),
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists inventory_purchase_supplies_name_part_uidx
  on public.inventory_purchase_supplies (
    lower(trim(supply_name)), lower(trim(coalesce(part_number, '')))
  );

alter table public.inventory_equipment_categories enable row level security;
alter table public.inventory_equipment_brands enable row level security;
alter table public.inventory_equipment_models enable row level security;
alter table public.inventory_purchase_supplies enable row level security;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'inventory_equipment_categories',
    'inventory_equipment_brands',
    'inventory_equipment_models',
    'inventory_purchase_supplies'
  ]
  loop
    execute format('drop policy if exists ark_inventory_master_read on public.%I', table_name);
    execute format(
      'create policy ark_inventory_master_read on public.%I for select to authenticated using (true)',
      table_name
    );

    execute format('drop policy if exists ark_inventory_master_manage on public.%I', table_name);
    execute format(
      'create policy ark_inventory_master_manage on public.%I for all to authenticated using (public.ark_has_any_role(array[''system_admin'',''admin'',''manager'',''inventory'',''procurement'']::text[])) with check (public.ark_has_any_role(array[''system_admin'',''admin'',''manager'',''inventory'',''procurement'']::text[]))',
      table_name
    );
  end loop;
end
$$;

grant select on public.inventory_equipment_categories to authenticated;
grant select on public.inventory_equipment_brands to authenticated;
grant select on public.inventory_equipment_models to authenticated;
grant select on public.inventory_purchase_supplies to authenticated;

grant insert, update on public.inventory_equipment_categories to authenticated;
grant insert, update on public.inventory_equipment_brands to authenticated;
grant insert, update on public.inventory_equipment_models to authenticated;
grant insert, update on public.inventory_purchase_supplies to authenticated;
