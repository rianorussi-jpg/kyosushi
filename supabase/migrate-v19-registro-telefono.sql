-- KYO v19 — Guardar teléfono del registro en profiles.
-- Ejecutar UNA sola vez en Supabase SQL Editor.
-- La columna phone ya existe en el proyecto; este cambio hace que el trigger
-- copie el teléfono enviado durante auth.signUp.

alter table public.profiles
  add column if not exists phone text;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, phone)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name',''),
    nullif(new.raw_user_meta_data->>'phone','')
  )
  on conflict (id) do update
    set full_name = excluded.full_name,
        phone = coalesce(excluded.phone, public.profiles.phone),
        updated_at = now();
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();
