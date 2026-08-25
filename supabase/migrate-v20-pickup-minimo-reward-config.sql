-- KYO v20 — Pickup tracking + pedido mínimo + reward configurable
-- Ejecutar UNA sola vez en Supabase SQL Editor sobre la base actual.

-- =========================================================
-- 1) CONFIGURACIÓN GLOBAL DEL NEGOCIO
-- =========================================================
create table if not exists public.app_settings (
  id text primary key default 'main',
  minimum_order numeric(10,2) not null default 200 check (minimum_order >= 0),
  points_reward_cost integer not null default 250 check (points_reward_cost > 0),
  points_reward_product_id uuid references public.products(id) on delete set null,
  updated_at timestamptz not null default now()
);

insert into public.app_settings(id,minimum_order,points_reward_cost,points_reward_product_id)
values(
  'main',
  200,
  250,
  (select p.id from public.products p where p.slug='spring-rolls' or lower(p.name)='4 spring rolls' limit 1)
)
on conflict (id) do nothing;

alter table public.app_settings enable row level security;

drop policy if exists "app settings public read" on public.app_settings;
create policy "app settings public read"
on public.app_settings for select
using (true);

drop policy if exists "admins manage app settings" on public.app_settings;
create policy "admins manage app settings"
on public.app_settings for all
using (public.is_admin(auth.uid()))
with check (public.is_admin(auth.uid()));

grant select on public.app_settings to anon, authenticated;
grant insert, update, delete on public.app_settings to authenticated;

-- =========================================================
-- 2) GUARDAR QUÉ PRODUCTO/COSTO PERTENECÍA AL VOUCHER
--    Así si KYO cambia la configuración después, el voucher
--    que ya estaba en carrito sigue siendo válido y se
--    devuelven exactamente los puntos gastados al quitarlo.
-- =========================================================
alter table public.reward_vouchers
  add column if not exists reward_product_id uuid references public.products(id) on delete set null;

alter table public.reward_vouchers
  add column if not exists points_spent integer;

-- Compatibilidad con rewards de puntos que ya estuvieran reservados antes de v20.
update public.reward_vouchers rv
set reward_product_id=coalesce(rv.reward_product_id,s.points_reward_product_id),
    points_spent=coalesce(rv.points_spent,250)
from public.app_settings s
where s.id='main'
  and rv.reward_type='spring_rolls'
  and rv.status='available';

-- =========================================================
-- 3) REWARD DE PUNTOS DINÁMICO
-- =========================================================
create or replace function public.redeem_spring_rolls_reward()
returns uuid
language plpgsql
security definer
set search_path=public
as $$
declare
  v_user uuid:=auth.uid();
  v_id uuid;
  v_cost integer;
  v_product_id uuid;
begin
  if v_user is null then raise exception 'Debes iniciar sesión'; end if;

  select s.points_reward_cost,s.points_reward_product_id
    into v_cost,v_product_id
  from public.app_settings s
  where s.id='main';

  if v_product_id is null then
    raise exception 'KYO todavía no ha configurado el producto del reward por puntos';
  end if;

  if not exists(select 1 from public.products p where p.id=v_product_id and p.available=true) then
    raise exception 'El producto configurado para este reward no está disponible';
  end if;

  update public.profiles
  set reward_points=reward_points-v_cost
  where id=v_user and reward_points>=v_cost;

  if not found then
    raise exception 'No tienes suficientes puntos disponibles';
  end if;

  insert into public.reward_vouchers(
    user_id,reward_type,reward_product_id,points_spent
  )
  values(
    v_user,'spring_rolls',v_product_id,v_cost
  )
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.redeem_spring_rolls_reward() from public;
grant execute on function public.redeem_spring_rolls_reward() to authenticated;

-- =========================================================
-- 4) AL QUITAR REWARD DEL CARRITO, DEVOLVER LO QUE GASTÓ
-- =========================================================
create or replace function public.cancel_reward_voucher(p_voucher_id uuid)
returns boolean
language plpgsql
security definer
set search_path=public
as $$
declare
  v_user uuid:=auth.uid();
  v_voucher public.reward_vouchers%rowtype;
begin
  if v_user is null then raise exception 'Debes iniciar sesión'; end if;

  select rv.* into v_voucher
  from public.reward_vouchers rv
  where rv.id=p_voucher_id
    and rv.user_id=v_user
    and rv.status='available'
  for update;

  if not found then
    return false;
  end if;

  if v_voucher.reward_type='spring_rolls' then
    update public.profiles
      set reward_points=reward_points+coalesce(v_voucher.points_spent,250)
      where id=v_user;
  elsif v_voucher.reward_type='free_roll' then
    update public.profiles
      set reward_order_stamps=reward_order_stamps+6
      where id=v_user;
  else
    raise exception 'Tipo de reward inválido';
  end if;

  delete from public.reward_vouchers where id=v_voucher.id;
  return true;
end;
$$;

revoke all on function public.cancel_reward_voucher(uuid) from public;
grant execute on function public.cancel_reward_voucher(uuid) to authenticated;

