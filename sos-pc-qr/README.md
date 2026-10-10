# SOS PC QR — Mesa de ayuda web

Aplicación estática con HTML, CSS, JavaScript y Supabase. Imágenes ilustrativas de soporte en Inicio y por equipo, registro público, seguimiento privado por token, panel técnico, inventario e historial.

## Instalación
1. Crea un proyecto Supabase en https://supabase.com y abre **SQL Editor**.
2. Ejecuta `schema.sql` completo. Si lo ejecutas varias veces, algunas políticas ya existentes generarán errores: está pensado para una base nueva.
3. En **Authentication > Users**, crea los usuarios técnicos/administradores (desactiva registro público si no se necesita).
4. Copia el UUID de cada usuario y ejecuta desde SQL Editor (sustituyendo UUID):
   `insert into public.profiles(id,nombre,rol) values ('UUID','Administrador','admin');`
   Para un técnico usa rol `tecnico`.
5. En `config.js`, reemplaza `SUPABASE_URL` y `SUPABASE_ANON_KEY` con **Project URL** y la **publishable key** (o legacy anon key). **Nunca uses `service_role` ni una clave secreta**.
6. Publica los archivos en un hosting HTTPS (Netlify, Vercel, GitHub Pages) o inicia un servidor local en la carpeta: `python -m http.server 8080`, luego abre `http://localhost:8080`.
7. Ingresa al **Panel técnico** para registrar ubicaciones y equipos. Puedes imprimir las imágenes ilustrativas; no son códigos QR.
8. Usa **Crear reporte** para reportar una falla, guarda el enlace privado del ticket y realiza el seguimiento.

## Modelo de permisos
- Visitantes anónimos: leen el catálogo de equipos/ubicaciones; crean tickets mediante RPC; consultan **solo con número y token**.
- Técnicos: ven y actualizan tickets y su historial.
- Administradores: lo anterior, más creación de ubicaciones y equipos.
- No se permiten inserts directos de tickets públicos ni lectura anónima de datos personales.

## Consideraciones antes de producción
- La función pública de reportes necesita protección contra abuso (CAPTCHA, rate limiting o Edge Function con Turnstile). En este prototipo no hay limitación de envíos.
- El enlace privado del ticket actúa como credencial: no compartirlo; se muestra la descripción y solución a quien lo posea.
- El registro de fotos, notificaciones automáticas, exportación PDF, búsqueda/paginación y métricas históricas son ampliaciones pendientes.
- Para equipos institucionales, evalúa limitar la lectura pública del inventario y permitir consultas filtradas a través de una RPC.
- No se incluye información simulada ni usuarios precargados.
- La aplicación requiere internet para cargar bibliotecas desde CDN y conectarse a Supabase.
