-- KYO v13 — categorías, subcategorías y edición de plantillas

alter table public.categories add column if not exists parent_id uuid references public.categories(id) on delete cascade;
alter table public.products add column if not exists subcategory_id uuid references public.categories(id) on delete set null;
create index if not exists categories_parent_id_idx on public.categories(parent_id);
create index if not exists products_subcategory_id_idx on public.products(subcategory_id);

-- Subcategorías demo para Rollos.
with parent as (select id from public.categories where slug='rollos' limit 1)
insert into public.categories(name,slug,sort_order,active,parent_id)
select v.name,v.slug,v.sort_order,true,parent.id
from parent cross join (values
  ('Clásicos','rollos-clasicos',10),
  ('Tempurizados','rollos-tempurizados',20),
  ('Empanizados','rollos-empanizados',30),
  ('Especiales','rollos-especiales',40)
) as v(name,slug,sort_order)
on conflict (slug) do update set name=excluded.name, sort_order=excluded.sort_order, parent_id=excluded.parent_id;

-- Clasifica los rollos demo actuales.
update public.products p set subcategory_id=c.id
from public.categories c where c.slug='rollos-tempurizados' and p.slug='spicy-tuna-roll';
update public.products p set subcategory_id=c.id
from public.categories c where c.slug='rollos-empanizados' and p.slug in ('tampico-roll','philly-roll');
update public.products p set subcategory_id=c.id
from public.categories c where c.slug='rollos-especiales' and p.slug='crunch-roll';

-- Las políticas de categorías ya permiten administración a is_admin().
-- customization_templates también ya cuenta con política de administración desde v10;
-- por eso editar plantillas existentes no requiere nuevas políticas.
