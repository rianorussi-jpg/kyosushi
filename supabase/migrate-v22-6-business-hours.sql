-- KYO v22.6 — Horarios configurables usando SIEMPRE hora de Ciudad de México.
-- Ejecutar UNA sola vez.

alter table public.app_settings
add column if not exists business_hours jsonb not null default
'{
  "mon":{"closed":true,"open":"13:00","close":"21:00"},
  "tue":{"closed":false,"open":"13:00","close":"21:00"},
  "wed":{"closed":false,"open":"13:00","close":"21:00"},
  "thu":{"closed":false,"open":"13:00","close":"22:00"},
  "fri":{"closed":false,"open":"13:00","close":"22:00"},
  "sat":{"closed":false,"open":"13:00","close":"22:00"},
  "sun":{"closed":false,"open":"13:00","close":"22:00"}
}'::jsonb;

update public.app_settings
set business_hours =
'{
  "mon":{"closed":true,"open":"13:00","close":"21:00"},
  "tue":{"closed":false,"open":"13:00","close":"21:00"},
  "wed":{"closed":false,"open":"13:00","close":"21:00"},
  "thu":{"closed":false,"open":"13:00","close":"22:00"},
  "fri":{"closed":false,"open":"13:00","close":"22:00"},
  "sat":{"closed":false,"open":"13:00","close":"22:00"},
  "sun":{"closed":false,"open":"13:00","close":"22:00"}
}'::jsonb
where id='main'
  and (business_hours is null or business_hours='{}'::jsonb);


create or replace function public.is_store_open_now()
returns boolean
language plpgsql
stable
security definer
set search_path=public
as $$
declare
  v_local timestamp;
  v_day_key text;
  v_day jsonb;
  v_open time;
  v_close time;
begin
  -- No depende de la zona horaria del cliente.
  v_local := timezone('America/Mexico_City', now());

  v_day_key := case extract(isodow from v_local)::int
    when 1 then 'mon'
    when 2 then 'tue'
    when 3 then 'wed'
    when 4 then 'thu'
    when 5 then 'fri'
    when 6 then 'sat'
    when 7 then 'sun'
  end;

  select s.business_hours->v_day_key
    into v_day
  from public.app_settings s
  where s.id='main';

  if v_day is null then
    return false;
  end if;

  if coalesce((v_day->>'closed')::boolean,false) then
    return false;
  end if;

  v_open := (v_day->>'open')::time;
  v_close := (v_day->>'close')::time;

  return v_local::time >= v_open
     and v_local::time < v_close;
end;
$$;

revoke all on function public.is_store_open_now() from public;
grant execute on function public.is_store_open_now() to anon, authenticated;


create or replace function public.prevent_orders_outside_business_hours()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
begin
  if not public.is_store_open_now() then
    raise exception 'KYO está cerrado en este momento. Intenta nuevamente dentro de nuestro horario de servicio.';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_orders_business_hours on public.orders;
create trigger trg_orders_business_hours
before insert on public.orders
for each row execute function public.prevent_orders_outside_business_hours();
