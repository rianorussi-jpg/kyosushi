# KYO v20

Ejecuta una sola vez en tu Supabase actual:

`supabase/migrate-v20-pickup-minimo-reward-config.sql`

Incluye:
- Pickup: Preparando → Listo para recoger → Entregado.
- Delivery conserva Preparando → En camino → Entregado.
- Pedido mínimo inicial de $200.
- Panel > Configuración permite cambiar el pedido mínimo.
- Panel > Configuración permite elegir el producto del reward por puntos y su costo en puntos.
- El backend vuelve a validar el pedido mínimo y el producto del reward.
