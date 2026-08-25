# KYO v18.1 — fix reward de 6 pedidos

El selector del frontend reconocía la subcategoría por nombre (`Clásicos`), pero la función SQL
validaba únicamente que el `slug` fuera exactamente `clasicos`. Si tu subcategoría tiene otro slug,
por ejemplo uno generado previamente, el cliente podía elegir el rollo pero Supabase rechazaba el pedido.

Ejecuta una sola vez:
`supabase/migrate-v18-1-fix-rollos-clasicos.sql`

No necesitas volver a correr v18.
