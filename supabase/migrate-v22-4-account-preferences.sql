-- KYO v22.4
-- Permite eliminar la cuenta del cliente sin borrar los registros históricos de pedidos.

alter table public.orders
  alter column user_id drop not null;

alter table public.orders
  drop constraint if exists orders_user_id_fkey;

alter table public.orders
  add constraint orders_user_id_fkey
  foreign key (user_id) references public.profiles(id) on delete set null;

create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_user uuid := auth.uid();
begin
  if v_user is null then
    raise exception 'Debes iniciar sesión';
  end if;

  -- Los pedidos se conservan; el FK ON DELETE SET NULL los desliga de la cuenta.
  delete from auth.users where id = v_user;
end;
$$;

revoke all on function public.delete_my_account() from public;
grant execute on function public.delete_my_account() to authenticated;
