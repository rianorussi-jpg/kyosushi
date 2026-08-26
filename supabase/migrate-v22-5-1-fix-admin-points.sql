-- KYO v22.5.1
-- Corrige "structure of query does not match function result type"
-- en admin_add_reward_points.
-- Ejecuta UNA sola vez si ya corriste migrate-v22-5-points.sql.

create or replace function public.admin_add_reward_points(
  p_email text,
  p_points integer
)
returns table(
  user_id uuid,
  email text,
  full_name text,
  reward_points integer
)
language plpgsql
security definer
set search_path=public,auth
as $$
declare
  v_user_id uuid;
begin
  if auth.uid() is null or not public.is_admin(auth.uid()) then
    raise exception 'No tienes permisos de administrador';
  end if;

  if coalesce(trim(p_email),'')='' then
    raise exception 'Escribe el correo del usuario';
  end if;

  if coalesce(p_points,0)<=0 then
    raise exception 'Los puntos deben ser mayores a 0';
  end if;

  select u.id
    into v_user_id
  from auth.users u
  where lower(u.email)=lower(trim(p_email))
  limit 1;

  if v_user_id is null then
    raise exception 'No encontramos una cuenta con ese correo';
  end if;

  update public.profiles p
  set reward_points=p.reward_points+p_points,
      updated_at=now()
  where p.id=v_user_id;

  if not found then
    raise exception 'La cuenta no tiene un perfil KYO';
  end if;

  return query
  select
    p.id::uuid,
    u.email::text,
    coalesce(p.full_name,'')::text,
    p.reward_points::integer
  from public.profiles p
  join auth.users u on u.id=p.id
  where p.id=v_user_id;
end;
$$;

revoke all on function public.admin_add_reward_points(text,integer) from public;
grant execute on function public.admin_add_reward_points(text,integer) to authenticated;
