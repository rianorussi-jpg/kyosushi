# KYO v21 — Rediseño visual

Esta versión parte de v20 y conserva su lógica, Supabase, rewards, pedido mínimo,
Pickup/Delivery, Panel y Modo Cocina.

El cambio principal es una nueva dirección visual KYO:
- paleta marfil, negro carbón, rojo KYO y acentos cálidos;
- home más editorial y de restaurante;
- menú y tarjetas de producto más limpios;
- navegación inferior flotante;
- carrito, checkout, pedidos, rewards, perfil, login y success unificados;
- Panel y Modo Cocina refinados visualmente.

No requiere SQL nuevo respecto a v20.
Si todavía no ejecutaste la migración v20, usa:
supabase/migrate-v20-pickup-minimo-reward-config.sql
