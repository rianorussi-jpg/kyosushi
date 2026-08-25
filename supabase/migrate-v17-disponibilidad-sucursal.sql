-- KYO v17 — Disponibilidad de productos y opciones por sucursal
-- Ejecutar UNA sola vez en Supabase SQL Editor.

create table if not exists public.product_branch_availability (
  product_id uuid not null references public.products(id) on delete cascade,
  branch_id text not null references public.branches(id) on delete cascade,
  available boolean not null default true,
  updated_at timestamptz not null default now(),
  primary key (product_id, branch_id)
);

create table if not exists public.customization_option_branch_availability (
  template_id uuid not null references public.customization_templates(id) on delete cascade,
  option_id text not null,
  branch_id text not null references public.branches(id) on delete cascade,
  available boolean not null default true,
  updated_at timestamptz not null default now(),
  primary key (template_id, option_id, branch_id)
);

alter table public.product_branch_availability enable row level security;
alter table public.customization_option_branch_availability enable row level security;

drop policy if exists "product branch availability public read" on public.product_branch_availability;
create policy "product branch availability public read"
on public.product_branch_availability for select
using (true);

drop policy if exists "admins manage product branch availability" on public.product_branch_availability;
create policy "admins manage product branch availability"
on public.product_branch_availability for all
using (public.is_admin(auth.uid()))
with check (public.is_admin(auth.uid()));

drop policy if exists "option branch availability public read" on public.customization_option_branch_availability;
create policy "option branch availability public read"
on public.customization_option_branch_availability for select
using (true);

drop policy if exists "admins manage option branch availability" on public.customization_option_branch_availability;
create policy "admins manage option branch availability"
on public.customization_option_branch_availability for all
using (public.is_admin(auth.uid()))
with check (public.is_admin(auth.uid()));

-- Ausencia de registro significa "disponible".
-- Este trigger protege también el backend: aunque alguien altere React,
-- no puede pedir un producto u opción marcada como no disponible en la sucursal.
create or replace function public.validate_order_item_branch_availability()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
declare
  v_branch text;
  v_custom jsonb;
  v_template uuid;
  v_option text;
begin
  select o.branch_id into v_branch
  from public.orders o
  where o.id = new.order_id;

  if v_branch is null then
    raise exception 'No se pudo determinar la sucursal del pedido';
  end if;

  if exists (
    select 1
    from public.product_branch_availability pba
    where pba.product_id = new.product_id
      and pba.branch_id = v_branch
      and pba.available = false
  ) then
    raise exception 'Este producto no está disponible en la sucursal seleccionada';
  end if;

  for v_custom in
    select * from jsonb_array_elements(coalesce(new.customizations,'[]'::jsonb))
  loop
    v_template := nullif(v_custom->>'template_id','')::uuid;
    v_option := nullif(v_custom->>'option_id','');

    if v_template is not null and v_option is not null and exists (
      select 1
      from public.customization_option_branch_availability coba
      where coba.template_id = v_template
        and coba.option_id = v_option
        and coba.branch_id = v_branch
        and coba.available = false
    ) then
      raise exception 'Una opción seleccionada ya no está disponible en esta sucursal';
    end if;
  end loop;

  return new;
end;
$$;

drop trigger if exists trg_validate_order_item_branch_availability on public.order_items;
create trigger trg_validate_order_item_branch_availability
before insert or update on public.order_items
for each row execute function public.validate_order_item_branch_availability();
