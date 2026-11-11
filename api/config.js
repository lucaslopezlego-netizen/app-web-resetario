/**
 * Vercel: GET /api/config
 * Entrega a la página SOLO valores públicos: la URL de Supabase y su clave pública (anon / publishable),
 * que la integración Supabase ↔ Vercel guarda como variables de entorno. Nunca entrega la clave service_role.
 * También indica si hay clave de Gemini en el servidor (sin revelarla).
 */
function esClaveSecreta(k) {
  if (!k) return false;
  if (/^sb_secret_/.test(k)) return true;
  const partes = k.split(".");
  if (partes.length === 3) {
    try {
      const payload = JSON.parse(Buffer.from(partes[1], "base64url").toString("utf8"));
      return payload.role === "service_role";
    } catch { return false; }
  }
  return false;
}

const claveGemini = require("./_gemini-clave.js");

module.exports = function handler(req, res) {
  const env = process.env;
  const url = env.SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL || "";
  const candidatas = [
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, env.SUPABASE_PUBLISHABLE_KEY,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY, env.SUPABASE_ANON_KEY
  ];
  const anonKey = candidatas.find((k) => k && !esClaveSecreta(k)) || "";

  res.setHeader("Cache-Control", "public, max-age=300");
  res.status(200).json({
    supabase: url && anonKey ? { url, anonKey } : null,
    gemini: !!claveGemini()
  });
};
