-- KYO v22.5
-- Rewards: 1 punto por cada $10 de subtotal entregado.
-- Panel: administradores pueden agregar puntos a una cuenta por correo.

create or replace function public.award_rewards_on_delivery()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
begin
  if new.status='delivered'
     and old.status is distinct from 'delivered'
     and new.rewards_awarded=false then

    if new.user_id is not null then
      update public.profiles
      set reward_points=reward_points+floor(new.subtotal/10)::int,
          reward_order_stamps=reward_order_stamps+1,
          updated_at=now()
      where id=new.user_id;
    end if;

    new.rewards_awarded:=true;
  end if;

  new.updated_at:=now();
  return new;
end;
$$;

drop trigger if exists orders_award_rewards on public.orders;
create trigger orders_award_rewards
before update on public.orders
for each row execute procedure public.award_rewards_on_delivery();


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
  select p.id,u.email,p.full_name,p.reward_points
  from public.profiles p
  join auth.users u on u.id=p.id
  where p.id=v_user_id;
end;
$$;

revoke all on function public.admin_add_reward_points(text,integer) from public;
grant execute on function public.admin_add_reward_points(text,integer) to authenticated;
