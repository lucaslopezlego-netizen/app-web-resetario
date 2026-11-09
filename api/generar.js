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

  const modelos = process.env.GEMINI_MODEL ? [process.env.GEMINI_MODEL, ...core.MODELOS] : core.MODELOS;

  try {
    const { plan, modelo } = await core.generarConGemini({
      apiKey, datos, extra: core.sanearExtra(body.extra), modelos: [...new Set(modelos)], timeoutMs: 50000
    });
    return res.status(200).json({ plan, modelo });
  } catch (err) {
    const status = err && err.status === 429 ? 429 : 502;
    return res.status(status).json({ error: (err && err.message) || "Error al generar el menú." });
  }
};