-- =========================================================
-- 5) CREATE_ORDER:
--    - pedido mínimo configurable
--    - reward por puntos valida el producto configurado
--    - mantiene reward de 6 pedidos / Clásicos
--    - mantiene disponibilidad por sucursal
-- =========================================================
create or replace function public.create_order(
  p_branch_id text,
  p_fulfillment_type text,
  p_address_id uuid,
  p_delivery_notes text,
  p_payment_method text,
  p_items jsonb
)
returns table(id uuid, order_number bigint, total numeric)
language plpgsql
security definer
set search_path=public
as $$
declare
  v_user uuid:=auth.uid();
  v_order_id uuid;
  v_order_number bigint;
  v_subtotal numeric(10,2):=0;
  v_delivery_fee numeric(10,2):=0;
  v_total numeric(10,2):=0;
  v_minimum_order numeric(10,2):=200;
  v_item jsonb;
  v_product public.products%rowtype;
  v_qty integer;
  v_address public.addresses%rowtype;
  v_branch_id text;
  v_address_text text;
  v_voucher_id uuid;
  v_voucher public.reward_vouchers%rowtype;
  v_custom jsonb;
  v_template public.customization_templates%rowtype;
  v_option jsonb;
  v_option_price numeric(10,2);
  v_custom_qty integer;
  v_item_extra numeric(10,2);
