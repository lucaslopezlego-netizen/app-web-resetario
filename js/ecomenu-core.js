/**
 * EcoMenú IA — Núcleo compartido entre el navegador y la función de Vercel (api/generar.js).
 * Contiene: esquema de respuesta, prompts, saneamiento de datos y llamada a Gemini
 * con cambio automático de modelo si uno está saturado o no disponible.
 */
(function (root) {
  "use strict";

  const PRECIOS =
    typeof PRECIOS_REFERENCIA !== "undefined"
      ? PRECIOS_REFERENCIA // eslint-disable-line no-undef
      : require("./precios.js").PRECIOS_REFERENCIA;

  const API_BASE = "https://generativelanguage.googleapis.com/v1beta/models";

  /** Orden de preferencia. Si uno falla por saturación o no existe, se prueba el siguiente. */
  const MODELOS = ["gemini-3.5-flash", "gemini-3.1-flash-lite", "gemini-flash-lite-latest"];

  const COMIDAS = ["desayuno", "almuerzo", "cena"];

  const RESPONSE_SCHEMA = {
    type: "OBJECT",
    properties: {
      resumen: {
        type: "OBJECT",
        properties: {
          presupuesto_total: { type: "NUMBER" },
          costo_total: { type: "NUMBER" },
          moneda: { type: "STRING" },
          comentario: { type: "STRING" }
        },
        required: ["presupuesto_total", "costo_total", "moneda", "comentario"]
      },
      dias: {
        type: "ARRAY",
        items: {
          type: "OBJECT",
          properties: {
            dia: { type: "INTEGER" },
            platillo: { type: "STRING" },
            descripcion: { type: "STRING" },
            tiempo_preparacion_min: { type: "INTEGER" },
            porciones: { type: "INTEGER" },
            costo_dia: { type: "NUMBER" },
            ingredientes: {
              type: "ARRAY",
              items: {
                type: "OBJECT",
                properties: {
                  nombre: { type: "STRING" },
                  cantidad: { type: "STRING" },
                  precio_estimado: { type: "NUMBER" }
                },
                required: ["nombre", "cantidad", "precio_estimado"]
              }
            },
            pasos: { type: "ARRAY", items: { type: "STRING" } },
            consejo_ahorro: { type: "STRING" }
          },
          required: ["dia", "platillo", "tiempo_preparacion_min", "porciones", "costo_dia", "ingredientes", "pasos"]
        }
      }
    },
    required: ["resumen", "dias"]
  };

  /* ---------------- Saneamiento (también protege la función del servidor) ---------------- */
  const num = (v, min, max, def) => {
    const n = typeof v === "number" ? v : parseFloat(String(v ?? "").replace(",", "."));
    return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : def;
  };
  const lista = (v, maxItems = 15, maxLen = 60) =>
    (Array.isArray(v) ? v : [])
      .map((x) => String(x ?? "").replace(/\s+/g, " ").trim().slice(0, maxLen))
      .filter(Boolean)
      .slice(0, maxItems);

  function sanearDatos(d = {}) {
    return {
      presupuesto: Math.round(num(d.presupuesto, 0.01, 1e9, 0) * 100) / 100,
      moneda: /^[A-Z]{3}$/.test(d.moneda) ? d.moneda : "USD",
      dias: Math.round(num(d.dias, 1, 7, 3)),
      personas: Math.round(num(d.personas, 1, 12, 2)),
      comida: COMIDAS.includes(d.comida) ? d.comida : "almuerzo",
      gustos: lista(d.gustos),
      alergias: lista(d.alergias),
      notas: String(d.notas ?? "").slice(0, 500).trim()
    };
  }

  function sanearExtra(e = {}) {
    return {
      feedback: String(e.feedback ?? "").slice(0, 600),
      evitar: lista(e.evitar, 10, 80),
      diaNumero: e.diaNumero ? Math.round(num(e.diaNumero, 1, 7, 1)) : 0
    };
  }

  /* ---------------- Prompts ---------------- */
  function construirSystemPrompt() {
    return [
      "Eres EcoMenú IA, un chef nutricionista experto en cocina económica latinoamericana y en optimizar presupuestos de compra.",
      "Tu tarea es crear un menú con UNA receta por día, ajustándote ESTRICTAMENTE al presupuesto y respetando SIEMPRE las alergias y restricciones.",
      "",
      "BASE DE PRECIOS DE REFERENCIA (en USD, por la unidad indicada en cada clave):",
      JSON.stringify(PRECIOS, null, 2),
      "",
      "REGLAS OBLIGATORIAS:",
      "1. Usa los precios de referencia para calcular el costo. Para ingredientes que no estén en la lista, estima un precio realista y económico.",
      "2. 'precio_estimado' es el costo proporcional de la cantidad usada (ej. 250 g de arroz a 1.50/kg = 0.38), no el del paquete completo.",
      "3. Si la moneda no es USD, convierte los precios con un tipo de cambio aproximado actual y expresa TODOS los montos en esa moneda.",
      "4. 'costo_dia' = suma de los precio_estimado del día. 'costo_total' = suma de todos los costo_dia.",
      "5. 'costo_total' NUNCA puede superar el presupuesto. Si es ajustado, usa ingredientes baratos (legumbres, huevo, arroz, verduras de temporada) y reutiliza ingredientes entre días.",
      "6. PROHIBIDO incluir ingredientes que contengan o deriven de un alérgeno indicado (lactosa → leche, queso, mantequilla, crema; gluten → trigo, pasta común, pan común, harina de trigo).",
      "7. Prioriza los gustos del usuario y varía los platillos entre días.",
      "8. Las cantidades son para el número de porciones indicado. Los pasos deben ser claros y prácticos; si un paso tiene un tiempo de cocción, indícalo en minutos (ej. 'Cocina 15 minutos').",
      "9. Asume que el usuario tiene sal y agua; todo lo demás debe costearse.",
      "10. Responde ÚNICAMENTE con JSON válido según el esquema, en español con ortografía correcta (incluidas las tildes: preparación, maíz, limón)."
    ].join("\n");
  }

  function construirUserPrompt(d, extra = {}) {
    const unDia = extra.diaNumero > 0;
    const lineas = [
      `Presupuesto ${unDia ? "disponible para este día" : "total"}: ${d.presupuesto} ${d.moneda}`,
      `Número de días: ${unDia ? 1 : d.dias}`,
      `Comida a planificar cada día: ${d.comida}`,
      `Porciones por receta (personas): ${d.personas}`,
      `Gustos / preferencias: ${d.gustos.length ? d.gustos.join(", ") : "sin preferencias específicas"}`,
      `Alergias / restricciones (PROHIBIDAS): ${d.alergias.length ? d.alergias.join(", ") : "ninguna"}`
    ];
    if (d.notas) lineas.push(`Notas del usuario: ${d.notas}`);
    lineas.push("");
    if (unDia) {
      lineas.push(`Genera exactamente 1 día, con 'dia' = ${extra.diaNumero}. Debe ser un platillo DISTINTO a estos: ${extra.evitar.join("; ") || "ninguno"}.`);
    } else {
      lineas.push(`Genera exactamente ${d.dias} día(s), numerados del 1 al ${d.dias}.`);
    }
    lineas.push(`En 'resumen.presupuesto_total' devuelve ${d.presupuesto} y en 'resumen.moneda' "${d.moneda}". En 'resumen.comentario' explica en 1 o 2 frases cómo se optimizó el presupuesto.`);
    if (extra.feedback) lineas.push("", "CORRECCIÓN IMPORTANTE:", extra.feedback);
    return lineas.join("\n");
  }

  /* ---------------- Llamada a Gemini ---------------- */
  class EcoError extends Error {
    constructor(message, { status = 0, reintentable = false } = {}) {
      super(message);
      this.name = "EcoError";
      this.status = status;
      this.reintentable = reintentable;
    }
  }

  function parsearJSON(texto) {
    const limpio = String(texto).replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "").trim();
    try {
      return JSON.parse(limpio);
    } catch {
      const a = limpio.indexOf("{"), b = limpio.lastIndexOf("}");
      if (a >= 0 && b > a) {
        try { return JSON.parse(limpio.slice(a, b + 1)); } catch { /* sigue */ }
      }
      throw new EcoError("La respuesta de la IA llegó incompleta. Vuelve a intentarlo.", { reintentable: true });
    }
  }

  async function llamarModelo({ apiKey, model, systemPrompt, userPrompt, timeoutMs }) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    let res;
    try {
      res = await fetch(`${API_BASE}/${encodeURIComponent(model)}:generateContent`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: systemPrompt }] },
          contents: [{ role: "user", parts: [{ text: userPrompt }] }],
          generationConfig: { temperature: 0.6, responseMimeType: "application/json", responseSchema: RESPONSE_SCHEMA }
        }),
        signal: ctrl.signal
      });
    } catch (err) {
      if (err && err.name === "AbortError") throw new EcoError(`El modelo ${model} tardó demasiado.`, { reintentable: true });
      throw new EcoError("No se pudo conectar con Gemini. Revisa tu conexión a internet.", { reintentable: true });
    } finally {
      clearTimeout(timer);
    }

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const msg = data?.error?.message || res.statusText || "";
      const s = res.status;
      if (s === 400 && /api key/i.test(msg)) throw new EcoError("La API Key no es válida. Revísala en Ajustes.", { status: s });
      if (s === 401 || s === 403) throw new EcoError("La API Key no tiene permiso para usar Gemini.", { status: s });
      if (s === 404) throw new EcoError(`El modelo ${model} no está disponible.`, { status: s, reintentable: true });
      if (s === 429) throw new EcoError("Se alcanzó el límite de uso gratuito. Espera un minuto y vuelve a intentarlo.", { status: s, reintentable: true });
      if (s >= 500) throw new EcoError("Gemini está saturado en este momento. Vuelve a intentarlo en unos segundos.", { status: s, reintentable: true });
      throw new EcoError(`Gemini respondió con un error (${s}): ${msg}`, { status: s });
    }

    const cand = data?.candidates?.[0];
    if (!cand) {
      const r = data?.promptFeedback?.blockReason;
      throw new EcoError(r ? `Gemini bloqueó la solicitud (${r}).` : "Gemini no devolvió resultados.", { reintentable: !r });
    }
    const texto = (cand.content?.parts || []).map((p) => p.text || "").join("").trim();
    if (!texto) throw new EcoError("Gemini devolvió una respuesta vacía.", { reintentable: true });
    return parsearJSON(texto);
  }

  /**
   * Genera el plan probando los modelos en orden.
   * @returns {Promise<{plan: object, modelo: string}>}
   */
  async function generarConGemini({ apiKey, datos, extra = {}, modelos = MODELOS, timeoutMs = 60000, onModelo }) {
    const d = sanearDatos(datos);
    const e = sanearExtra(extra);
    const systemPrompt = construirSystemPrompt();
    const userPrompt = construirUserPrompt(d, e);
    let ultimo;
    for (const model of modelos) {
      try {
        if (onModelo) onModelo(model);
        const plan = await llamarModelo({ apiKey, model, systemPrompt, userPrompt, timeoutMs });
        return { plan, modelo: model };
      } catch (err) {
        ultimo = err;
        if (!(err instanceof EcoError) || !err.reintentable) throw err;
      }
    }
    throw ultimo || new EcoError("No se pudo generar el menú.");
  }

  const api = {
    MODELOS, RESPONSE_SCHEMA, EcoError,
    sanearDatos, sanearExtra, construirSystemPrompt, construirUserPrompt,
    parsearJSON, generarConGemini
  };

  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.EcoCore = api;
})(typeof window !== "undefined" ? window : globalThis);
