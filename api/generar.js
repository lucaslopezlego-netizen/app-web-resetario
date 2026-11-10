/**
 * Función serverless de Vercel: POST /api/generar
 * Guarda la API Key en el servidor (variable de entorno GEMINI_API_KEY),
 * así no queda expuesta en el navegador de los visitantes.
 *
 * Cuerpo: { datos: {presupuesto, moneda, dias, personas, comida, gustos, alergias, notas}, extra?: {feedback, evitar, diaNumero} }
 * Respuesta: { plan, modelo } o { error }
 */
const core = require("../js/ecomenu-core.js");

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Usa POST." });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "Falta la variable GEMINI_API_KEY en la configuración de Vercel." });
  }

  let body = req.body;
  if (typeof body === "string") {
    try { body = JSON.parse(body || "{}"); } catch { return res.status(400).json({ error: "JSON inválido." }); }
  }
  body = body || {};

  const datos = core.sanearDatos(body.datos);
  if (!(datos.presupuesto > 0)) return res.status(400).json({ error: "El presupuesto debe ser mayor que 0." });

  // Vercel corta la función a los 60 s (vercel.json). Se deja margen para responder.
  const inicio = Date.now();
  const limite = inicio + 55000;
  // "rapido": reintento pedido por la app tras una demora; va directo a los modelos ligeros.
  const rapido = !!(body.extra && body.extra.rapido);
  const base = rapido ? ["gemini-flash-lite-latest", "gemini-3.5-flash-lite", "gemini-3.1-flash-lite"] : core.MODELOS;
  const modelos = [...new Set(process.env.GEMINI_MODEL && !rapido ? [process.env.GEMINI_MODEL, ...base] : base)];

  try {
    const { plan, modelo } = await core.generarConGemini({
      apiKey, datos, extra: core.sanearExtra(body.extra), modelos,
      timeoutMs: 50000, primeroMs: rapido ? 45000 : 32000, limite
    });
    return res.status(200).json({ plan, modelo });
  } catch (err) {
    const status = err && err.status === 429 ? 429 : 502;
    console.error("generar:", err && err.message, `${Date.now() - inicio} ms`);
    return res.status(status).json({ error: (err && err.message) || "Error al generar el menú.", reintentable: !!(err && err.reintentable) });
  }
};