begin
  if v_user is null then raise exception 'Debes iniciar sesión'; end if;
  if p_fulfillment_type not in ('delivery','pickup') then raise exception 'Tipo de entrega inválido'; end if;
  if jsonb_array_length(coalesce(p_items,'[]'::jsonb))=0 then raise exception 'El carrito está vacío'; end if;

  select coalesce(s.minimum_order,200)
  into v_minimum_order
  from public.app_settings s
  where s.id='main';

  v_minimum_order:=coalesce(v_minimum_order,200);

  if p_fulfillment_type='delivery' then
    if p_address_id is null then raise exception 'Falta dirección de entrega'; end if;
    select a.* into v_address
    from public.addresses a
    where a.id=p_address_id and a.user_id=v_user;
    if not found then raise exception 'Dirección inválida'; end if;

    v_branch_id:=v_address.branch_id;
    v_address_text:=concat_ws(', ',
      nullif(trim(coalesce(v_address.street,v_address.address_line)),''),
      case when nullif(trim(coalesce(v_address.exterior_number,'')),'') is not null then '#'||trim(v_address.exterior_number) end,
      case when nullif(trim(coalesce(v_address.interior_number,'')),'') is not null then 'Int. '||trim(v_address.interior_number) end,
      nullif(trim(coalesce(v_address.neighborhood,'')),''),
      case when nullif(trim(coalesce(v_address.postal_code,'')),'') is not null then 'CP '||trim(v_address.postal_code) end
    );
  else
    if not exists(select 1 from public.branches b where b.id=p_branch_id and b.active=true) then
      raise exception 'Sucursal inválida';
    end if;
    v_branch_id:=p_branch_id;
    v_address_text:=null;
  end if;

  -- Primera pasada: validar y calcular subtotal real.
  for v_item in select * from jsonb_array_elements(p_items) loop
    v_qty:=greatest(1,least(20,coalesce((v_item->>'quantity')::int,1)));

    select p.* into v_product
    from public.products p
    where p.id=(v_item->>'product_id')::uuid and p.available=true;
    if not found then raise exception 'Uno de los productos ya no está disponible'; end if;

    if exists(
      select 1 from public.product_branch_availability pba
      where pba.product_id=v_product.id
        and pba.branch_id=v_branch_id
        and pba.available=false
    ) then
      raise exception '% no está disponible en esta sucursal',v_product.name;
    end if;

    v_item_extra:=0;

    for v_custom in
      select * from jsonb_array_elements(coalesce(v_item->'customizations','[]'::jsonb))
    loop
      select ct.* into v_template
      from public.customization_templates ct
      join public.product_customizations pc on pc.template_id=ct.id
      where pc.product_id=v_product.id
        and ct.id=(v_custom->>'template_id')::uuid;

      if not found then raise exception 'Personalización inválida para %',v_product.name; end if;

      select o into v_option
      from jsonb_array_elements(v_template.options) o
      where o->>'id'=v_custom->>'option_id'
      limit 1;

      if v_option is null then raise exception 'Opción de personalización inválida'; end if;

      if exists(
        select 1
        from public.customization_option_branch_availability coba
        where coba.template_id=v_template.id
          and coba.option_id=v_custom->>'option_id'
          and coba.branch_id=v_branch_id
          and coba.available=false
      ) then
        raise exception 'Una personalización seleccionada no está disponible en esta sucursal';
      end if;

      v_custom_qty:=greatest(1,least(20,coalesce((v_custom->>'quantity')::int,1)));
      v_option_price:=coalesce((v_option->>'price')::numeric,0);
      v_item_extra:=v_item_extra+(v_option_price*v_custom_qty);
    end loop;

    v_voucher_id:=nullif(v_item->>'reward_voucher_id','')::uuid;

    if v_voucher_id is null then
      v_subtotal:=v_subtotal+((v_product.price+v_item_extra)*v_qty);
    else
      select rv.* into v_voucher
      from public.reward_vouchers rv
      where rv.id=v_voucher_id
        and rv.user_id=v_user
        and rv.status='available';

      if not found then raise exception 'Este reward ya no está disponible'; end if;
      if v_qty<>1 then raise exception 'Los rewards solo pueden agregarse una vez'; end if;

      if v_voucher.reward_type='spring_rolls' then
        if v_voucher.reward_product_id is null or v_product.id<>v_voucher.reward_product_id then
          raise exception 'Este reward no corresponde al producto seleccionado';
        end if;
        -- Producto gratis. Los extras de personalización, si los hay, conservan su costo.
        v_subtotal:=v_subtotal+v_item_extra;

      elsif v_voucher.reward_type='free_roll' then
        if not exists(
          select 1
          from public.categories c
          where c.id=v_product.subcategory_id
            and (
              lower(c.name) in ('clásicos','clasicos')
              or lower(c.slug) in ('clasicos','clásicos')
            )
        ) then
          raise exception 'El reward de 6 pedidos solo aplica a rollos Clásicos';
        end if;
        -- Rollo + sus personalizaciones gratis.
        v_subtotal:=v_subtotal+0;
      else
        raise exception 'Tipo de reward inválido';
      end if;
    end if;
  end loop;

  if v_subtotal < v_minimum_order then
    raise exception 'El pedido mínimo es de $%. Te faltan $% en productos',
      trim(to_char(v_minimum_order,'FM999999990.00')),
      trim(to_char(v_minimum_order-v_subtotal,'FM999999990.00'));
  end if;

  v_delivery_fee:=case when p_fulfillment_type='delivery' then 39 else 0 end;
  v_total:=v_subtotal+v_delivery_fee;

  insert into public.orders(
    user_id,branch_id,fulfillment_type,delivery_address,delivery_reference,
    delivery_notes,payment_method,status,subtotal,delivery_fee,total
  )
  values(
    v_user,v_branch_id,p_fulfillment_type,v_address_text,
    case when p_fulfillment_type='delivery' then v_address.notes else null end,
    p_delivery_notes,p_payment_method,'preparing',v_subtotal,v_delivery_fee,v_total
  )
  returning public.orders.id,public.orders.order_number
  into v_order_id,v_order_number;

  -- Segunda pasada: guardar líneas y consumir vouchers.
  for v_item in select * from jsonb_array_elements(p_items) loop
    v_qty:=greatest(1,least(20,coalesce((v_item->>'quantity')::int,1)));

    select p.* into v_product
    from public.products p
    where p.id=(v_item->>'product_id')::uuid;

    v_item_extra:=0;
    for v_custom in select * from jsonb_array_elements(coalesce(v_item->'customizations','[]'::jsonb)) loop
      select ct.* into v_template
      from public.customization_templates ct
      where ct.id=(v_custom->>'template_id')::uuid;

      select o into v_option
      from jsonb_array_elements(v_template.options) o
      where o->>'id'=v_custom->>'option_id'
      limit 1;

      v_custom_qty:=greatest(1,least(20,coalesce((v_custom->>'quantity')::int,1)));
      v_item_extra:=v_item_extra+(coalesce((v_option->>'price')::numeric,0)*v_custom_qty);
    end loop;

    v_voucher_id:=nullif(v_item->>'reward_voucher_id','')::uuid;

    if v_voucher_id is null then
      insert into public.order_items(
        order_id,product_id,product_name,unit_price,quantity,customizations,item_note
      )
      values(
        v_order_id,v_product.id,v_product.name,v_product.price+v_item_extra,v_qty,
        coalesce(v_item->'customizations','[]'::jsonb),
        left(coalesce(v_item->>'item_note',''),250)
      );
    else
      select rv.* into v_voucher
      from public.reward_vouchers rv
      where rv.id=v_voucher_id
        and rv.user_id=v_user
        and rv.status='available'
      for update;

      if not found then raise exception 'Este reward ya fue utilizado'; end if;

      update public.reward_vouchers rv
      set status='redeemed',redeemed_at=now()
      where rv.id=v_voucher.id;

      insert into public.order_items(
        order_id,product_id,product_name,unit_price,quantity,customizations,item_note
      )
      values(
        v_order_id,v_product.id,v_product.name,
        case when v_voucher.reward_type='spring_rolls' then v_item_extra else 0 end,
        1,
        coalesce(v_item->'customizations','[]'::jsonb),
        left(coalesce(v_item->>'item_note',''),250)
      );
    end if;
  end loop;

  return query select v_order_id,v_order_number,v_total;
end;
$$;

revoke all on function public.create_order(text,text,uuid,text,text,jsonb) from public;
grant execute on function public.create_order(text,text,uuid,text,text,jsonb) to authenticated;
