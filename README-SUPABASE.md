# KYO + Supabase

El frontend ya está preparado para leer menú, autenticación, direcciones, pedidos y rewards desde Supabase.

## 1. Crear proyecto Supabase
Crea un proyecto y copia **Project URL** y **anon public key**.

## 2. Crear base
En Supabase > SQL Editor, ejecuta completo `supabase/schema.sql`.

## 3. Crear administrador
En Authentication > Users crea el correo y contraseña que usará KYO para el panel. Después ejecuta:

```sql
update public.profiles
set is_admin = true
where id = (select id from auth.users where email = 'TU-CORREO-ADMIN');
```

## 4. Variables de Vercel
Agrega en Vercel > Project > Settings > Environment Variables:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

Los valores están en Supabase > Project Settings > API.

## 5. Dominio del panel
Agrega a Vercel un dominio/subdominio como `panel.kyo.mx` apuntando al MISMO proyecto. La app detecta automáticamente cualquier hostname que empiece por `panel.` y abre el panel.

También puedes probar el panel entrando a `/panel` en el dominio normal.

## Seguridad
No pongas la `service_role` en Vercel ni en el frontend. El proyecto usa la anon key + RLS. Las acciones de admin requieren `profiles.is_admin = true`.


## Panel administrativo y Vercel

El panel ahora vive en `src/pages/AdminPanel.jsx` y la ruta pública es `/panel`.

El archivo `vercel.json` incluido hace el rewrite necesario para que abrir directamente `https://tu-dominio.com/panel` funcione con React Router.

Para usar `panel.tu-dominio.com`, agrega ese subdominio como Domain dentro del mismo proyecto de Vercel. Al entrar a la raíz del subdominio, la app redirige automáticamente a `/panel`.

Si todavía no configuraste las variables `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`, el panel mostrará el formulario pero no podrá iniciar sesión hasta agregarlas y volver a desplegar.

## Actualización v5 — direcciones y modo cocina
Si tu proyecto Supabase ya estaba creado con una versión anterior, ejecuta **una sola vez**:

`supabase/migrate-v5-direcciones-cocina.sql`

Después crea en **Authentication > Users** estas dos cuentas con sus contraseñas:
- `zakia@kyosushi.mx`
- `milenio@kyosushi.mx`

Y en SQL Editor ejecuta:
```sql
update public.profiles set kitchen_branch='zakia'
where id=(select id from auth.users where email='zakia@kyosushi.mx');

update public.profiles set kitchen_branch='milenio'
where id=(select id from auth.users where email='milenio@kyosushi.mx');
```

Ambas entran desde `/modococina`. RLS hace que cada cuenta solo pueda leer y actualizar pedidos de su propia sucursal. Los pedidos nuevos nacen en `preparing` automáticamente.
