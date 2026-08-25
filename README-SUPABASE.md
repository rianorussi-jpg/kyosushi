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

## Actualización v6 (Rewards + Registros)
Si ya venías usando la v5, no vuelvas a ejecutar todo `schema.sql`. En Supabase > SQL Editor ejecuta solamente:

`supabase/migrate-v6-rewards-registros.sql`

Esta migración agrega la tarjeta de 6 pedidos, canjes de Rewards y protege puntos/sellos para que no puedan alterarse desde el navegador. La sección Registros del panel usa la tabla de pedidos existente y no requiere otra tabla.

## Actualización v7 — Rewards en carrito
Si ya tienes instalada la v6, ejecuta en **Supabase > SQL Editor**:

`supabase/migrate-v7-reward-cart.sql`

Esto permite que un voucher de **4 Spring Rolls** viaje en el carrito con precio `$0`, sea validado en el servidor y se marque como usado únicamente cuando el pedido se crea correctamente.

## v10 — Personalizaciones reutilizables
Si vienes de la v9, ejecuta una sola vez `supabase/migrate-v10-personalizaciones.sql` en Supabase > SQL Editor.
Después, en Panel > Menú > Nuevo/Editar producto puedes crear plantillas reutilizables (elegir una, marcar varias o elegir cantidad), con opciones gratis o con costo, y asignarlas a múltiples productos.

## Actualización v13 — categorías, subcategorías y plantillas editables
Si vienes de la v12, ejecuta una sola vez en Supabase SQL Editor:

`supabase/migrate-v13-categorias-subcategorias.sql`

Esto agrega jerarquía de categorías y el campo de subcategoría de producto. También crea como ejemplo dentro de **Rollos**: Clásicos, Tempurizados, Empanizados y Especiales.

En Panel → Menú → Categorías y subcategorías puedes crear, renombrar, ordenar, ocultar o eliminar categorías. Al editar/agregar un producto aparecerá el selector de subcategoría cuando la categoría elegida tenga alguna.

Las plantillas de personalización existentes ahora tienen botón **Editar** dentro del editor de producto. Al cambiar una plantilla compartida, el cambio se refleja en todos los productos que la usan.
