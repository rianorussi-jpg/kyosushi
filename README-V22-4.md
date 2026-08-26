# KYO v22.4

Cambios:
- Cada sección comienza desde arriba al cambiar de ruta.
- Perfil sin cuenta: tarjetas legibles en el tema oscuro.
- Login y registro: inputs a 16px para evitar el zoom automático de iPhone/Safari.
- Preferencias abre una página real para cambiar nombre, teléfono, correo y eliminar cuenta.

IMPORTANTE: ejecuta una sola vez:
supabase/migrate-v22-4-account-preferences.sql

La migración permite eliminar la cuenta conservando los pedidos históricos del restaurante, pero desligados de la cuenta eliminada.
