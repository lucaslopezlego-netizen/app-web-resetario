/**
 * EcoMenú IA — Lógica de la interfaz.
 * Asistente de 5 pasos → generación con Gemini (directa, vía servidor o demo)
 * → resultados interactivos: días con foto, "lo tengo en casa", cambiar plato,
 *   modo cocina con temporizador y ticket de compras.
 */
(() => {
  "use strict";

  const core = window.EcoCore;
  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => [...c.querySelectorAll(s)];
  const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  const round2 = (n) => Math.round(n * 100) / 100;
  const num = (v, d = 0) => { const n = typeof v === "number" ? v : parseFloat(String(v).replace(",", ".")); return Number.isFinite(n) ? n : d; };

  const store = {
    get(k, d = null) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* sin almacenamiento */ } },
    del(k) { try { localStorage.removeItem(k); } catch { /* sin almacenamiento */ } }
  };
  const K = { datos: "eco.datos", plan: "eco.plan", key: "eco.key", modelo: "eco.modelo", demo: "eco.demo" };

  const DIAS_SEMANA = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];
  /** Tipos de cambio aproximados a USD, solo para orientar el indicador del paso 1. */
  const A_USD = { USD: 1, EUR: 1.08, MXN: 0.055, ARS: 0.001, COP: 0.00025, CLP: 0.00105, PEN: 0.27, BOB: 0.145, UYU: 0.025, GTQ: 0.13, DOP: 0.016 };
  const MENSAJES_CARGA = [
    "Revisando precios del mercado…", "Comparando el kilo de arroz y de lentejas…", "Descartando ingredientes con alérgenos…",
    "Buscando platos que reutilicen ingredientes…", "Ajustando cantidades por persona…", "Calculando el costo de cada receta…",
    "Escribiendo los pasos de preparación…", "Sumando la lista de compras…"
  ];

  function dinero(v, moneda) {
    try { return new Intl.NumberFormat("es", { style: "currency", currency: moneda, maximumFractionDigits: 2 }).format(v); }
    catch { return `${moneda} ${num(v).toFixed(2)}`; }
  }

  /* ================================================================== */
  /* Estado                                                              */
  /* ================================================================== */
  const datosIniciales = { presupuesto: 40, moneda: "USD", dias: 3, personas: 2, comida: "almuerzo", gustos: [], alergias: [], notas: "" };
  const state = {
    paso: 1, maxPaso: 1,
    datos: { ...datosIniciales, ...(store.get(K.datos) || {}) },
    plan: null, diaSel: 0,
    tengo: new Set(), hechos: new Set(),
    generando: false, sinServidor: false
  };
  const cfgLocal = window.ECOMENU_CONFIG || {};
  const ajustes = {
    key: store.get(K.key, ""),
    modelo: store.get(K.modelo, cfgLocal.modelo || "auto"),
    demo: store.get(K.demo, false)
  };
  const claveActiva = () => (ajustes.key || cfgLocal.apiKey || "").trim();
  const enServidorWeb = () => /^https?:$/.test(location.protocol) && !state.sinServidor;

  /* ================================================================== */
  /* Indicador de conexión                                               */
  /* ================================================================== */
  function actualizarConexion() {
    const el = $("#conexion"), txt = $("#conexionTexto");
    let estado = "demo", texto = "Recetas de ejemplo";
    if (!ajustes.demo && claveActiva()) { estado = "ia"; texto = "Gemini conectado"; }
    else if (!ajustes.demo && enServidorWeb()) { estado = "servidor"; texto = "IA en servidor"; }
    el.dataset.estado = estado; txt.textContent = texto;
  }

  /* ================================================================== */
  /* Asistente: navegación                                               */
  /* ================================================================== */
  const form = $("#formMenu");
  const btnAtras = $("#btnAtras"), btnSig = $("#btnSiguiente");

  function irAPaso(n, { foco = true } = {}) {
    n = Math.max(1, Math.min(5, n));
    const dir = n >= state.paso ? "entra-adelante" : "entra-atras";
    state.paso = n; state.maxPaso = Math.max(state.maxPaso, n);
    $$(".step").forEach((s) => {
      const activo = Number(s.dataset.step) === n;
      s.hidden = !activo;
      s.classList.remove("entra-adelante", "entra-atras");
      if (activo) { void s.offsetWidth; s.classList.add(dir); }
    });
    $$("#stepper button").forEach((b) => {
      const i = Number(b.dataset.ir);
      b.toggleAttribute("aria-current", i === n);
      if (i === n) b.setAttribute("aria-current", "step");
      b.classList.toggle("hecho", i < n || (i <= state.maxPaso && i !== n));
      b.disabled = i > state.maxPaso;
    });
    $("#stepperFill").style.width = `${(n / 5) * 100}%`;
    btnAtras.style.visibility = n === 1 ? "hidden" : "visible";
    btnSig.textContent = n === 5 ? "Generar menú con IA" : "Siguiente";
    if (n === 5) renderRevision();
    setStatus("");
    if (foco) {
      const paso = $(`.step[data-step="${n}"]`);
      const objetivo = n === 1 ? $("#presupuesto") : paso.querySelector(".step-title");
      if (objetivo) { objetivo.setAttribute("tabindex", "-1"); objetivo.focus({ preventScroll: true }); }
    }
  }

  function validarPaso(n) {
    if (n === 1) {
      const v = num($("#presupuesto").value, NaN);
      if (!(v > 0)) { $("#errPresupuesto").textContent = "Escribe un presupuesto mayor que 0."; $("#presupuesto").focus(); return false; }
      $("#errPresupuesto").textContent = "";
    }
    return true;
  }

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    if (state.generando) return;
    if (!validarPaso(state.paso)) return;
    if (state.paso < 5) irAPaso(state.paso + 1);
    else generarPlan();
  });
  btnAtras.addEventListener("click", () => irAPaso(state.paso - 1));
  $("#stepper").addEventListener("click", (e) => {
    const b = e.target.closest("button[data-ir]");
    if (b && !b.disabled && validarPaso(state.paso)) irAPaso(Number(b.dataset.ir));
  });

  function guardarDatos() { store.set(K.datos, state.datos); }

  /* ---------------- Paso 1: presupuesto ---------------- */
  const inpPres = $("#presupuesto"), rango = $("#presupuestoRango"), selMoneda = $("#moneda");

  function sincronizarPresupuesto(valor, origen) {
    const v = Math.max(0, num(valor, 0));
    state.datos.presupuesto = round2(v);
    if (origen !== "input") inpPres.value = v || "";
    if (origen !== "rango") rango.value = Math.min(Number(rango.max), Math.max(Number(rango.min), v));
    rango.style.setProperty("--pct", `${((rango.value - rango.min) / (rango.max - rango.min)) * 100}%`);
    $$("#quickMontos button").forEach((b) => b.classList.toggle("activo", Number(b.dataset.monto) === v));
    actualizarInsight();
    guardarDatos();
  }

  function actualizarInsight() {
    const d = state.datos;
    const platos = d.dias * d.personas;
    const porPlato = d.presupuesto / Math.max(1, platos);
    const usd = porPlato * (A_USD[d.moneda] || 1);
    $("#insightValor").textContent = d.presupuesto > 0 ? dinero(porPlato, d.moneda) : "—";
    let txt, color;
    if (!(d.presupuesto > 0)) { txt = "Escribe cuánto quieres gastar."; color = "var(--muted)"; }
    else if (usd < 1.2) { txt = "Muy ajustado. La base serán arroz, legumbres y huevo."; color = "var(--danger)"; }
    else if (usd < 2.5) { txt = "Ajustado pero posible: cocina casera y económica."; color = "var(--warn)"; }
    else if (usd < 4.5) { txt = "Cómodo: hay espacio para variedad y algo de carne."; color = "var(--ok)"; }
    else { txt = "Holgado: puedes darte algunos gustos."; color = "var(--ok)"; }
    $("#insightTexto").textContent = `${d.dias} día(s) × ${d.personas} persona(s) = ${platos} platos. ${txt}`;
    const m = $("#insightMeter");
    m.style.width = `${Math.min(100, (usd / 6) * 100)}%`;
    m.style.background = color;
  }

  inpPres.addEventListener("input", () => sincronizarPresupuesto(inpPres.value, "input"));
  rango.addEventListener("input", () => sincronizarPresupuesto(rango.value, "rango"));
  $("#quickMontos").addEventListener("click", (e) => { const b = e.target.closest("button"); if (b) sincronizarPresupuesto(b.dataset.monto); });
  selMoneda.addEventListener("change", () => { state.datos.moneda = selMoneda.value; actualizarInsight(); guardarDatos(); });

  /* ---------------- Paso 2: días, personas, comida ---------------- */
  function renderSemana() {
    $$("#semana button").forEach((b) => {
      const n = Number(b.dataset.dias);
      b.setAttribute("aria-checked", String(n === state.datos.dias));
      b.tabIndex = n === state.datos.dias ? 0 : -1;
      b.classList.toggle("en-plan", n < state.datos.dias);
    });
    const d = state.datos.dias;
    $("#semanaTexto").textContent = d === 1 ? "Plan de 1 día · Lunes" : `Plan de ${d} días · Lunes a ${DIAS_SEMANA[d - 1]}`;
    $("#personas").textContent = state.datos.personas;
    actualizarInsight();
  }
  $("#semana").addEventListener("click", (e) => {
    const b = e.target.closest("button"); if (!b) return;
    state.datos.dias = Number(b.dataset.dias); renderSemana(); guardarDatos();
  });
  $("#semana").addEventListener("keydown", (e) => {
    const delta = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
    if (!delta) return;
    e.preventDefault();
    state.datos.dias = Math.min(7, Math.max(1, state.datos.dias + delta));
    renderSemana(); guardarDatos();
    $(`#semana button[data-dias="${state.datos.dias}"]`).focus();
  });
  $("#menosPersonas").addEventListener("click", () => { state.datos.personas = Math.max(1, state.datos.personas - 1); renderSemana(); guardarDatos(); });
  $("#masPersonas").addEventListener("click", () => { state.datos.personas = Math.min(12, state.datos.personas + 1); renderSemana(); guardarDatos(); });
  $("#comidas").addEventListener("change", (e) => { state.datos.comida = e.target.value; guardarDatos(); });

  /* ---------------- Pasos 3 y 4: gustos y alergias ---------------- */
  const GRUPOS = {
    gustos: { opciones: "#gustosOpciones", tags: "#gustosTags", input: "#gustosInput" },
    alergias: { opciones: "#alergiasOpciones", tags: "#alergiasTags", input: "#alergiasInput" }
  };
  const valoresFijos = (tipo) => $$(`${GRUPOS[tipo].opciones} input`).map((i) => i.value.toLowerCase());

  function renderGrupo(tipo) {
    const g = GRUPOS[tipo], lista = state.datos[tipo];
    $$(`${g.opciones} input`).forEach((i) => { i.checked = lista.some((v) => v.toLowerCase() === i.value.toLowerCase()); });
    const fijos = valoresFijos(tipo);
    $(g.tags).innerHTML = lista
      .filter((v) => !fijos.includes(v.toLowerCase()))
      .map((v) => `<li class="tag"><span>${esc(v)}</span><button type="button" data-quitar="${tipo}" data-valor="${esc(v)}" aria-label="Quitar ${esc(v)}">×</button></li>`)
      .join("");
  }

  function alternar(tipo, valor, activo) {
    const limpio = String(valor).replace(/\s+/g, " ").trim().slice(0, 60);
    if (!limpio) return;
    const lista = state.datos[tipo];
    const idx = lista.findIndex((v) => v.toLowerCase() === limpio.toLowerCase());
    if (activo && idx < 0) {
      if (lista.length >= 15) { toast("Puedes elegir hasta 15."); return; }
      lista.push(limpio);
    } else if (!activo && idx >= 0) lista.splice(idx, 1);
    renderGrupo(tipo); guardarDatos();
  }

  Object.entries(GRUPOS).forEach(([tipo, g]) => {
    $(g.opciones).addEventListener("change", (e) => alternar(tipo, e.target.value, e.target.checked));
    const inp = $(g.input);
    const volcar = () => { inp.value.split(",").forEach((v) => alternar(tipo, v, true)); inp.value = ""; };
    inp.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === ",") { e.preventDefault(); volcar(); }
      else if (e.key === "Backspace" && !inp.value) {
        const fijos = valoresFijos(tipo);
        const libres = state.datos[tipo].filter((v) => !fijos.includes(v.toLowerCase()));
        if (libres.length) alternar(tipo, libres[libres.length - 1], false);
      }
    });
    inp.addEventListener("blur", () => { if (inp.value.trim()) volcar(); });
    inp.closest(".tag-input").addEventListener("click", (e) => { if (e.target === e.currentTarget) inp.focus(); });
  });
  document.addEventListener("click", (e) => {
    const b = e.target.closest("[data-quitar]");
    if (b) alternar(b.dataset.quitar, b.dataset.valor, false);
  });
  $("#notas").addEventListener("input", (e) => { state.datos.notas = e.target.value.slice(0, 500); guardarDatos(); });

  /* ---------------- Paso 5: revisión ---------------- */
  function renderRevision() {
    const d = state.datos;
    const filas = [
      ["Presupuesto", dinero(d.presupuesto, d.moneda), 1],
      ["Calendario", `${d.dias} día(s) · ${d.personas} persona(s) · ${d.comida}`, 2],
      ["Gustos", d.gustos.join(", ") || "Sin preferencias", 3],
      ["No puedo comer", d.alergias.join(", ") || "Nada", 4]
    ];
    if (d.notas) filas.push(["Notas", d.notas, 4]);
    $("#revision").innerHTML = filas.map(([t, v, p]) =>
      `<button type="button" class="review-row" data-ir-paso="${p}"><dt>${esc(t)}</dt><dd>${esc(v)}</dd><span class="edit">Cambiar</span></button>`).join("");
  }
  $("#revision").addEventListener("click", (e) => { const b = e.target.closest("[data-ir-paso]"); if (b) irAPaso(Number(b.dataset.irPaso)); });

  /* ================================================================== */
  /* Generación                                                          */
  /* ================================================================== */
  function setStatus(msg, tipo = "") {
    const el = $("#statusMsg");
    el.textContent = msg; el.className = `form-status ${tipo}`;
  }

  let cargaTimer = null;
  function mostrarCarga(on, titulo = "Preparando tu menú") {
    state.generando = on;
    form.hidden = on;
    $("#stepper").hidden = on; $(".stepper-track").hidden = on;
    $("#cargando").hidden = !on;
    clearInterval(cargaTimer);
    if (!on) return;
    $("#cargandoTitulo").textContent = titulo;
    const t0 = Date.now(); let i = 0;
    const msg = $("#cargandoMsg"); msg.textContent = MENSAJES_CARGA[0];
    $("#cargandoSeg").textContent = "0";
    cargaTimer = setInterval(() => {
      const s = Math.floor((Date.now() - t0) / 1000);
      $("#cargandoSeg").textContent = s;
      if (s % 3 === 0) {
        i = (i + 1) % MENSAJES_CARGA.length;
        msg.textContent = MENSAJES_CARGA[i];
        msg.style.animation = "none"; void msg.offsetWidth; msg.style.animation = "";
      }
    }, 1000);
  }

  class SinServidor extends Error {}

  /** Pide un plan a la fuente disponible. Devuelve { plan, modelo, fuente }. */
  async function pedirPlan(datos, extra = {}) {
    if (ajustes.demo) return { plan: generarPlanDemo(datos, extra), modelo: null, fuente: "demo" };

    const key = claveActiva();
    if (key) {
      const preferido = ajustes.modelo && ajustes.modelo !== "auto" ? [ajustes.modelo] : [];
      const modelos = [...new Set([...preferido, ...core.MODELOS])];
      const r = await core.generarConGemini({
        apiKey: key, datos, extra, modelos,
        onModelo: (m) => { $("#cargandoTitulo").textContent = `Cocinando con ${m}`; }
      });
      return { ...r, fuente: "ia" };
    }

    if (enServidorWeb()) {
      try {
        const res = await fetch("api/generar", {
          method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ datos, extra })
        });
        if (res.status === 404 || res.status === 405 || res.status === 501) throw new SinServidor();
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          if (/GEMINI_API_KEY/.test(data.error || "")) throw new SinServidor();
          throw new Error(data.error || `El servidor respondió ${res.status}.`);
        }
        return { plan: data.plan, modelo: data.modelo, fuente: "servidor" };
      } catch (err) {
        if (!(err instanceof SinServidor) && !(err instanceof TypeError)) throw err;
        state.sinServidor = true; actualizarConexion();
      }
    }
    return { plan: generarPlanDemo(datos, extra), modelo: null, fuente: "demo" };
  }

  function normalizarDia(d, numero, personas) {
    const ingredientes = (Array.isArray(d?.ingredientes) ? d.ingredientes : []).map((x) => ({
      nombre: String(x?.nombre ?? "Ingrediente").trim(),
      cantidad: String(x?.cantidad ?? "").trim(),
      precio_estimado: round2(Math.max(0, num(x?.precio_estimado)))
    }));
    return {
      dia: numero,
      platillo: String(d?.platillo || `Receta del día ${numero}`),
      descripcion: String(d?.descripcion || ""),
      tiempo_preparacion_min: Math.max(0, Math.round(num(d?.tiempo_preparacion_min))),
      porciones: Math.max(1, Math.round(num(d?.porciones, personas))),
      costo_dia: round2(ingredientes.reduce((s, x) => s + x.precio_estimado, 0)),
      ingredientes,
      pasos: (Array.isArray(d?.pasos) ? d.pasos : []).map((p) => String(p).replace(/^\s*(paso\s*)?\d+\s*[.):-]\s*/i, "").trim()).filter(Boolean),
      consejo_ahorro: String(d?.consejo_ahorro || "")
    };
  }

  function normalizarPlan(raw, datos) {
    if (!raw || !Array.isArray(raw.dias) || !raw.dias.length) throw new Error("La IA devolvió un plan vacío. Vuelve a intentarlo.");
    const dias = raw.dias.slice(0, datos.dias).map((d, i) => normalizarDia(d, i + 1, datos.personas));
    return {
      datos: { ...datos },
      comentario: String(raw.resumen?.comentario || ""),
      dias
    };
  }

  const totalPlan = (plan) => round2(plan.dias.reduce((s, d) => s + d.costo_dia, 0));

  async function generarPlan() {
    const datos = core.sanearDatos(state.datos);
    mostrarCarga(true);
    try {
      let { plan: raw, modelo, fuente } = await pedirPlan(datos);
      let plan = normalizarPlan(raw, datos);

      if (fuente !== "demo" && totalPlan(plan) > datos.presupuesto) {
        $("#cargandoTitulo").textContent = "Ajustando al presupuesto";
        try {
          const feedback = `Tu propuesta costaba ${totalPlan(plan)} ${datos.moneda} y SUPERA el presupuesto de ${datos.presupuesto} ${datos.moneda}. Rehaz el plan con ingredientes más baratos o cantidades menores para que el total quede por debajo de ${round2(datos.presupuesto * 0.95)} ${datos.moneda}.`;
          const r2 = await pedirPlan(datos, { feedback });
          const plan2 = normalizarPlan(r2.plan, datos);
          if (totalPlan(plan2) < totalPlan(plan)) { plan = plan2; modelo = r2.modelo; }
        } catch { /* nos quedamos con el primer plan */ }
      }

      plan.fuente = fuente; plan.modelo = modelo;
      state.plan = plan; state.diaSel = 0; state.tengo = new Set(); state.hechos = new Set();
      guardarPlan();
      mostrarCarga(false);
      renderResultados(true);
      toast(fuente === "demo" ? "Plan de ejemplo listo" : "Tu menú está listo");
    } catch (err) {
      console.error(err);
      mostrarCarga(false);
      setStatus(err.message || "No se pudo generar el menú. Vuelve a intentarlo.", "error");
    }
  }

  async function cambiarPlato(idx, boton) {
    const plan = state.plan; if (!plan || state.generando) return;
    const datos = plan.datos;
    const actual = plan.dias[idx];
    const resto = totalPlan(plan) - actual.costo_dia;
    const disponible = round2(Math.max(datos.presupuesto - resto, actual.costo_dia * 0.8, 0.5));
    state.generando = true;
    boton.disabled = true; boton.textContent = "Buscando otro plato…";
    try {
      const extra = { diaNumero: idx + 1, evitar: plan.dias.map((d) => d.platillo) };
      const { plan: raw } = await pedirPlan({ ...datos, presupuesto: disponible, dias: 1 }, extra);
      if (!raw?.dias?.length) throw new Error("No llegó ningún plato nuevo.");
      plan.dias[idx] = normalizarDia(raw.dias[0], idx + 1, datos.personas);
      [...state.tengo].filter((k) => k.startsWith(`${idx}-`)).forEach((k) => state.tengo.delete(k));
      [...state.hechos].filter((k) => k.startsWith(`${idx}-`)).forEach((k) => state.hechos.delete(k));
      guardarPlan();
      renderResultados();
      toast(`Nuevo plato para el día ${idx + 1}: ${plan.dias[idx].platillo}`);
    } catch (err) {
      toast(err.message || "No se pudo cambiar el plato.");
      boton.disabled = false; boton.textContent = "Cambiar este plato";
    } finally {
      state.generando = false;
    }
  }

  function guardarPlan() {
    store.set(K.plan, { plan: state.plan, tengo: [...state.tengo], hechos: [...state.hechos], diaSel: state.diaSel });
  }

  /* ================================================================== */
  /* Resultados                                                          */
  /* ================================================================== */
  const costoTengo = () => {
    let s = 0;
    state.tengo.forEach((k) => { const [d, i] = k.split("-").map(Number); s += state.plan.dias[d]?.ingredientes[i]?.precio_estimado || 0; });
    return round2(s);
  };

  function renderResultados(scroll = false) {
    const plan = state.plan; if (!plan) return;
    const { datos } = plan;
    $("#resultados").hidden = false;
    $("#resEyebrow").textContent = plan.fuente === "demo" ? "Plan de ejemplo" : `Generado con ${plan.modelo || "Gemini"}`;
    $("#resTitulo").textContent = `Menú de ${plan.dias.length} ${plan.dias.length === 1 ? "día" : "días"} para ${datos.personas}`;
    renderPresupuesto();
    renderTira();
    renderDia();
    renderTicket();
    if (scroll) { const r = $("#resultados"); r.focus({ preventScroll: true }); r.scrollIntoView({ behavior: "smooth", block: "start" }); }
  }

  function detectarConflictos(plan) {
    const terms = plan.datos.alergias.map((a) => a.toLowerCase()).filter((a) => a.length > 2);
    const out = [];
    plan.dias.forEach((d) => d.ingredientes.forEach((ing) => {
      const n = ing.nombre.toLowerCase();
      terms.forEach((t) => { if (n.includes(t) && !/\bsin\s/.test(n)) out.push(`día ${d.dia}: ${ing.nombre}`); });
    }));
    return out;
  }

  function renderPresupuesto() {
    const plan = state.plan, { datos } = plan, mon = datos.moneda;
    const total = totalPlan(plan), tengo = costoTengo(), gastar = round2(total - tengo);
    const pres = datos.presupuesto, resto = round2(pres - gastar);
    const pct = pres > 0 ? gastar / pres : 0;
    const nivel = pct > 1 ? "danger" : pct > 0.92 ? "warn" : "ok";
    const C = 2 * Math.PI * 52;
    const maxDia = Math.max(...plan.dias.map((d) => d.costo_dia), 0.01);
    const avisos = [];
    if (plan.fuente === "demo") avisos.push(["info", claveActiva() || enServidorWeb() ? "Estás viendo recetas de ejemplo. Desactiva el modo de ejemplo en Ajustes para usar Gemini." : "Estás viendo recetas de ejemplo porque no hay una clave de Gemini configurada. Agrégala en Ajustes."]);
    if (gastar > pres) avisos.push(["danger", "El menú supera tu presupuesto. Marca lo que ya tienes en casa, cambia algún plato o reduce días o personas."]);
    const conflictos = detectarConflictos(plan);
    if (conflictos.length) avisos.push(["danger", `Revisa posibles alérgenos: ${conflictos.join("; ")}.`]);

    $("#presupuestoPanel").innerHTML = `
      <div class="budget-top">
        <div class="ring" data-nivel="${nivel}" role="img" aria-label="Usas el ${Math.round(pct * 100)}% del presupuesto">
          <svg viewBox="0 0 120 120"><circle class="ring-bg" cx="60" cy="60" r="52"/><circle class="ring-fg" cx="60" cy="60" r="52" stroke-dasharray="${C.toFixed(1)}" stroke-dashoffset="${C.toFixed(1)}"/></svg>
          <div class="ring-label"><b>${Math.round(pct * 100)}%</b><small>usado</small></div>
        </div>
        <dl class="figures">
          <div class="figure"><dt>Tu presupuesto</dt><dd>${esc(dinero(pres, mon))}</dd></div>
          <div class="figure"><dt>Vas a gastar</dt><dd class="walnut">${esc(dinero(gastar, mon))}</dd></div>
          ${tengo > 0 ? `<div class="figure"><dt>Ya tienes en casa</dt><dd class="ok">−${esc(dinero(tengo, mon))}</dd></div>` : ""}
          <div class="figure"><dt>${resto >= 0 ? "Te sobra" : "Te falta"}</dt><dd class="${resto >= 0 ? "ok" : "danger"}">${esc(dinero(Math.abs(resto), mon))}</dd></div>
        </dl>
      </div>
      <div class="bars">
        <p class="bars-title">Costo por día</p>
        <div class="bars-grid">
          ${plan.dias.map((d, i) => {
            const h = Math.max(6, (d.costo_dia / maxDia) * 78);
            return `<button type="button" class="bar ${i === state.diaSel ? "activo" : ""}" data-dia="${i}" style="--h:${h}px" aria-label="Día ${i + 1}: ${esc(dinero(d.costo_dia, mon))}"><span>${esc(dinero(d.costo_dia, mon))}</span><i style="height:0"></i></button>`;
          }).join("")}
        </div>
        <div class="bars-labels" aria-hidden="true">${plan.dias.map((_, i) => `<span>${DIAS_SEMANA[i].slice(0, 3)}</span>`).join("")}</div>
      </div>
      ${plan.comentario ? `<p class="budget-note">${esc(plan.comentario)}</p>` : ""}
      ${avisos.map(([t, m]) => `<p class="alert alert-${t}">${esc(m)}</p>`).join("")}`;

    requestAnimationFrame(() => requestAnimationFrame(() => {
      const fg = $("#presupuestoPanel .ring-fg");
      if (fg) fg.style.strokeDashoffset = (C * (1 - Math.min(1, pct))).toFixed(1);
      $$("#presupuestoPanel .bar").forEach((b) => { b.querySelector("i").style.height = b.style.getPropertyValue("--h"); });
    }));
  }

  function renderTira() {
    const plan = state.plan, mon = plan.datos.moneda;
    $("#tiraDias").innerHTML = plan.dias.map((d, i) => `
      <button type="button" class="day-tab" role="tab" id="tab-${i}" data-dia="${i}" aria-selected="${i === state.diaSel}" aria-controls="detalleDia" tabindex="${i === state.diaSel ? 0 : -1}">
        <span class="day-tab-img" style="background-image:url('${fotoParaPlato(d, i, 420)}')"></span>
        <span class="day-tab-body">
          <span class="day-tab-day">${DIAS_SEMANA[i]}</span>
          <span class="day-tab-name">${esc(d.platillo)}</span>
          <span class="day-tab-cost">${esc(dinero(d.costo_dia, mon))} · ${d.tiempo_preparacion_min} min</span>
        </span>
      </button>`).join("");
  }

  function seleccionarDia(i, foco = false) {
    state.diaSel = i; guardarPlan();
    $$("#tiraDias .day-tab").forEach((t, k) => { t.setAttribute("aria-selected", String(k === i)); t.tabIndex = k === i ? 0 : -1; });
    $$("#presupuestoPanel .bar").forEach((b, k) => b.classList.toggle("activo", k === i));
    renderDia(true);
    if (foco) $(`#tab-${i}`).focus();
  }

  $("#tiraDias").addEventListener("click", (e) => { const t = e.target.closest(".day-tab"); if (t) seleccionarDia(Number(t.dataset.dia)); });
  $("#tiraDias").addEventListener("keydown", (e) => {
    const delta = { ArrowRight: 1, ArrowLeft: -1 }[e.key]; if (!delta || !state.plan) return;
    e.preventDefault();
    const n = state.plan.dias.length;
    seleccionarDia((state.diaSel + delta + n) % n, true);
  });
  $("#presupuestoPanel").addEventListener("click", (e) => {
    const b = e.target.closest(".bar"); if (!b) return;
    seleccionarDia(Number(b.dataset.dia));
    $("#detalleDia").scrollIntoView({ behavior: "smooth", block: "start" });
  });

  function renderDia(animar = false) {
    const plan = state.plan, i = state.diaSel, d = plan.dias[i], mon = plan.datos.moneda;
    const el = $("#detalleDia");
    el.setAttribute("aria-labelledby", `tab-${i}`);
    const tengoDia = d.ingredientes.reduce((s, x, k) => s + (state.tengo.has(`${i}-${k}`) ? x.precio_estimado : 0), 0);
    el.innerHTML = `
      <header class="day-hero" style="background-image:url('${fotoParaPlato(d, i, 1400)}')">
        <p class="eyebrow">Día ${d.dia} · ${DIAS_SEMANA[i]} · ${esc(plan.datos.comida)}</p>
        <h3>${esc(d.platillo)}</h3>
        ${d.descripcion ? `<p>${esc(d.descripcion)}</p>` : ""}
        <div class="chips">
          <span class="chip">${d.tiempo_preparacion_min} min</span>
          <span class="chip">${d.porciones} porciones</span>
          <span class="chip">${esc(dinero(d.costo_dia, mon))}</span>
          <span class="chip">${esc(dinero(d.costo_dia / Math.max(1, d.porciones), mon))} c/u</span>
        </div>
      </header>
      <div class="day-actions">
        <button type="button" class="btn btn-primary" id="btnCocinar" ${d.pasos.length ? "" : "disabled"}>Empezar a cocinar</button>
        <button type="button" class="btn btn-quiet" id="btnCambiar">Cambiar este plato</button>
      </div>
      <div class="day-cols">
        <section class="day-col" aria-labelledby="ingTit">
          <div class="col-title"><h4 id="ingTit">Ingredientes</h4><small>Marca lo que ya tienes</small></div>
          <ul class="ings">
            ${d.ingredientes.map((x, k) => {
              const key = `${i}-${k}`, on = state.tengo.has(key);
              return `<li><label class="ing ${on ? "tengo" : ""}">
                <input type="checkbox" data-tengo="${key}" ${on ? "checked" : ""} aria-label="Ya tengo ${esc(x.nombre)}" />
                <span class="ing-name">${esc(x.nombre)}<span class="ing-qty">${esc(x.cantidad)}</span></span>
                <span class="ing-price">${esc(dinero(x.precio_estimado, mon))}</span>
              </label></li>`;
            }).join("")}
          </ul>
          <div class="ing-sum"><span>A comprar hoy</span><span>${esc(dinero(round2(d.costo_dia - tengoDia), mon))}</span></div>
        </section>
        <section class="day-col" aria-labelledby="pasosTit">
          <div class="col-title"><h4 id="pasosTit">Preparación</h4><small>Toca un paso al terminarlo</small></div>
          <ol class="steps">
            ${d.pasos.map((p, k) => `<li class="${state.hechos.has(`${i}-${k}`) ? "hecho" : ""}"><button type="button" data-paso="${i}-${k}" aria-pressed="${state.hechos.has(`${i}-${k}`)}"><span>${esc(p)}</span></button></li>`).join("")}
          </ol>
          ${d.consejo_ahorro ? `<p class="tip"><b>Para ahorrar:</b> ${esc(d.consejo_ahorro)}</p>` : ""}
        </section>
      </div>`;
    if (animar) { el.classList.remove("cambia"); void el.offsetWidth; el.classList.add("cambia"); }
    $("#btnCocinar").addEventListener("click", () => abrirCocina(i));
    $("#btnCambiar").addEventListener("click", (e) => cambiarPlato(i, e.currentTarget));
  }

  $("#detalleDia").addEventListener("change", (e) => {
    const key = e.target.dataset.tengo; if (!key) return;
    if (e.target.checked) state.tengo.add(key); else state.tengo.delete(key);
    guardarPlan();
    renderPresupuesto(); renderTicket();
    const scroll = window.scrollY; renderDia(); window.scrollTo(0, scroll);
    const cb = $(`[data-tengo="${key}"]`); if (cb) cb.focus({ preventScroll: true });
  });
  $("#detalleDia").addEventListener("click", (e) => {
    const b = e.target.closest("[data-paso]"); if (!b) return;
    const key = b.dataset.paso;
    if (state.hechos.has(key)) state.hechos.delete(key); else state.hechos.add(key);
    guardarPlan();
    b.parentElement.classList.toggle("hecho", state.hechos.has(key));
    b.setAttribute("aria-pressed", String(state.hechos.has(key)));
  });

  /* ---------------- Ticket de compras ---------------- */
  function listaCompras() {
    const plan = state.plan, mapa = new Map();
    plan.dias.forEach((d, i) => d.ingredientes.forEach((x, k) => {
      const clave = x.nombre.toLowerCase().replace(/\s+/g, " ").trim();
      const it = mapa.get(clave) || { nombre: x.nombre, cantidades: [], total: 0, tengo: true };
      it.cantidades.push(x.cantidad); it.total += x.precio_estimado;
      if (!state.tengo.has(`${i}-${k}`)) it.tengo = false;
      mapa.set(clave, it);
    }));
    return [...mapa.values()].sort((a, b) => a.tengo - b.tengo || b.total - a.total);
  }

  function renderTicket() {
    const plan = state.plan, mon = plan.datos.moneda, items = listaCompras();
    const total = totalPlan(plan), tengo = costoTengo();
    const fecha = new Date().toLocaleDateString("es", { day: "2-digit", month: "short", year: "numeric" });
    $("#ticketSub").textContent = `${fecha} · ${plan.dias.length} día(s) · ${plan.datos.personas} persona(s)`;
    $("#ticketLista").innerHTML = items.map((it, n) => `
      <li>
        <label><input type="checkbox" id="tk-${n}" ${it.tengo ? "checked" : ""} /><span><span class="t-name">${esc(it.nombre)}</span><br><span class="t-qty">${esc(it.cantidades.join(" + "))}</span></span></label>
        <span class="t-price">${esc(dinero(round2(it.total), mon))}</span>
      </li>`).join("");
    $("#ticketTotal").innerHTML = `
      <div><span>Subtotal</span><span>${esc(dinero(total, mon))}</span></div>
      ${tengo > 0 ? `<div><span>Ya en casa</span><span>−${esc(dinero(tengo, mon))}</span></div>` : ""}
      <div class="grande"><span>TOTAL</span><span>${esc(dinero(round2(total - tengo), mon))}</span></div>`;
  }

  async function copiarLista() {
    if (!state.plan) return;
    const mon = state.plan.datos.moneda;
    const items = listaCompras().filter((it) => !it.tengo);
    const texto = [
      `Lista de compras · EcoMenú IA`,
      ...items.map((it) => `- ${it.nombre} (${it.cantidades.join(" + ")}) · ${dinero(round2(it.total), mon)}`),
      `Total: ${dinero(round2(totalPlan(state.plan) - costoTengo()), mon)}`
    ].join("\n");
    try { await navigator.clipboard.writeText(texto); toast("Lista copiada al portapapeles"); }
    catch {
      const ta = document.createElement("textarea");
      ta.value = texto; ta.style.position = "fixed"; ta.style.opacity = "0";
      document.body.appendChild(ta); ta.select();
      let ok = false; try { ok = document.execCommand("copy"); } catch { /* nada */ }
      ta.remove();
      toast(ok ? "Lista copiada al portapapeles" : "No se pudo copiar. Selecciona el ticket y cópialo a mano.");
    }
  }
  $("#btnCopiar").addEventListener("click", copiarLista);
  $("#btnNuevo").addEventListener("click", () => {
    irAPaso(1, { foco: false });
    $("#asistente").scrollIntoView({ behavior: "smooth", block: "center" });
    setTimeout(() => $("#presupuesto").focus({ preventScroll: true }), 400);
  });

  /* ================================================================== */
  /* Modo cocina                                                         */
  /* ================================================================== */
  const cocina = { dia: 0, paso: 0, restante: 0, intervalo: null, wake: null };
  const dlgCocina = $("#modoCocina");

  function minutosDe(texto) {
    const m = texto.match(/(\d+)\s*(?:[-–a]\s*(\d+))?\s*(?:min|minutos)\b/i);
    return m ? Number(m[2] || m[1]) : 0;
  }

  function pararTimer() {
    clearInterval(cocina.intervalo); cocina.intervalo = null;
    $("#cocinaReloj").classList.remove("listo");
  }

  function pintarReloj() {
    const s = Math.max(0, cocina.restante);
    $("#cocinaReloj").textContent = `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
  }

  function sonar() {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      [0, 0.35, 0.7].forEach((t) => {
        const o = ctx.createOscillator(), g = ctx.createGain();
        o.frequency.value = 880; o.connect(g); g.connect(ctx.destination);
        g.gain.setValueAtTime(0.0001, ctx.currentTime + t);
        g.gain.exponentialRampToValueAtTime(0.3, ctx.currentTime + t + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + t + 0.3);
        o.start(ctx.currentTime + t); o.stop(ctx.currentTime + t + 0.32);
      });
    } catch { /* sin audio */ }
  }

  function pintarPaso() {
    const d = state.plan.dias[cocina.dia], total = d.pasos.length, p = d.pasos[cocina.paso];
    pararTimer();
    $("#cocinaDia").textContent = `Día ${d.dia} · ${DIAS_SEMANA[cocina.dia]}`;
    $("#cocinaPlato").textContent = d.platillo;
    $("#cocinaContador").textContent = `Paso ${cocina.paso + 1} de ${total}`;
    $("#cocinaBarra").style.width = `${((cocina.paso + 1) / total) * 100}%`;
    const elPaso = $("#cocinaPaso");
    elPaso.textContent = p; elPaso.style.animation = "none"; void elPaso.offsetWidth; elPaso.style.animation = "";
    const min = minutosDe(p);
    $("#cocinaTimer").hidden = !min;
    if (min) { cocina.restante = min * 60; pintarReloj(); $("#btnTimer").textContent = `Temporizador de ${min} min`; }
    $("#cocinaAnterior").disabled = cocina.paso === 0;
    $("#cocinaSiguiente").textContent = cocina.paso === total - 1 ? "Terminar" : "Siguiente paso";
  }

  async function abrirCocina(i) {
    cocina.dia = i; cocina.paso = 0;
    const d = state.plan.dias[i];
    const primeroPendiente = d.pasos.findIndex((_, k) => !state.hechos.has(`${i}-${k}`));
    if (primeroPendiente > 0) cocina.paso = primeroPendiente;
    pintarPaso();
    dlgCocina.showModal();
    try { cocina.wake = await navigator.wakeLock?.request("screen"); } catch { /* sin bloqueo de pantalla */ }
  }

  function moverCocina(delta) {
    const d = state.plan.dias[cocina.dia];
    if (delta > 0) state.hechos.add(`${cocina.dia}-${cocina.paso}`);
    const n = cocina.paso + delta;
    if (n >= d.pasos.length) { dlgCocina.close(); toast("¡Buen provecho!"); return; }
    cocina.paso = Math.max(0, n);
    guardarPlan(); pintarPaso();
  }

  $("#cocinaSiguiente").addEventListener("click", () => moverCocina(1));
  $("#cocinaAnterior").addEventListener("click", () => moverCocina(-1));
  $("#cerrarCocina").addEventListener("click", () => dlgCocina.close());
  dlgCocina.addEventListener("keydown", (e) => {
    if (e.key === "ArrowRight") { e.preventDefault(); moverCocina(1); }
    if (e.key === "ArrowLeft") { e.preventDefault(); moverCocina(-1); }
  });
  dlgCocina.addEventListener("close", () => {
    pararTimer();
    try { cocina.wake?.release(); } catch { /* nada */ }
    cocina.wake = null;
    if (state.plan) renderDia();
  });
  $("#btnTimer").addEventListener("click", () => {
    if (cocina.intervalo) { pararTimer(); $("#btnTimer").textContent = "Reanudar"; return; }
    if (cocina.restante <= 0) cocina.restante = minutosDe(state.plan.dias[cocina.dia].pasos[cocina.paso]) * 60;
    $("#btnTimer").textContent = "Pausar";
    cocina.intervalo = setInterval(() => {
      cocina.restante -= 1; pintarReloj();
      if (cocina.restante <= 0) {
        pararTimer(); $("#cocinaReloj").classList.add("listo");
        $("#btnTimer").textContent = "Reiniciar"; sonar(); toast("¡Tiempo cumplido!");
      }
    }, 1000);
  });

  /* ================================================================== */
  /* Ajustes                                                             */
  /* ================================================================== */
  const dlgAjustes = $("#ajustes");
  $("#btnAjustes").addEventListener("click", () => {
    $("#apiKey").value = ajustes.key;
    $("#apiKey").type = "password"; $("#btnVerKey").textContent = "Mostrar";
    $("#modelo").value = [...$("#modelo").options].some((o) => o.value === ajustes.modelo) ? ajustes.modelo : "auto";
    $("#recordarKey").checked = !!store.get(K.key, "");
    $("#modoDemo").checked = ajustes.demo;
    let origen;
    if (cfgLocal.apiKey) origen = "Ya hay una clave cargada desde js/config.local.js. Si escribes otra aquí, se usará esa en su lugar.";
    else if (enServidorWeb()) origen = "Sin clave aquí, la app usa la clave guardada en el servidor (Vercel), si existe.";
    else origen = "Pega tu clave de Google AI Studio para generar recetas con Gemini.";
    $("#ajustesOrigen").textContent = origen;
    dlgAjustes.showModal();
  });
  $("#btnVerKey").addEventListener("click", () => {
    const ver = $("#apiKey").type === "password";
    $("#apiKey").type = ver ? "text" : "password";
    $("#btnVerKey").textContent = ver ? "Ocultar" : "Mostrar";
  });
  $("#btnBorrarKey").addEventListener("click", () => {
    $("#apiKey").value = ""; ajustes.key = ""; store.del(K.key); actualizarConexion();
    toast("Clave borrada de este navegador");
  });
  dlgAjustes.addEventListener("close", () => {
    if (dlgAjustes.returnValue !== "save") return;
    ajustes.key = $("#apiKey").value.trim();
    ajustes.modelo = $("#modelo").value;
    ajustes.demo = $("#modoDemo").checked;
    if ($("#recordarKey").checked && ajustes.key) store.set(K.key, ajustes.key); else store.del(K.key);
    store.set(K.modelo, ajustes.modelo); store.set(K.demo, ajustes.demo);
    state.sinServidor = false;
    actualizarConexion();
    toast("Ajustes guardados");
  });

  /* ================================================================== */
  /* Toast                                                               */
  /* ================================================================== */
  let toastTimer;
  function toast(msg) {
    const t = $("#toast");
    t.textContent = msg; t.hidden = false;
    t.style.animation = "none"; void t.offsetWidth; t.style.animation = "";
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { t.hidden = true; }, 3200);
  }

  /* ================================================================== */
  /* Inicio                                                              */
  /* ================================================================== */
  /* Si una foto no carga, se oculta y queda el fondo marrón de la tarjeta. */
  document.addEventListener("error", (e) => { if (e.target.tagName === "IMG") e.target.style.visibility = "hidden"; }, true);

  function iniciar() {
    const fp = $("#factPrecios");
    if (fp) fp.textContent = Object.values(PRECIOS_REFERENCIA).reduce((s, g) => s + Object.keys(g).length, 0);

    selMoneda.value = state.datos.moneda;
    $(`#comidas input[value="${state.datos.comida}"]`)?.click();
    $("#notas").value = state.datos.notas || "";
    sincronizarPresupuesto(state.datos.presupuesto);
    renderSemana();
    renderGrupo("gustos"); renderGrupo("alergias");
    irAPaso(1, { foco: false });
    actualizarConexion();

    const guardado = store.get(K.plan);
    if (guardado?.plan?.dias?.length) {
      state.plan = guardado.plan;
      state.tengo = new Set(guardado.tengo || []);
      state.hechos = new Set(guardado.hechos || []);
      state.diaSel = Math.min(guardado.diaSel || 0, state.plan.dias.length - 1);
      renderResultados();
    }
  }
  iniciar();
})();
