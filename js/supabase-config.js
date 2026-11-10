/**
 * Eco Menú — Conexión con Supabase (cuentas en todos tus dispositivos).
 *
 * Pega aquí los datos de tu proyecto: Supabase → Project Settings → API.
 *   url:     "Project URL", por ejemplo https://abcdefgh.supabase.co
 *   anonKey: clave "anon public" (o "publishable").
 *
 * Estos dos valores son PÚBLICOS por diseño: van en el navegador de todos los visitantes.
 * Los datos quedan protegidos por las reglas de seguridad de supabase/schema.sql
 * (cada persona solo puede leer y escribir lo suyo). Nunca pongas aquí la clave "service_role".
 *
 * Si los dejas vacíos, la app usa cuentas guardadas solo en este dispositivo.
 */
window.ECOMENU_SUPABASE = window.ECOMENU_SUPABASE || {
  url: "https://dhwduiwkyroepfhgykze.supabase.co",
  anonKey: "sb_publishable_3vev9eUWJwyJFLXgdd5NiQ_RdxxErbc" // clave pública (publishable): segura en el código, protegida por RLS
};
