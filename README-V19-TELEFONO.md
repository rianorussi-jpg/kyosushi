# KYO v19 — teléfono de cliente

Ejecuta una sola vez:
`supabase/migrate-v19-registro-telefono.sql`

Registro:
- Nombre
- País/código telefónico (México +52 por defecto)
- Número nacional obligatorio de exactamente 10 dígitos
- Correo
- Contraseña
- Confirmar contraseña

El teléfono se guarda en `profiles.phone`.

Modo Cocina y Panel muestran el teléfono del cliente en los pedidos activos.
