# KYO v18 — Rewards directo al carrito

En tu Supabase actual ejecuta una sola vez:

`supabase/migrate-v18-rewards-directo-carrito.sql`

Cambios:
- Se elimina visualmente "Beneficios guardados".
- 250 puntos: 4 Spring Rolls se agregan directo al carrito.
- Si los quitas del carrito antes de ordenar, se devuelven 250 puntos.
- Reto de 6 pedidos: abre los productos de la subcategoría Clásicos.
- El cliente elige un rollo y todas sus personalizaciones son gratis.
- Si quita ese rollo del carrito antes de ordenar, se devuelven los 6 sellos.
- Supabase valida que el reward de 6 pedidos sea realmente un producto de Clásicos.
