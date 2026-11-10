/**
 * Eco Menú — Núcleo compartido entre el navegador y la función de Vercel (api/generar.js).
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

  /**
   * Orden de preferencia. Si uno falla por saturación o no existe, se prueba el siguiente.
   * Primero el ligero: con recetas sencillas responde en 5–15 s (flash tardaba 30–45 s y Vercel corta a los 60 s).
   */
  const MODELOS = ["gemini-3.1-flash-lite", "gemini-3.5-flash", "gemini-flash-lite-latest"];

  const COMIDAS = ["desayuno", "almuerzo", "cena"];
  const NOMBRES_DIAS = ["lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo"];

  const RECETA_SCHEMA = {
    type: "OBJECT",
    properties: {
      tipo: { type: "STRING", enum: COMIDAS },
      platillo: { type: "STRING" },
      descripcion: { type: "STRING" },
      tiempo_preparacion_min: { type: "INTEGER" },
      porciones: { type: "INTEGER" },
      costo: { type: "NUMBER" },
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
    required: ["tipo", "platillo", "tiempo_preparacion_min", "porciones", "costo", "ingredientes", "pasos"]
  };

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
            costo_dia: { type: "NUMBER" },
            comidas: { type: "ARRAY", items: RECETA_SCHEMA }
          },
          required: ["dia", "costo_dia", "comidas"]
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

  /** Devuelve las comidas elegidas en orden del día. Acepta el formato antiguo { comida: "almuerzo" }. */
  function sanearComidas(d = {}) {
    const elegidas = Array.isArray(d.comidas) ? d.comidas : d.comida ? [d.comida] : [];
    const validas = COMIDAS.filter((c) => elegidas.includes(c));
    return validas.length ? validas : ["almuerzo"];
  }

  /** Días de la semana elegidos (0 = lunes … 6 = domingo), sin repetir y en orden. Acepta el formato antiguo { dias: 3 }. */
  function sanearDiasSemana(d = {}) {
    const elegidos = Array.isArray(d.diasSemana)
      ? [...new Set(d.diasSemana.map((x) => Math.round(Number(x))).filter((x) => x >= 0 && x <= 6))].sort((a, b) => a - b)
      : [];
    if (elegidos.length) return elegidos;
    const n = Math.round(num(d.dias, 1, 7, 3));
    return Array.from({ length: n }, (_, i) => i);
  }

  const listaNatural = (arr) => arr.length > 1 ? `${arr.slice(0, -1).join(", ")} y ${arr[arr.length - 1]}` : (arr[0] || "");

  function sanearDatos(d = {}) {
    const diasSemana = sanearDiasSemana(d);
    return {
      presupuesto: Math.round(num(d.presupuesto, 0.01, 1e9, 0) * 100) / 100,
      moneda: /^[A-Z]{3}$/.test(d.moneda) ? d.moneda : "USD",
      diasSemana,
      dias: diasSemana.length,
      personas: Math.round(num(d.personas, 1, 12, 2)),
      comidas: sanearComidas(d),
      gustos: lista(d.gustos),
      alergias: lista(d.alergias),
      notas: String(d.notas ?? "").slice(0, 500).trim()
    };
  }

  function sanearExtra(e = {}) {
    return {
      feedback: String(e.feedback ?? "").slice(0, 600),
      evitar: lista(e.evitar, 10, 80),
      diaNumero: e.diaNumero ? Math.round(num(e.diaNumero, 1, 7, 1)) : 0,
      comidaTipo: COMIDAS.includes(e.comidaTipo) ? e.comidaTipo : ""
    };
  }

  /* ---------------- Prompts ---------------- */
  function construirSystemPrompt() {
    return [
      "Eres Eco Menú, un cocinero casero experto en comida económica y sencilla de todos los días, y en optimizar presupuestos de compra.",
      "Tu tarea es crear un menú diario con una receta por cada comida pedida (desayuno, almuerzo y/o cena), ajustándote ESTRICTAMENTE al presupuesto y respetando SIEMPRE las alergias y restricciones.",
      "",
      "BASE DE PRECIOS DE REFERENCIA (en USD, por la unidad indicada en cada clave):",
      JSON.stringify(PRECIOS, null, 2),
      "",
      "REGLAS OBLIGATORIAS:",
      "1. Usa los precios de referencia para calcular el costo. Para ingredientes que no estén en la lista, estima un precio realista y económico.",
      "2. 'precio_estimado' es el costo proporcional de la cantidad usada (ej. 250 g de arroz a 1.50/kg = 0.38), no el del paquete completo.",
      "3. Si la moneda no es USD, convierte los precios con un tipo de cambio aproximado actual y expresa TODOS los montos en esa moneda.",
      "4. 'costo' de cada receta = suma de sus precio_estimado. 'costo_dia' = suma de los 'costo' de sus comidas. 'costo_total' = suma de todos los costo_dia.",
      "5. 'costo_total' NUNCA puede superar el presupuesto. Si es ajustado, usa ingredientes baratos (legumbres, huevo, arroz, verduras de temporada) y reutiliza ingredientes entre días.",
      "6. PROHIBIDO incluir ingredientes que contengan o deriven de un alérgeno indicado (lactosa → leche, queso, mantequilla, crema; gluten → trigo, pasta común, pan común, harina de trigo).",
      "7. Prioriza los gustos del usuario y varía los platillos entre días. El desayuno debe ser típico de desayuno (avena, huevos, pan, fruta, arepas, etc.); el almuerzo es la comida más completa; la cena es más ligera que el almuerzo.",
      "8. Las cantidades son para el número de porciones indicado. Usa entre 3 y 5 pasos cortos y claros (una acción por paso); si un paso tiene un tiempo de cocción, indícalo en minutos (ej. 'Cocina 15 minutos'). Reparte el presupuesto con sentido: el almuerzo suele costar más que el desayuno.",
      "9. Asume que el usuario tiene sal y agua; todo lo demás debe costearse.",
      "10. RECETAS SENCILLAS: platos caseros y conocidos que cualquiera puede preparar en una cocina básica (hornalla y una olla o sartén). Máximo 6 ingredientes por receta sin contar sal y agua, todos fáciles de conseguir en un mercado de barrio. Nada de técnicas de restaurante (reducciones, emulsiones, marinados largos, masas caseras, baño maría), ni ingredientes difíciles o caros (quinoa, salmón, hongos exóticos, quesos especiales, salsas importadas).",
      "11. TIEMPOS: desayuno de 15 minutos o menos; almuerzo de 35 minutos o menos; cena de 25 minutos o menos. Prefiere platos de una sola olla o sartén y evita usar horno salvo que sea imprescindible.",
      "12. NOMBRES SIMPLES: nombra el plato como se dice en casa (ej. 'Arroz con huevo y tomate', 'Lentejas con papa', 'Fideos con salsa de tomate'), sin palabras rebuscadas como 'gourmet', 'reducción', 'confitado', 'al aroma de' o 'sobre cama de'.",
      "13. Responde ÚNICAMENTE con JSON válido según el esquema, en español con ortografía correcta (incluidas las tildes: preparación, maíz, limón)."
    ].join("\n");
  }

  function construirUserPrompt(d, extra = {}) {
    const unaReceta = extra.diaNumero > 0;
    const comidas = unaReceta && extra.comidaTipo ? [extra.comidaTipo] : d.comidas;
    const lineas = [
      `Presupuesto ${unaReceta ? "disponible para esta receta" : "total"}: ${d.presupuesto} ${d.moneda}`,
      unaReceta
        ? `Día: ${NOMBRES_DIAS[d.diasSemana[0]]}`
        : `Días a planificar (${d.dias}): ${listaNatural(d.diasSemana.map((i) => NOMBRES_DIAS[i]))}`,
      `Comidas de cada día, en este orden: ${comidas.join(", ")}`,
      `Porciones por receta (personas): ${d.personas}`,
      `Gustos / preferencias: ${d.gustos.length ? d.gustos.join(", ") : "sin preferencias específicas"}`,
      `Alergias / restricciones (PROHIBIDAS): ${d.alergias.length ? d.alergias.join(", ") : "ninguna"}`
    ];
    if (d.notas) lineas.push(`Notas del usuario: ${d.notas}`);
    lineas.push("");
    if (unaReceta) {
      lineas.push(`Genera exactamente 1 día con 'dia' = ${extra.diaNumero} y una sola comida de tipo "${comidas[0]}". Debe ser un platillo DISTINTO a estos: ${extra.evitar.join("; ") || "ninguno"}.`);
    } else {
      const total = d.dias * comidas.length;
      const orden = d.diasSemana.map((i, k) => `${k + 1} = ${NOMBRES_DIAS[i]}`).join(", ");
      lineas.push(`Genera exactamente ${d.dias} día(s), numerados del 1 al ${d.dias} (${orden}). Si los días no son seguidos, puedes aprovechar sobras solo entre días cercanos. Cada día lleva en 'comidas' exactamente ${comidas.length} receta(s), una por tipo (${comidas.join(", ")}), en ese orden. Son ${total} recetas en total y el presupuesto debe alcanzar para todas.`);
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
  async function generarConGemini({ apiKey, datos, extra = {}, modelos = MODELOS, timeoutMs = 120000, primeroMs, limite, onModelo }) {
    const d = sanearDatos(datos);
    const e = sanearExtra(extra);
    const systemPrompt = construirSystemPrompt();
    const userPrompt = construirUserPrompt(d, e);
    let ultimo;
    for (const [i, model] of modelos.entries()) {
      // Con "limite" (hora tope absoluta) se reparte el tiempo para que siempre quede margen para el siguiente modelo.
      let espera = i === 0 && primeroMs ? Math.min(timeoutMs, primeroMs) : timeoutMs;
      if (limite) {
        const queda = limite - Date.now() - 1500;
        if (queda < 6000) break;
        espera = Math.min(espera, queda);
      }
      try {
        if (onModelo) onModelo(model);
        const plan = await llamarModelo({ apiKey, model, systemPrompt, userPrompt, timeoutMs: espera });
        return { plan, modelo: model };
      } catch (err) {
        ultimo = err;
        if (!(err instanceof EcoError) || !err.reintentable) throw err;
      }
    }
    throw ultimo || new EcoError("Gemini tardó demasiado en responder. Vuelve a intentarlo.", { reintentable: true });
  }

  const api = {
    MODELOS, COMIDAS, NOMBRES_DIAS, RESPONSE_SCHEMA, EcoError,
    sanearDatos, sanearComidas, sanearDiasSemana, sanearExtra, construirSystemPrompt, construirUserPrompt,
    parsearJSON, generarConGemini
  };

  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.EcoCore = api;
})(typeof window !== "undefined" ? window : globalThis);
