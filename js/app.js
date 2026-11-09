/**
 * EcoMenú IA — Lógica principal.
 * - Captura del formulario (presupuesto, días, gustos, alergias).
 * - Construcción del prompt con PRECIOS_REFERENCIA.
 * - Llamada a la API de Gemini (Google AI Studio) con salida JSON estructurada.
 * - Validación del presupuesto y renderizado de resultados.
 */
(() => {
  "use strict";

  /* ------------------------------------------------------------------ */
  /* Configuración                                                       */
  /* ------------------------------------------------------------------ */
  const API_BASE = "https://generativelanguage.googleapis.com/v1beta/models";
  const STORAGE = { key: "ecomenu.apiKey", model: "ecomenu.model", form: "ecomenu.form" };
  const TIMEOUT_MS = 90_000;
  const MAX_REINTENTOS_PRESUPUESTO = 1;

  /* Esquema de respuesta (subconjunto OpenAPI que acepta Gemini). */
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

  /* ------------------------------------------------------------------ */
  /* Utilidades                                                          */
  /* ------------------------------------------------------------------ */
  const $ = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];

  const escapeHTML = (v) =>
    String(v ?? "").replace(/[&<>"']/g, (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

  const safeStorage = {
    get(k) { try { return localStorage.getItem(k); } catch { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch { /* sin almacenamiento */ } },
    del(k) { try { localStorage.removeItem(k); } catch { /* sin almacenamiento */ } }
  };

  const toNumber = (v, def = 0) => {
    const n = typeof v === "number" ? v : parseFloat(String(v).replace(",", "."));
    return Number.isFinite(n) ? n : def;
  };

  const round2 = (n) => Math.round(n * 100) / 100;

  function formatMoney(value, currency) {
    try {
      return new Intl.NumberFormat("es", { style: "currency", currency, maximumFractionDigits: 2 }).format(value);
    } catch {
      return `${currency} ${toNumber(value).toFixed(2)}`;
    }
  }

  /* ------------------------------------------------------------------ */
  /* Estado                                                              */
  /* ------------------------------------------------------------------ */
  const state = { gustos: [], alergias: [], planActual: null, generando: false };

  /* ------------------------------------------------------------------ */
  /* Panel de configuración                                              */
  /* ------------------------------------------------------------------ */
  const ui = {
    btnConfig: $("#btnConfig"),
    configPanel: $("#configPanel"),
    apiKey: $("#apiKey"),
    btnToggleKey: $("#btnToggleKey"),
    modelo: $("#modelo"),
    modeloCustom: $("#modeloCustom"),
    recordarKey: $("#recordarKey"),
    form: $("#formMenu"),
    presupuesto: $("#presupuesto"),
    moneda: $("#moneda"),
    dias: $("#dias"),
    personas: $("#personas"),
    comida: $("#comida"),
    notas: $("#notas"),
    modoDemo: $("#modoDemo"),
    btnGenerar: $("#btnGenerar"),
    status: $("#statusMsg"),
    errPresupuesto: $("#errPresupuesto"),
    resultados: $("#resultados"),
    resumen: $("#resumenContenido"),
    diasCont: $("#diasContenedor"),
    compras: $("#comprasContenido")
  };

  function toggleConfig(force) {
    const abrir = force ?? ui.configPanel.hidden;
    ui.configPanel.hidden = !abrir;
    ui.btnConfig.setAttribute("aria-expanded", String(abrir));
    if (abrir) ui.apiKey.focus();
  }

  function cargarConfig() {
    const key = safeStorage.get(STORAGE.key);
    if (key) { ui.apiKey.value = key; ui.recordarKey.checked = true; }
    const model = safeStorage.get(STORAGE.model);
    if (model) {
      if ([...ui.modelo.options].some((o) => o.value === model)) ui.modelo.value = model;
      else ui.modeloCustom.value = model;
    }
    actualizarBadgeKey();
  }

  function guardarConfig() {
    const key = ui.apiKey.value.trim();
    if (ui.recordarKey.checked && key) safeStorage.set(STORAGE.key, key);
    else safeStorage.del(STORAGE.key);
    safeStorage.set(STORAGE.model, modeloSeleccionado());
    actualizarBadgeKey();
    setStatus(key ? "Configuración guardada." : "Sin API Key: se usará el modo demo.", "ok");
    toggleConfig(false);
  }

  function actualizarBadgeKey() {
    ui.btnConfig.classList.toggle("has-key", !!ui.apiKey.value.trim());
  }

  const modeloSeleccionado = () => ui.modeloCustom.value.trim() || ui.modelo.value;

  ui.btnConfig.addEventListener("click", () => toggleConfig());
  ui.btnGuardarConfig = $("#btnGuardarConfig");
  ui.btnGuardarConfig.addEventListener("click", guardarConfig);
  $("#btnBorrarKey").addEventListener("click", () => {
    ui.apiKey.value = "";
    ui.recordarKey.checked = false;
    safeStorage.del(STORAGE.key);
    actualizarBadgeKey();
    setStatus("Clave borrada de este dispositivo.", "ok");
  });
  ui.btnToggleKey.addEventListener("click", () => {
    const visible = ui.apiKey.type === "text";
    ui.apiKey.type = visible ? "password" : "text";
    ui.btnToggleKey.setAttribute("aria-label", visible ? "Mostrar clave" : "Ocultar clave");
  });
  ui.apiKey.addEventListener("input", actualizarBadgeKey);

  /* ------------------------------------------------------------------ */
  /* Chips y etiquetas (gustos / alergias)                               */
  /* ------------------------------------------------------------------ */
  function renderTags(tipo) {
    const ul = $(`#${tipo}Tags`);
    ul.innerHTML = state[tipo]
      .map((t, i) => `<li class="tag"><span>${escapeHTML(t)}</span>
        <button type="button" class="tag-remove" data-tipo="${tipo}" data-index="${i}"
          aria-label="Quitar ${escapeHTML(t)}">×</button></li>`)
      .join("");
    // Sincroniza estado visual de chips sugeridos
    const grupo = tipo === "gustos" ? "#gustosSugeridos" : "#alergiasSugeridas";
    $$(`${grupo} .chip`).forEach((c) => {
      const activo = state[tipo].some((t) => t.toLowerCase() === c.dataset.value.toLowerCase());
      c.classList.toggle("active", activo);
      c.setAttribute("aria-pressed", String(activo));
    });
    guardarFormulario();
  }

  function agregarTag(tipo, valor) {
    const limpio = valor.trim().replace(/\s+/g, " ").slice(0, 60);
    if (!limpio) return;
    if (state[tipo].some((t) => t.toLowerCase() === limpio.toLowerCase())) return;
    if (state[tipo].length >= 15) { setStatus("Máximo 15 elementos por lista.", "warn"); return; }
    state[tipo].push(limpio);
    renderTags(tipo);
  }

  function quitarTag(tipo, valorOIndice) {
    const idx = typeof valorOIndice === "number"
      ? valorOIndice
      : state[tipo].findIndex((t) => t.toLowerCase() === valorOIndice.toLowerCase());
    if (idx >= 0) { state[tipo].splice(idx, 1); renderTags(tipo); }
  }

  function initTagInput(tipo) {
    const input = $(`#${tipo}Input`);
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === ",") {
        e.preventDefault();
        input.value.split(",").forEach((v) => agregarTag(tipo, v));
        input.value = "";
      } else if (e.key === "Backspace" && !input.value && state[tipo].length) {
        quitarTag(tipo, state[tipo].length - 1);
      }
    });
    // Al perder foco, agrega lo escrito para no perderlo
    input.addEventListener("blur", () => {
      if (input.value.trim()) { input.value.split(",").forEach((v) => agregarTag(tipo, v)); input.value = ""; }
    });
    input.closest(".tag-input").addEventListener("click", (e) => {
      if (e.target === e.currentTarget) input.focus();
    });
  }

  document.addEventListener("click", (e) => {
    const rm = e.target.closest(".tag-remove");
    if (rm) { quitarTag(rm.dataset.tipo, Number(rm.dataset.index)); return; }
    const chip = e.target.closest(".chip");
    if (chip) {
      const tipo = chip.closest("#gustosSugeridos") ? "gustos" : "alergias";
      const v = chip.dataset.value;
      if (state[tipo].some((t) => t.toLowerCase() === v.toLowerCase())) quitarTag(tipo, v);
      else agregarTag(tipo, v);
    }
  });

  initTagInput("gustos");
  initTagInput("alergias");

  /* ------------------------------------------------------------------ */
  /* Persistencia del formulario (comodidad)                             */
  /* ------------------------------------------------------------------ */
  function guardarFormulario() {
    safeStorage.set(STORAGE.form, JSON.stringify({
      presupuesto: ui.presupuesto.value, moneda: ui.moneda.value, dias: ui.dias.value,
      personas: ui.personas.value, comida: ui.comida.value, notas: ui.notas.value,
      gustos: state.gustos, alergias: state.alergias
    }));
  }

  function cargarFormulario() {
    try {
      const d = JSON.parse(safeStorage.get(STORAGE.form) || "null");
      if (!d) return;
      if (d.presupuesto) ui.presupuesto.value = d.presupuesto;
      ["moneda", "dias", "personas", "comida"].forEach((k) => { if (d[k]) ui[k].value = d[k]; });
      if (d.notas) ui.notas.value = d.notas;
      state.gustos = Array.isArray(d.gustos) ? d.gustos.slice(0, 15) : [];
      state.alergias = Array.isArray(d.alergias) ? d.alergias.slice(0, 15) : [];
    } catch { /* datos corruptos: ignorar */ }
  }

  ["presupuesto", "moneda", "dias", "personas", "comida", "notas"].forEach((k) =>
    ui[k].addEventListener("change", guardarFormulario));

  /* ------------------------------------------------------------------ */
  /* Prompt                                                              */
  /* ------------------------------------------------------------------ */
  function construirSystemPrompt() {
    return [
      "Eres EcoMenú IA, un chef nutricionista experto en cocina económica latinoamericana y en optimización de presupuestos de compra.",
      "Tu tarea es crear un menú con UNA receta por día, ajustándote ESTRICTAMENTE al presupuesto y respetando SIEMPRE las alergias y restricciones.",
      "",
      "BASE DE PRECIOS DE REFERENCIA (en USD, por la unidad indicada en cada clave):",
      JSON.stringify(PRECIOS_REFERENCIA, null, 2),
      "",
      "REGLAS OBLIGATORIAS:",
      "1. Usa los precios de referencia para calcular el costo. Para ingredientes que no estén en la lista, estima un precio realista y económico.",
      "2. 'precio_estimado' es el costo proporcional de la cantidad usada en la receta (ej. 250 g de arroz a 1.50/kg = 0.375 → 0.38), no el precio del paquete completo.",
      "3. Si la moneda indicada no es USD, convierte los precios de referencia a esa moneda con un tipo de cambio aproximado actual y expresa TODOS los montos en esa moneda.",
      "4. 'costo_dia' = suma exacta de los precio_estimado de ese día. 'costo_total' = suma exacta de todos los costo_dia.",
      "5. 'costo_total' NUNCA puede superar el presupuesto. Si es ajustado, elige ingredientes más baratos (legumbres, huevo, arroz, verduras de temporada) y reutiliza ingredientes entre días para evitar desperdicio.",
      "6. Está PROHIBIDO incluir cualquier ingrediente que contenga o derive de un alérgeno indicado (incluye trazas obvias, ej. lactosa → leche, queso, mantequilla, crema; gluten → trigo, pasta común, pan común, harina de trigo).",
      "7. Prioriza los gustos/preferencias del usuario y varía los platillos entre días.",
      "8. Las cantidades deben ser para el número de porciones indicado. Los pasos deben ser claros, numerables y prácticos.",
      "9. Puedes asumir que el usuario tiene sal y agua; todo lo demás debe costearse.",
      "10. Responde ÚNICAMENTE con JSON válido que siga el esquema solicitado, en español."
    ].join("\n");
  }

  function construirUserPrompt(d, feedback) {
    const lineas = [
      `Presupuesto total: ${d.presupuesto} ${d.moneda}`,
      `Número de días: ${d.dias}`,
      `Comida a planificar cada día: ${d.comida}`,
      `Porciones por receta (personas): ${d.personas}`,
      `Gustos / preferencias: ${d.gustos.length ? d.gustos.join(", ") : "sin preferencias específicas"}`,
      `Alergias / restricciones (PROHIBIDAS): ${d.alergias.length ? d.alergias.join(", ") : "ninguna"}`
    ];
    if (d.notas) lineas.push(`Notas adicionales del usuario: ${d.notas}`);
    lineas.push("", `Genera exactamente ${d.dias} día(s), numerados del 1 al ${d.dias}. En 'resumen.presupuesto_total' devuelve ${d.presupuesto} y en 'resumen.moneda' devuelve "${d.moneda}". En 'resumen.comentario' explica brevemente cómo se optimizó el presupuesto.`);
    if (feedback) lineas.push("", "CORRECCIÓN IMPORTANTE:", feedback);
    return lineas.join("\n");
  }

  /* ------------------------------------------------------------------ */
  /* Llamada a Gemini                                                    */
  /* ------------------------------------------------------------------ */
  async function llamarGemini({ apiKey, model, systemPrompt, userPrompt }) {
    const url = `${API_BASE}/${encodeURIComponent(model)}:generateContent`;
    const body = {
      systemInstruction: { parts: [{ text: systemPrompt }] },
      contents: [{ role: "user", parts: [{ text: userPrompt }] }],
      generationConfig: {
        temperature: 0.6,
        responseMimeType: "application/json",
        responseSchema: RESPONSE_SCHEMA
      }
    };

    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    let res;
    try {
      res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
        body: JSON.stringify(body),
        signal: ctrl.signal
      });
    } catch (err) {
      if (err.name === "AbortError") throw new Error("La IA tardó demasiado en responder. Inténtalo de nuevo.");
      throw new Error("No se pudo conectar con Gemini. Revisa tu conexión a internet.");
    } finally {
      clearTimeout(timer);
    }

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const msg = data?.error?.message || res.statusText;
      if (res.status === 400 && /api key/i.test(msg)) throw new Error("API Key inválida. Revísala en el panel ⚙️ API.");
      if (res.status === 403) throw new Error("Acceso denegado: la API Key no tiene permiso para este modelo.");
      if (res.status === 404) throw new Error(`El modelo "${model}" no existe o no está disponible. Elige otro en ⚙️ API.`);
      if (res.status === 429) throw new Error("Límite de uso alcanzado (cuota). Espera un momento e inténtalo de nuevo.");
      if (res.status >= 500) throw new Error("Gemini no está disponible en este momento. Inténtalo más tarde.");
      throw new Error(`Error de la API (${res.status}): ${msg}`);
    }

    const cand = data?.candidates?.[0];
    if (!cand) {
      const razon = data?.promptFeedback?.blockReason;
      throw new Error(razon ? `La solicitud fue bloqueada (${razon}).` : "La IA no devolvió resultados.");
    }
    const texto = (cand.content?.parts || []).map((p) => p.text || "").join("").trim();
    if (!texto) throw new Error(`La IA no devolvió contenido (motivo: ${cand.finishReason || "desconocido"}).`);
    return parsearJSON(texto);
  }

  function parsearJSON(texto) {
    const limpio = texto.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "").trim();
    try {
      return JSON.parse(limpio);
    } catch {
      const ini = limpio.indexOf("{"), fin = limpio.lastIndexOf("}");
      if (ini >= 0 && fin > ini) {
        try { return JSON.parse(limpio.slice(ini, fin + 1)); } catch { /* sigue */ }
      }
      throw new Error("La respuesta de la IA no tiene un formato válido. Inténtalo de nuevo.");
    }
  }

  /* ------------------------------------------------------------------ */
  /* Normalización y validación                                          */
  /* ------------------------------------------------------------------ */
  function normalizarPlan(raw, datos) {
    if (!raw || !Array.isArray(raw.dias) || !raw.dias.length) {
      throw new Error("La IA devolvió un plan vacío. Inténtalo de nuevo.");
    }
    const dias = raw.dias.slice(0, datos.dias).map((d, i) => {
      const ingredientes = (Array.isArray(d.ingredientes) ? d.ingredientes : []).map((ing) => ({
        nombre: String(ing?.nombre ?? "Ingrediente"),
        cantidad: String(ing?.cantidad ?? ""),
        precio_estimado: round2(Math.max(0, toNumber(ing?.precio_estimado)))
      }));
      // Recalcula el costo real del día a partir de los ingredientes (no confiamos en la suma de la IA).
      const costo = round2(ingredientes.reduce((s, x) => s + x.precio_estimado, 0));
      return {
        dia: i + 1,
        platillo: String(d.platillo || `Receta del día ${i + 1}`),
        descripcion: String(d.descripcion || ""),
        tiempo_preparacion_min: Math.max(0, Math.round(toNumber(d.tiempo_preparacion_min))),
        porciones: Math.max(1, Math.round(toNumber(d.porciones, datos.personas))),
        costo_dia: costo,
        ingredientes,
        pasos: (Array.isArray(d.pasos) ? d.pasos : []).map(String).filter(Boolean),
        consejo_ahorro: String(d.consejo_ahorro || "")
      };
    });
    const total = round2(dias.reduce((s, d) => s + d.costo_dia, 0));
    return {
      resumen: {
        presupuesto_total: datos.presupuesto,
        costo_total: total,
        moneda: datos.moneda,
        comentario: String(raw.resumen?.comentario || "")
      },
      dias
    };
  }

  /** Busca alérgenos declarados en los nombres de ingredientes (verificación básica). */
  function detectarConflictos(plan, alergias) {
    const conflictos = [];
    const terms = alergias.map((a) => a.toLowerCase()).filter((a) => a.length > 2);
    plan.dias.forEach((d) => d.ingredientes.forEach((ing) => {
      const n = ing.nombre.toLowerCase();
      terms.forEach((t) => {
        if (n.includes(t) && !/sin\s/.test(n)) conflictos.push(`Día ${d.dia}: "${ing.nombre}" (${t})`);
      });
    }));
    return conflictos;
  }

  /* ------------------------------------------------------------------ */
  /* Renderizado                                                         */
  /* ------------------------------------------------------------------ */
  function renderPlan(plan, avisos = []) {
    const { resumen, dias } = plan;
    const mon = resumen.moneda;
    const pres = resumen.presupuesto_total;
    const usado = resumen.costo_total;
    const pct = pres > 0 ? Math.min(100, (usado / pres) * 100) : 0;
    const restante = round2(pres - usado);
    const excede = usado > pres;
    const nivel = excede ? "danger" : pct > 90 ? "warn" : "ok";

    ui.resumen.innerHTML = `
      <div class="stats">
        <div class="stat">
          <span class="stat-label">Presupuesto ingresado</span>
          <span class="stat-value">${escapeHTML(formatMoney(pres, mon))}</span>
        </div>
        <div class="stat">
          <span class="stat-label">Presupuesto usado</span>
          <span class="stat-value stat-${nivel}">${escapeHTML(formatMoney(usado, mon))}</span>
        </div>
        <div class="stat">
          <span class="stat-label">${excede ? "Exceso" : "Ahorro"}</span>
          <span class="stat-value stat-${excede ? "danger" : "ok"}">${escapeHTML(formatMoney(Math.abs(restante), mon))}</span>
        </div>
      </div>
      <div class="progress" role="progressbar" aria-label="Presupuesto usado"
           aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(pct)}">
        <div class="progress-bar progress-${nivel}" style="width:${pct.toFixed(1)}%"></div>
      </div>
      <p class="progress-label">${Math.round((usado / (pres || 1)) * 100)}% del presupuesto ·
        ${dias.length} día(s) · ${escapeHTML(formatMoney(round2(usado / Math.max(1, dias.length)), mon))} por día en promedio</p>
      ${resumen.comentario ? `<p class="comentario">💡 ${escapeHTML(resumen.comentario)}</p>` : ""}
      ${avisos.map((a) => `<p class="alert alert-${a.tipo}">${escapeHTML(a.texto)}</p>`).join("")}
    `;

    ui.diasCont.innerHTML = dias.map((d, i) => `
      <details class="card day-card" ${i === 0 ? "open" : ""}>
        <summary class="day-summary">
          <span class="day-badge">Día ${d.dia}</span>
          <span class="day-title">${escapeHTML(d.platillo)}</span>
          <span class="day-meta">
            <span title="Tiempo de preparación">⏱️ ${d.tiempo_preparacion_min} min</span>
            <span title="Porciones">🍽️ ${d.porciones}</span>
            <strong class="day-cost">${escapeHTML(formatMoney(d.costo_dia, mon))}</strong>
          </span>
          <span class="chevron" aria-hidden="true"></span>
        </summary>
        <div class="day-body">
          ${d.descripcion ? `<p class="muted">${escapeHTML(d.descripcion)}</p>` : ""}
          <h3 class="section-title">Ingredientes</h3>
          <table class="ing-table">
            <thead><tr><th scope="col">Ingrediente</th><th scope="col">Cantidad</th><th scope="col" class="num">Precio est.</th></tr></thead>
            <tbody>
              ${d.ingredientes.map((ing) => `
                <tr>
                  <td data-label="Ingrediente">${escapeHTML(ing.nombre)}</td>
                  <td data-label="Cantidad">${escapeHTML(ing.cantidad)}</td>
                  <td data-label="Precio" class="num">${escapeHTML(formatMoney(ing.precio_estimado, mon))}</td>
                </tr>`).join("")}
            </tbody>
            <tfoot><tr><th scope="row" colspan="2">Total del día</th><td class="num"><strong>${escapeHTML(formatMoney(d.costo_dia, mon))}</strong></td></tr></tfoot>
          </table>
          <h3 class="section-title">Preparación</h3>
          <ol class="steps">${d.pasos.map((p) => `<li>${escapeHTML(p.replace(/^\s*(paso\s*)?\d+[.)-]?\s*/i, ""))}</li>`).join("")}</ol>
          ${d.consejo_ahorro ? `<p class="tip">💰 ${escapeHTML(d.consejo_ahorro)}</p>` : ""}
        </div>
      </details>`).join("");

    renderCompras(plan);
    ui.resultados.hidden = false;
    ui.resultados.focus({ preventScroll: true });
    ui.resultados.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function renderCompras(plan) {
    const mapa = new Map();
    plan.dias.forEach((d) => d.ingredientes.forEach((ing) => {
      const k = ing.nombre.trim().toLowerCase();
      const prev = mapa.get(k) || { nombre: ing.nombre, cantidades: [], total: 0, dias: new Set() };
      prev.cantidades.push(ing.cantidad);
      prev.total += ing.precio_estimado;
      prev.dias.add(d.dia);
      mapa.set(k, prev);
    }));
    const items = [...mapa.values()].sort((a, b) => b.total - a.total);
    ui.compras.innerHTML = `
      <ul class="shopping">
        ${items.map((it) => `
          <li>
            <label class="checkbox">
              <input type="checkbox" />
              <span><strong>${escapeHTML(it.nombre)}</strong>
                <small class="muted">— ${escapeHTML(it.cantidades.join(" + "))} · día(s) ${[...it.dias].join(", ")}</small></span>
            </label>
            <span class="num">${escapeHTML(formatMoney(round2(it.total), plan.resumen.moneda))}</span>
          </li>`).join("")}
      </ul>`;
  }

  /* ------------------------------------------------------------------ */
  /* Envío del formulario                                                */
  /* ------------------------------------------------------------------ */
  function setStatus(texto, tipo = "info") {
    ui.status.textContent = texto;
    ui.status.className = `status-msg status-${tipo}`;
  }

  function setCargando(on) {
    state.generando = on;
    ui.btnGenerar.disabled = on;
    ui.btnGenerar.classList.toggle("loading", on);
    ui.btnGenerar.setAttribute("aria-busy", String(on));
  }

  function leerFormulario() {
    const presupuesto = toNumber(ui.presupuesto.value, NaN);
    ui.errPresupuesto.textContent = "";
    ui.presupuesto.removeAttribute("aria-invalid");
    if (!Number.isFinite(presupuesto) || presupuesto <= 0) {
      ui.errPresupuesto.textContent = "Ingresa un presupuesto mayor que 0.";
      ui.presupuesto.setAttribute("aria-invalid", "true");
      ui.presupuesto.focus();
      return null;
    }
    // Agrega texto pendiente en los inputs de etiquetas
    ["gustos", "alergias"].forEach((t) => {
      const inp = $(`#${t}Input`);
      if (inp.value.trim()) { inp.value.split(",").forEach((v) => agregarTag(t, v)); inp.value = ""; }
    });
    return {
      presupuesto: round2(presupuesto),
      moneda: ui.moneda.value,
      dias: Math.min(7, Math.max(1, parseInt(ui.dias.value, 10) || 1)),
      personas: Math.max(1, parseInt(ui.personas.value, 10) || 1),
      comida: ui.comida.value,
      gustos: [...state.gustos],
      alergias: [...state.alergias],
      notas: ui.notas.value.trim().slice(0, 500)
    };
  }

  async function onSubmit(e) {
    e.preventDefault();
    if (state.generando) return;
    const datos = leerFormulario();
    if (!datos) return;
    guardarFormulario();

    const apiKey = ui.apiKey.value.trim();
    const usarDemo = ui.modoDemo.checked || !apiKey;
    const avisos = [];

    setCargando(true);
    try {
      let plan;
      if (usarDemo) {
        if (!apiKey && !ui.modoDemo.checked) {
          avisos.push({ tipo: "info", texto: "No configuraste una API Key, así que se muestra un plan de demostración. Agrégala en ⚙️ API para recetas personalizadas con IA." });
        }
        setStatus("Generando plan de demostración…");
        await new Promise((r) => setTimeout(r, 400));
        plan = normalizarPlan(generarPlanDemo(datos), datos);
      } else {
        const model = modeloSeleccionado();
        const systemPrompt = construirSystemPrompt();
        setStatus(`Consultando a Gemini (${model})… esto puede tardar unos segundos.`);
        plan = normalizarPlan(await llamarGemini({ apiKey, model, systemPrompt, userPrompt: construirUserPrompt(datos) }), datos);

        // Si se excede el presupuesto, pide a la IA que lo ajuste.
        for (let i = 0; i < MAX_REINTENTOS_PRESUPUESTO && plan.resumen.costo_total > datos.presupuesto; i++) {
          setStatus("El plan superó el presupuesto. Pidiendo a la IA que lo ajuste…");
          const feedback = `Tu propuesta anterior costaba ${plan.resumen.costo_total} ${datos.moneda}, que SUPERA el presupuesto de ${datos.presupuesto} ${datos.moneda}. Rehaz el plan con ingredientes más baratos o cantidades menores para que el costo total quede por debajo del ${Math.round(datos.presupuesto * 0.95)} ${datos.moneda}.`;
          const ajustado = normalizarPlan(await llamarGemini({ apiKey, model, systemPrompt, userPrompt: construirUserPrompt(datos, feedback) }), datos);
          if (ajustado.resumen.costo_total < plan.resumen.costo_total) plan = ajustado;
        }

        if (plan.dias.length < datos.dias) {
          avisos.push({ tipo: "warn", texto: `La IA generó ${plan.dias.length} de ${datos.dias} días solicitados.` });
        }
      }

      if (plan.resumen.costo_total > datos.presupuesto) {
        avisos.push({ tipo: "danger", texto: "⚠️ El costo estimado supera tu presupuesto. Prueba con más presupuesto, menos días o menos personas." });
      }
      const conflictos = detectarConflictos(plan, datos.alergias);
      if (conflictos.length) {
        avisos.push({ tipo: "danger", texto: `⚠️ Revisa posibles alérgenos: ${conflictos.join("; ")}.` });
      }

      state.planActual = plan;
      renderPlan(plan, avisos);
      setStatus("¡Menú generado! 🎉", "ok");
    } catch (err) {
      console.error(err);
      setStatus(err.message || "Ocurrió un error inesperado.", "error");
    } finally {
      setCargando(false);
    }
  }

  ui.form.addEventListener("submit", onSubmit);

  /* ------------------------------------------------------------------ */
  /* Acciones de resultados                                              */
  /* ------------------------------------------------------------------ */
  const btnExpandir = $("#btnExpandir");
  btnExpandir.addEventListener("click", () => {
    const cards = $$(".day-card, #listaCompras");
    const abrir = cards.some((c) => !c.open);
    cards.forEach((c) => { c.open = abrir; });
    btnExpandir.textContent = abrir ? "Contraer todo" : "Expandir todo";
  });

  $("#btnImprimir").addEventListener("click", () => {
    $$(".day-card, #listaCompras").forEach((c) => { c.open = true; });
    window.print();
  });

  /* ------------------------------------------------------------------ */
  /* Inicio                                                              */
  /* ------------------------------------------------------------------ */
  cargarConfig();
  cargarFormulario();
  renderTags("gustos");
  renderTags("alergias");
})();
