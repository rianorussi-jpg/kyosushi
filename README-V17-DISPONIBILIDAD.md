# KYO v17 — disponibilidad por sucursal

Antes de subir esta versión a producción, ejecuta una sola vez en Supabase:

`supabase/migrate-v17-disponibilidad-sucursal.sql`

Después:

- Panel > Menú > Productos por categoría muestra el menú agrupado.
- Cada producto tiene botones Zákia / Milenio para disponibilidad.
- Editar producto > Personalizaciones > Editar plantilla permite marcar cada opción disponible o no por sucursal.
- En la app del cliente se respeta la sucursal elegida en su dirección o pickup.
- El backend vuelve a validar la disponibilidad al crear el pedido.

No vuelvas a ejecutar todo `schema.sql` en tu base actual.
