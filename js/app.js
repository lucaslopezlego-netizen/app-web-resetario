/**
 * Eco Menú — Lógica de la interfaz.
 * Asistente de 5 pasos → generación con Gemini (directa, vía servidor o demo)
 * → resultados: cada día con desayuno, almuerzo y/o cena; "ya lo tengo en casa",
 *   cambiar una receta, modo cocina con temporizador y lista de compras por pasillo.
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
  /** Claves globales del dispositivo (ajustes de IA). Los datos de cada persona van en su propio almacén. */
  const K = { key: "eco.key", modelo: "eco.modelo", demo: "eco.demo" };

  const DIAS_SEMANA = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];
  const COMIDAS = core.COMIDAS; // ["desayuno", "almuerzo", "cena"]
  const ETIQUETA = { desayuno: "Desayuno", almuerzo: "Almuerzo", cena: "Cena" };
  /** Tipos de cambio aproximados a USD, solo para orientar el indicador del paso 1. */
  const A_USD = { USD: 1, EUR: 1.08, MXN: 0.055, ARS: 0.001, COP: 0.00025, CLP: 0.00105, PEN: 0.27, BOB: 0.145, UYU: 0.025, GTQ: 0.13, DOP: 0.016 };
  const MENSAJES_CARGA = [
    "Revisando precios del mercado…", "Comparando el kilo de arroz y de lentejas…", "Descartando ingredientes con alérgenos…",
    "Repartiendo el presupuesto entre las comidas…", "Buscando platos que reutilicen ingredientes…", "Ajustando cantidades por persona…",
    "Calculando el costo de cada receta…", "Escribiendo los pasos de preparación…", "Ordenando la lista de compras…"
  ];

  function dinero(v, moneda) {
    try { return new Intl.NumberFormat("es", { style: "currency", currency: moneda, maximumFractionDigits: 2 }).format(v); }
    catch { return `${moneda} ${num(v).toFixed(2)}`; }
  }
  const listaNatural = (arr) => arr.length > 1 ? `${arr.slice(0, -1).join(", ")} y ${arr[arr.length - 1]}` : (arr[0] || "");

  /* ================================================================== */
  /* Estado                                                              */
  /* ================================================================== */
  const datosIniciales = () => ({ presupuesto: 40, moneda: "USD", diasSemana: [0, 1, 2], personas: 2, comidas: ["almuerzo"], gustos: [], alergias: [], notas: "" });
  const state = {
    usuario: null, us: null,          // persona con sesión y su almacén
    paso: 1, maxPaso: 1,
    datos: datosIniciales(),
    plan: null, menuId: null, diaSel: 0, comidaSel: 0,
    tengo: new Set(), hechos: new Set(), // claves "dia.comida.indice"
    generando: false, sinServidor: false
  };

  function cargarDatosUsuario() {
    const g = (state.us && state.us.get("datos")) || {};
    const base = { ...datosIniciales(), ...g };
    base.comidas = core.sanearComidas(g.comidas || g.comida ? g : datosIniciales());
    base.diasSemana = core.sanearDiasSemana(g.diasSemana || g.dias ? g : datosIniciales());
    delete base.comida; delete base.dias;
    state.datos = base;
  }
  const cfgLocal = window.ECOMENU_CONFIG || {};
  const ajustes = {
    key: store.get(K.key, ""),
    modelo: store.get(K.modelo, cfgLocal.modelo || "auto"),
    demo: store.get(K.demo, false)
  };
  const claveActiva = () => (ajustes.key || cfgLocal.apiKey || "").trim();
  const enServidorWeb = () => /^https?:$/.test(location.protocol) && !state.sinServidor;
  const kIng = (d, c, i) => `${d}.${c}.${i}`;
  /** Nombre del día i del plan abierto (los días pueden no ser seguidos). */
  const diaPlan = (i, plan = state.plan) => DIAS_SEMANA[plan?.datos?.diasSemana?.[i] ?? i];

  /* ================================================================== */
  /* Indicador de conexión                                               */
  /* ================================================================== */
  function actualizarConexion() {
    const el = $("#conexion"), txt = $("#conexionTexto");
    if (!el || !txt) return; // el indicador ya no se muestra en la barra superior
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
      if (i === n) b.setAttribute("aria-current", "step"); else b.removeAttribute("aria-current");
      b.classList.toggle("hecho", i !== n && i <= state.maxPaso);
      b.disabled = i > state.maxPaso;
    });
    $("#stepperFill").style.width = `${(n / 5) * 100}%`;
    btnAtras.style.visibility = n === 1 ? "hidden" : "visible";
    btnSig.textContent = n === 5 ? "Generar menú con IA" : "Siguiente";
    if (n === 5) renderRevision();
    setStatus("");
    if (foco) {
      const objetivo = n === 1 ? $("#presupuesto") : $(`.step[data-step="${n}"] .step-title`);
      if (objetivo) { objetivo.setAttribute("tabindex", "-1"); objetivo.focus({ preventScroll: true }); }
    }
  }

  function validarPaso(n) {
    if (n === 1) {
      const v = num($("#presupuesto").value, NaN);
      if (!(v > 0)) { $("#errPresupuesto").textContent = "Escribe un presupuesto mayor que 0."; $("#presupuesto").focus(); return false; }
      $("#errPresupuesto").textContent = "";
    }
    if (n === 2) {
      let ok = true;
      if (!state.datos.diasSemana.length) { $("#errDias").textContent = "Elige al menos un día."; ok = false; } else $("#errDias").textContent = "";
      if (!state.datos.comidas.length) { $("#errComidas").textContent = "Elige al menos una comida."; ok = false; } else $("#errComidas").textContent = "";
      return ok;
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

  function guardarDatos() { if (state.us) state.us.set("datos", state.datos); }

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
    const nComidas = Math.max(1, d.comidas.length);
    const nDias = Math.max(1, d.diasSemana.length);
    const platos = nDias * d.personas * nComidas;
    const porPlato = d.presupuesto / Math.max(1, platos);
    const usd = porPlato * (A_USD[d.moneda] || 1);
    $("#insightValor").textContent = d.presupuesto > 0 ? dinero(porPlato, d.moneda) : "—";
    let txt, color;
    if (!(d.presupuesto > 0)) { txt = "Escribe cuánto quieres gastar."; color = "var(--muted)"; }
    else if (usd < 1.2) { txt = "Muy ajustado. La base serán arroz, legumbres y huevo."; color = "var(--danger)"; }
    else if (usd < 2.5) { txt = "Ajustado pero posible: cocina casera y económica."; color = "var(--warn)"; }
    else if (usd < 4.5) { txt = "Cómodo: hay espacio para variedad y algo de carne."; color = "var(--ok)"; }
    else { txt = "Holgado: puedes darte algunos gustos."; color = "var(--ok)"; }
    const cuenta = nComidas > 1
      ? `${nDias} día(s) × ${nComidas} comidas × ${d.personas} persona(s) = ${platos} platos.`
      : `${nDias} día(s) × ${d.personas} persona(s) = ${platos} platos.`;
    $("#insightTexto").textContent = `${cuenta} ${txt}`;
    const m = $("#insightMeter");
    m.style.width = `${Math.min(100, (usd / 6) * 100)}%`;
    m.style.background = color;
  }

  inpPres.addEventListener("input", () => sincronizarPresupuesto(inpPres.value, "input"));
  rango.addEventListener("input", () => sincronizarPresupuesto(rango.value, "rango"));
  $("#quickMontos").addEventListener("click", (e) => { const b = e.target.closest("button"); if (b) sincronizarPresupuesto(b.dataset.monto); });
  selMoneda.addEventListener("change", () => { state.datos.moneda = selMoneda.value; actualizarInsight(); guardarDatos(); });

  /* ---------------- Paso 2: días, personas y comidas ---------------- */
  /** "Lunes, miércoles y viernes" o "Lunes a viernes" si son seguidos. */
  function textoDias(indices) {
    if (!indices.length) return "";
    if (indices.length === 7) return "Toda la semana";
    const seguidos = indices.length > 2 && indices.every((d, k) => k === 0 || d === indices[k - 1] + 1);
    if (seguidos) return `${DIAS_SEMANA[indices[0]]} a ${DIAS_SEMANA[indices[indices.length - 1]].toLowerCase()}`;
    return listaNatural(indices.map((d, k) => (k === 0 ? DIAS_SEMANA[d] : DIAS_SEMANA[d].toLowerCase())));
  }

  function renderSemana() {
    const sel = state.datos.diasSemana;
    $$("#semana button").forEach((btn) => btn.setAttribute("aria-pressed", String(sel.includes(Number(btn.dataset.dia)))));
    const n = sel.length;
    $("#semanaTexto").textContent = n ? `Plan de ${n} ${n === 1 ? "día" : "días"} · ${textoDias(sel)}` : "Elige al menos un día";
    $("#personas").textContent = state.datos.personas;
    actualizarInsight();
  }

  function renderComidas() {
    $$("#comidas input").forEach((i) => { i.checked = state.datos.comidas.includes(i.value); });
    actualizarInsight();
  }

  $("#semana").addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-dia]"); if (!btn) return;
    const d = Number(btn.dataset.dia);
    const sel = new Set(state.datos.diasSemana);
    if (sel.has(d)) sel.delete(d); else sel.add(d);
    state.datos.diasSemana = [...sel].sort((x, y) => x - y);
    if (state.datos.diasSemana.length) $("#errDias").textContent = "";
    renderSemana(); guardarDatos();
  });
  $("#menosPersonas").addEventListener("click", () => { state.datos.personas = Math.max(1, state.datos.personas - 1); renderSemana(); guardarDatos(); });
  $("#masPersonas").addEventListener("click", () => { state.datos.personas = Math.min(12, state.datos.personas + 1); renderSemana(); guardarDatos(); });
  $("#comidas").addEventListener("change", () => {
    state.datos.comidas = COMIDAS.filter((c) => $$("#comidas input:checked").some((i) => i.value === c));
    if (state.datos.comidas.length) $("#errComidas").textContent = "";
    renderComidas(); guardarDatos();
  });

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
      ["Días", `${textoDias(d.diasSemana)} · ${d.personas} persona(s)`, 2],
      ["Comidas", listaNatural(d.comidas.map((c) => ETIQUETA[c].toLowerCase())).replace(/^./, (x) => x.toUpperCase()), 2],
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
        onModelo: (m) => { if (!$("#cargando").hidden) $("#cargandoTitulo").textContent = `Cocinando con ${m}`; }
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
          if (/GEMINI_API_KEY/.test(data.error || "")) { state.motivoDemo = "vercel-sin-clave"; throw new SinServidor(); }
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

  function normalizarReceta(r, tipo, personas) {
    const ingredientes = (Array.isArray(r?.ingredientes) ? r.ingredientes : []).map((x) => ({
      nombre: String(x?.nombre ?? "Ingrediente").trim(),
      cantidad: String(x?.cantidad ?? "").trim(),
      precio_estimado: round2(Math.max(0, num(x?.precio_estimado)))
    }));
    return {
      tipo,
      platillo: String(r?.platillo || ETIQUETA[tipo]),
      descripcion: String(r?.descripcion || ""),
      tiempo_preparacion_min: Math.max(0, Math.round(num(r?.tiempo_preparacion_min))),
      porciones: Math.max(1, Math.round(num(r?.porciones, personas))),
      costo: round2(ingredientes.reduce((s, x) => s + x.precio_estimado, 0)),
      ingredientes,
      pasos: (Array.isArray(r?.pasos) ? r.pasos : []).map((p) => String(p).replace(/^\s*(paso\s*)?\d+\s*[.):-]\s*/i, "").trim()).filter(Boolean),
      consejo_ahorro: String(r?.consejo_ahorro || "")
    };
  }

  /** Ordena las recetas del día según las comidas pedidas; si la IA repite o se salta un tipo, se corrige por posición. */
  function normalizarDia(d, numero, datos) {
    const recibidas = Array.isArray(d?.comidas) ? d.comidas : d?.ingredientes ? [{ ...d, tipo: datos.comidas[0] }] : [];
    const libres = [...recibidas];
    const comidas = datos.comidas.map((tipo, i) => {
      let k = libres.findIndex((r) => r?.tipo === tipo);
      if (k < 0) k = libres.length ? 0 : -1;
      const r = k >= 0 ? libres.splice(k, 1)[0] : null;
      return r ? normalizarReceta(r, tipo, datos.personas) : null;
    }).filter(Boolean);
    return { dia: numero, comidas, costo_dia: round2(comidas.reduce((s, c) => s + c.costo, 0)) };
  }

  function normalizarPlan(raw, datos) {
    if (!raw || !Array.isArray(raw.dias) || !raw.dias.length) throw new Error("La IA devolvió un plan vacío. Vuelve a intentarlo.");
    const dias = raw.dias.slice(0, datos.dias).map((d, i) => normalizarDia(d, i + 1, datos)).filter((d) => d.comidas.length);
    if (!dias.length) throw new Error("La IA devolvió un plan sin recetas. Vuelve a intentarlo.");
    return { datos: { ...datos }, comentario: String(raw.resumen?.comentario || ""), dias };
  }

  const totalPlan = (plan) => round2(plan.dias.reduce((s, d) => s + d.costo_dia, 0));
  const recalcularDia = (d) => { d.costo_dia = round2(d.comidas.reduce((s, c) => s + c.costo, 0)); };

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

      plan.fuente = fuente; plan.modelo = modelo; plan.creado = Date.now();
      state.plan = plan; state.menuId = `m_${Date.now().toString(36)}`; state.diaSel = 0; state.comidaSel = 0;
      state.tengo = new Set(); state.hechos = new Set();
      guardarPlan();
      mostrarCarga(false);
      renderResultados(true);
      renderMisMenus(); actualizarFacts();
      toast(fuente === "demo" ? "Plan de ejemplo listo" : "Tu menú está listo");
    } catch (err) {
      console.error(err);
      mostrarCarga(false);
      setStatus(err.message || "No se pudo generar el menú. Vuelve a intentarlo.", "error");
    }
  }

  async function cambiarReceta(di, ci, boton) {
    const plan = state.plan; if (!plan || state.generando) return;
    const datos = plan.datos;
    const actual = plan.dias[di].comidas[ci];
    const resto = totalPlan(plan) - actual.costo;
    const disponible = round2(Math.max(datos.presupuesto - resto, actual.costo * 0.8, 0.5));
    state.generando = true;
    boton.disabled = true; boton.textContent = `Buscando otro ${ETIQUETA[actual.tipo].toLowerCase()}…`;
    try {
      const evitar = plan.dias.flatMap((d) => d.comidas.map((c) => c.platillo));
      const extra = { diaNumero: di + 1, comidaTipo: actual.tipo, evitar };
      const diaReal = datos.diasSemana?.[di] ?? di;
      const { plan: raw } = await pedirPlan({ ...datos, presupuesto: disponible, diasSemana: [diaReal], dias: 1, comidas: [actual.tipo] }, extra);
      const recibida = raw?.dias?.[0]?.comidas?.[0];
      if (!recibida) throw new Error("No llegó ninguna receta nueva.");
      plan.dias[di].comidas[ci] = normalizarReceta(recibida, actual.tipo, datos.personas);
      recalcularDia(plan.dias[di]);
      const prefijo = `${di}.${ci}.`;
      [...state.tengo].filter((k) => k.startsWith(prefijo)).forEach((k) => state.tengo.delete(k));
      [...state.hechos].filter((k) => k.startsWith(prefijo)).forEach((k) => state.hechos.delete(k));
      guardarPlan();
      renderResultados();
      toast(`Nuevo ${ETIQUETA[actual.tipo].toLowerCase()} para el ${diaPlan(di).toLowerCase()}: ${plan.dias[di].comidas[ci].platillo}`);
    } catch (err) {
      toast(err.message || "No se pudo cambiar la receta.");
      boton.disabled = false; boton.textContent = `Cambiar ${ETIQUETA[actual.tipo].toLowerCase()}`;
    } finally {
      state.generando = false;
    }
  }

  /* ---------------- Mis menús (por usuario) ---------------- */
  const leerMenus = () => (state.us ? state.us.get("menus", []) : []);
  const escribirMenus = (lista) => { if (state.us) state.us.set("menus", lista); };

  /** Guarda el menú abierto (lo que ya tienes en casa, pasos hechos y selección). Crea la entrada si es nuevo. */
  function guardarPlan() {
    if (!state.us || !state.plan || !state.menuId) return;
    const menus = leerMenus();
    const entrada = { id: state.menuId, actualizado: Date.now(), plan: state.plan, tengo: [...state.tengo], hechos: [...state.hechos], diaSel: state.diaSel, comidaSel: state.comidaSel };
    const k = menus.findIndex((m) => m.id === state.menuId);
    if (k >= 0) menus[k] = { ...menus[k], ...entrada };
    else menus.unshift({ ...entrada, creado: Date.now() });
    escribirMenus(menus.slice(0, 30));
    state.us.set("actual", state.menuId);
  }

  function abrirMenu(id, scroll = false) {
    const m = leerMenus().find((x) => x.id === id);
    if (!m?.plan?.dias?.[0]?.comidas) return false;
    state.plan = m.plan; state.menuId = m.id;
    state.tengo = new Set(m.tengo || []); state.hechos = new Set(m.hechos || []);
    state.diaSel = Math.min(m.diaSel || 0, m.plan.dias.length - 1);
    state.comidaSel = m.comidaSel || 0;
    state.us.set("actual", id);
    renderResultados(scroll);
    renderMisMenus();
    return true;
  }

  function eliminarMenu(id) {
    escribirMenus(leerMenus().filter((m) => m.id !== id));
    if (state.menuId === id) {
      state.plan = null; state.menuId = null;
      state.us.del("actual");
      $("#resultados").hidden = true;
    }
    renderMisMenus(); actualizarFacts();
    toast("Menú eliminado");
  }

  /* ================================================================== */
  /* Resultados                                                          */
  /* ================================================================== */
  const costoTengo = () => {
    let s = 0;
    state.tengo.forEach((k) => {
      const [d, c, i] = k.split(".").map(Number);
      s += state.plan.dias[d]?.comidas[c]?.ingredientes[i]?.precio_estimado || 0;
    });
    return round2(s);
  };

  function renderResultados(scroll = false) {
    const plan = state.plan; if (!plan) return;
    const { datos } = plan;
    $("#resultados").hidden = false;
    $("#resEyebrow").textContent = plan.fuente === "demo" ? "Plan de ejemplo" : `Generado con ${plan.modelo || "Gemini"}`;
    const comidasTxt = listaNatural(datos.comidas.map((c) => ETIQUETA[c].toLowerCase()));
    $("#resTitulo").textContent = `${textoDias(datos.diasSemana || plan.dias.map((_, i) => i))}: ${comidasTxt} para ${datos.personas}`;
    $("#resGuardado").hidden = !state.menuId;
    renderPresupuesto();
    renderTira();
    renderDia();
    renderTicket();
    if (scroll) { const r = $("#resultados"); r.focus({ preventScroll: true }); r.scrollIntoView({ behavior: "smooth", block: "start" }); }
  }

  function detectarConflictos(plan) {
    const terms = plan.datos.alergias.map((a) => a.toLowerCase()).filter((a) => a.length > 2);
    const out = [];
    plan.dias.forEach((d, di) => d.comidas.forEach((c) => c.ingredientes.forEach((ing) => {
      const n = ing.nombre.toLowerCase();
      terms.forEach((t) => { if (n.includes(t) && !/\bsin\s/.test(n)) out.push(`${diaPlan(di).toLowerCase()} (${c.tipo}): ${ing.nombre}`); });
    })));
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
    const porTipo = Object.fromEntries(datos.comidas.map((t) => [t, round2(plan.dias.reduce((s, d) => s + (d.comidas.find((c) => c.tipo === t)?.costo || 0), 0))]));
    const avisos = [];
    if (plan.fuente === "demo") {
      let motivo;
      if (ajustes.demo) motivo = "Estás viendo recetas de ejemplo porque el modo de ejemplo está activado. Desactívalo en Menú → Ajustes de la IA.";
      else if (state.motivoDemo === "vercel-sin-clave") motivo = "Estás viendo recetas de ejemplo: la app está publicada pero falta la variable GEMINI_API_KEY en Vercel (Settings → Environment Variables). También puedes pegar tu clave en Menú → Ajustes de la IA.";
      else motivo = "Estás viendo recetas de ejemplo porque no hay una clave de Gemini. Pégala en Menú → Ajustes de la IA y marca «Recordar la clave».";
      avisos.push(["info", motivo]);
    }
    if (gastar > pres) avisos.push(["danger", "El menú supera tu presupuesto. Marca lo que ya tienes en casa, cambia alguna receta o reduce días, comidas o personas."]);
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
        <div class="bars-head">
          <p class="bars-title">Costo por día</p>
          ${datos.comidas.length > 1 ? `<ul class="legend">${datos.comidas.map((t) => `<li><i class="sw-${t}"></i>${ETIQUETA[t]} <b>${esc(dinero(porTipo[t], mon))}</b></li>`).join("")}</ul>` : ""}
        </div>
        <div class="bars-grid">
          ${plan.dias.map((d, i) => {
            const h = Math.max(6, (d.costo_dia / maxDia) * 78);
            const detalle = d.comidas.map((c) => `${ETIQUETA[c.tipo]} ${dinero(c.costo, mon)}`).join(", ");
            return `<button type="button" class="bar ${i === state.diaSel ? "activo" : ""}" data-dia="${i}" style="--h:${h}px" aria-label="${diaPlan(i)}: ${esc(dinero(d.costo_dia, mon))} (${esc(detalle)})">
              <span class="bar-val">${esc(dinero(d.costo_dia, mon))}</span>
              <span class="stack" style="height:0">${d.comidas.map((c) => `<i class="sw-${c.tipo}" style="flex-grow:${Math.max(c.costo, 0.01)}"></i>`).join("")}</span>
            </button>`;
          }).join("")}
        </div>
        <div class="bars-labels" aria-hidden="true">${plan.dias.map((_, i) => `<span>${diaPlan(i).slice(0, 3)}</span>`).join("")}</div>
      </div>
      ${plan.comentario ? `<p class="budget-note">${esc(plan.comentario)}</p>` : ""}
      ${avisos.map(([t, m]) => `<p class="alert alert-${t}">${esc(m)}</p>`).join("")}`;

    requestAnimationFrame(() => requestAnimationFrame(() => {
      const fg = $("#presupuestoPanel .ring-fg");
      if (fg) fg.style.strokeDashoffset = (C * (1 - Math.min(1, pct))).toFixed(1);
      $$("#presupuestoPanel .bar").forEach((b) => { b.querySelector(".stack").style.height = b.style.getPropertyValue("--h"); });
    }));
  }

  /** Receta principal del día para la foto de la tarjeta: almuerzo, luego cena, luego desayuno. */
  const recetaPrincipal = (d) => d.comidas.find((c) => c.tipo === "almuerzo") || d.comidas.find((c) => c.tipo === "cena") || d.comidas[0];

  function renderTira() {
    const plan = state.plan, mon = plan.datos.moneda;
    $("#tiraDias").innerHTML = plan.dias.map((d, i) => `
      <button type="button" class="day-tab" role="tab" id="tab-${i}" data-dia="${i}" aria-selected="${i === state.diaSel}" aria-controls="detalleDia" tabindex="${i === state.diaSel ? 0 : -1}">
        <span class="day-tab-img" style="background-image:url('${fotoParaPlato(recetaPrincipal(d), i, 420)}')"></span>
        <span class="day-tab-body">
          <span class="day-tab-day">${diaPlan(i)}</span>
          <span class="day-tab-meals">${d.comidas.map((c) => `<span><b class="dot sw-${c.tipo}" aria-hidden="true"></b>${esc(c.platillo)}</span>`).join("")}</span>
          <span class="day-tab-cost">${esc(dinero(d.costo_dia, mon))}</span>
        </span>
      </button>`).join("");
  }

  function seleccionar(di, ci = 0, foco = false) {
    state.diaSel = di;
    state.comidaSel = Math.min(ci, state.plan.dias[di].comidas.length - 1);
    guardarPlan();
    $$("#tiraDias .day-tab").forEach((t, k) => { t.setAttribute("aria-selected", String(k === di)); t.tabIndex = k === di ? 0 : -1; });
    $$("#presupuestoPanel .bar").forEach((b, k) => b.classList.toggle("activo", k === di));
    renderDia(true);
    if (foco) $(`#tab-${di}`).focus();
  }

  $("#tiraDias").addEventListener("click", (e) => { const t = e.target.closest(".day-tab"); if (t) seleccionar(Number(t.dataset.dia), state.comidaSel); });
  $("#tiraDias").addEventListener("keydown", (e) => {
    const delta = { ArrowRight: 1, ArrowLeft: -1 }[e.key]; if (!delta || !state.plan) return;
    e.preventDefault();
    const n = state.plan.dias.length;
    seleccionar((state.diaSel + delta + n) % n, state.comidaSel, true);
  });
  $("#presupuestoPanel").addEventListener("click", (e) => {
    const b = e.target.closest(".bar"); if (!b) return;
    seleccionar(Number(b.dataset.dia), state.comidaSel);
    $("#detalleDia").scrollIntoView({ behavior: "smooth", block: "start" });
  });

  function renderDia(animar = false) {
    const plan = state.plan, di = state.diaSel, d = plan.dias[di], mon = plan.datos.moneda;
    const ci = Math.min(state.comidaSel, d.comidas.length - 1), r = d.comidas[ci];
    const el = $("#detalleDia");
    el.setAttribute("aria-labelledby", `tab-${di}`);
    const tengoRec = r.ingredientes.reduce((s, x, k) => s + (state.tengo.has(kIng(di, ci, k)) ? x.precio_estimado : 0), 0);
    const nombreComida = ETIQUETA[r.tipo].toLowerCase();
    el.innerHTML = `
      <div class="day-bar">
        <div class="day-bar-title">
          <p class="eyebrow eyebrow-dark">Día ${d.dia} · ${d.comidas.length} ${d.comidas.length === 1 ? "comida" : "comidas"}</p>
          <h3>${diaPlan(di)} <span>${esc(dinero(d.costo_dia, mon))}</span></h3>
        </div>
        ${d.comidas.length > 1 ? `<div class="meal-switch" role="tablist" aria-label="Comidas del ${diaPlan(di)}">
          ${d.comidas.map((c, k) => `<button type="button" role="tab" data-comida="${k}" aria-selected="${k === ci}" tabindex="${k === ci ? 0 : -1}">
            <b class="dot sw-${c.tipo}" aria-hidden="true"></b><span>${ETIQUETA[c.tipo]}</span><small>${esc(dinero(c.costo, mon))}</small></button>`).join("")}
        </div>` : ""}
      </div>
      <div class="meal" id="recetaActual">
        <header class="day-hero" style="background-image:url('${fotoParaPlato(r, di + ci, 1400)}')">
          <p class="eyebrow">${ETIQUETA[r.tipo]} · ${diaPlan(di)}</p>
          <h3>${esc(r.platillo)}</h3>
          ${r.descripcion ? `<p>${esc(r.descripcion)}</p>` : ""}
          <div class="chips">
            <span class="chip">${r.tiempo_preparacion_min} min</span>
            <span class="chip">${r.porciones} porciones</span>
            <span class="chip">${esc(dinero(r.costo, mon))}</span>
            <span class="chip">${esc(dinero(r.costo / Math.max(1, r.porciones), mon))} c/u</span>
          </div>
        </header>
        <div class="day-actions">
          <button type="button" class="btn btn-primary" id="btnCocinar" ${r.pasos.length ? "" : "disabled"}>Empezar a cocinar</button>
          <button type="button" class="btn btn-quiet" id="btnCambiar">Cambiar ${nombreComida}</button>
        </div>
        <div class="day-cols">
          <section class="day-col" aria-labelledby="ingTit">
            <div class="col-title"><h4 id="ingTit">Ingredientes</h4><small>Marca lo que ya tienes</small></div>
            <ul class="ings">
              ${r.ingredientes.map((x, k) => {
                const key = kIng(di, ci, k), on = state.tengo.has(key);
                return `<li><label class="ing ${on ? "tengo" : ""}">
                  <input type="checkbox" data-tengo="${key}" ${on ? "checked" : ""} aria-label="Ya tengo ${esc(x.nombre)}" />
                  <span class="ing-name">${esc(x.nombre)}<span class="ing-qty">${esc(x.cantidad)}</span></span>
                  <span class="ing-price">${esc(dinero(x.precio_estimado, mon))}</span>
                </label></li>`;
              }).join("")}
            </ul>
            <div class="ing-sum"><span>A comprar para este ${nombreComida}</span><span>${esc(dinero(round2(r.costo - tengoRec), mon))}</span></div>
          </section>
          <section class="day-col" aria-labelledby="pasosTit">
            <div class="col-title"><h4 id="pasosTit">Preparación</h4><small>Toca un paso al terminarlo</small></div>
            <ol class="steps">
              ${r.pasos.map((p, k) => { const key = kIng(di, ci, k); return `<li class="${state.hechos.has(key) ? "hecho" : ""}"><button type="button" data-paso="${key}" aria-pressed="${state.hechos.has(key)}"><span>${esc(p)}</span></button></li>`; }).join("")}
            </ol>
            ${r.consejo_ahorro ? `<p class="tip"><b>Para ahorrar:</b> ${esc(r.consejo_ahorro)}</p>` : ""}
          </section>
        </div>
      </div>`;
    if (animar) { const m = $("#recetaActual"); m.classList.remove("cambia"); void m.offsetWidth; m.classList.add("cambia"); }
    $("#btnCocinar").addEventListener("click", () => abrirCocina(di, ci));
    $("#btnCambiar").addEventListener("click", (e) => cambiarReceta(di, ci, e.currentTarget));
  }

  $("#detalleDia").addEventListener("click", (e) => {
    const sw = e.target.closest("[data-comida]");
    if (sw) { state.comidaSel = Number(sw.dataset.comida); guardarPlan(); renderDia(true); $(`[data-comida="${state.comidaSel}"]`).focus(); return; }
    const b = e.target.closest("[data-paso]"); if (!b) return;
    const key = b.dataset.paso;
    if (state.hechos.has(key)) state.hechos.delete(key); else state.hechos.add(key);
    guardarPlan();
    b.parentElement.classList.toggle("hecho", state.hechos.has(key));
    b.setAttribute("aria-pressed", String(state.hechos.has(key)));
  });
  $("#detalleDia").addEventListener("keydown", (e) => {
    if (!e.target.closest(".meal-switch")) return;
    const delta = { ArrowRight: 1, ArrowLeft: -1 }[e.key]; if (!delta) return;
    e.preventDefault();
    const n = state.plan.dias[state.diaSel].comidas.length;
    state.comidaSel = (state.comidaSel + delta + n) % n;
    guardarPlan(); renderDia(true); $(`[data-comida="${state.comidaSel}"]`).focus();
  });
  $("#detalleDia").addEventListener("change", (e) => {
    const key = e.target.dataset.tengo; if (!key) return;
    if (e.target.checked) state.tengo.add(key); else state.tengo.delete(key);
    guardarPlan();
    renderPresupuesto(); renderTicket();
    const scroll = window.scrollY; renderDia(); window.scrollTo(0, scroll);
    const cb = $(`[data-tengo="${key}"]`); if (cb) cb.focus({ preventScroll: true });
  });

  /* ---------------- Lista de compras ---------------- */
  const totalAComprar = () => round2(totalPlan(state.plan) - costoTengo());

  function renderTicket() {
    const plan = state.plan, mon = plan.datos.moneda;
    const grupos = EcoCompras.construir(plan, state.tengo);
    const total = totalPlan(plan), tengo = costoTengo();
    const fecha = new Date().toLocaleDateString("es", { day: "2-digit", month: "short", year: "numeric" });
    const nItems = grupos.reduce((s, g) => s + g.items.length, 0);
    $("#ticketSub").textContent = `${fecha} · ${plan.dias.length} día(s) · ${plan.datos.personas} persona(s) · ${nItems} productos`;
    let n = 0;
    $("#ticketLista").innerHTML = grupos.map((g) => `
      <li class="t-group">
        <p class="t-aisle"><span>${esc(g.nombre)}</span><span>${esc(dinero(g.total, mon))}</span></p>
        <ul>
          ${g.items.map((it) => `<li class="${it.enCasa ? "en-casa" : ""}">
            <label><input type="checkbox" id="tk-${n++}" ${it.enCasa ? "checked" : ""} /><span><span class="t-name">${esc(it.nombre)}</span><br><span class="t-qty">${esc(it.cantidad || "al gusto")}${it.usos > 1 ? ` · en ${it.usos} recetas` : ""}</span></span></label>
            <span class="t-price">${esc(dinero(it.enCasa ? it.total : it.aComprar, mon))}</span>
          </li>`).join("")}
        </ul>
      </li>`).join("");
    $("#ticketTotal").innerHTML = `
      <div><span>Subtotal</span><span>${esc(dinero(total, mon))}</span></div>
      ${tengo > 0 ? `<div><span>Ya en casa</span><span>−${esc(dinero(tengo, mon))}</span></div>` : ""}
      <div class="grande"><span>TOTAL</span><span>${esc(dinero(round2(total - tengo), mon))}</span></div>`;
  }

  async function copiarLista() {
    if (!state.plan) return;
    const mon = state.plan.datos.moneda;
    const texto = EcoCompras.aTexto({
      plan: state.plan,
      grupos: EcoCompras.construir(state.plan, state.tengo),
      dinero: (v) => dinero(round2(v), mon),
      diasSemana: state.plan.dias.map((_, i) => diaPlan(i)),
      rango: textoDias(state.plan.datos.diasSemana || state.plan.dias.map((_, i) => i)),
      etiquetasComida: ETIQUETA,
      totalComprar: totalAComprar()
    });
    try { await navigator.clipboard.writeText(texto); toast("Lista copiada: pégala en WhatsApp o en tus notas"); }
    catch {
      const ta = document.createElement("textarea");
      ta.value = texto; ta.style.position = "fixed"; ta.style.opacity = "0";
      document.body.appendChild(ta); ta.select();
      let ok = false; try { ok = document.execCommand("copy"); } catch { /* nada */ }
      ta.remove();
      toast(ok ? "Lista copiada: pégala en WhatsApp o en tus notas" : "No se pudo copiar. Selecciona el ticket y cópialo a mano.");
    }
  }
  $("#btnCopiar").addEventListener("click", copiarLista);
  function nuevoMenu() {
    irAPaso(1, { foco: false });
    $("#asistente").scrollIntoView({ behavior: "smooth", block: "center" });
    setTimeout(() => $("#presupuesto").focus({ preventScroll: true }), 400);
  }
  $("#btnNuevo").addEventListener("click", nuevoMenu);

  /* ================================================================== */
  /* Modo cocina                                                         */
  /* ================================================================== */
  const cocina = { dia: 0, com: 0, paso: 0, restante: 0, intervalo: null, wake: null };
  const dlgCocina = $("#modoCocina");
  const recetaCocina = () => state.plan.dias[cocina.dia].comidas[cocina.com];

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
    const r = recetaCocina(), total = r.pasos.length, p = r.pasos[cocina.paso];
    pararTimer();
    $("#cocinaDia").textContent = `${ETIQUETA[r.tipo]} · ${diaPlan(cocina.dia)}`;
    $("#cocinaPlato").textContent = r.platillo;
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

  async function abrirCocina(di, ci) {
    cocina.dia = di; cocina.com = ci; cocina.paso = 0;
    const r = recetaCocina();
    const pendiente = r.pasos.findIndex((_, k) => !state.hechos.has(kIng(di, ci, k)));
    if (pendiente > 0) cocina.paso = pendiente;
    pintarPaso();
    dlgCocina.showModal();
    try { cocina.wake = await navigator.wakeLock?.request("screen"); } catch { /* sin bloqueo de pantalla */ }
  }

  function moverCocina(delta) {
    const r = recetaCocina();
    if (delta > 0) state.hechos.add(kIng(cocina.dia, cocina.com, cocina.paso));
    const n = cocina.paso + delta;
    if (n >= r.pasos.length) { guardarPlan(); dlgCocina.close(); toast("¡Buen provecho!"); return; }
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
    if (cocina.restante <= 0) cocina.restante = minutosDe(recetaCocina().pasos[cocina.paso]) * 60;
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
    if (dlgMenu.open) dlgMenu.close();
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
    toastTimer = setTimeout(() => { t.hidden = true; }, 3400);
  }

  /* Si una foto no carga, se oculta y queda el fondo marrón de la tarjeta. */
  document.addEventListener("error", (e) => { if (e.target.tagName === "IMG") e.target.style.visibility = "hidden"; }, true);

  /* ================================================================== */
  /* Cuenta: crear, iniciar sesión, cerrar sesión                         */
  /* ================================================================== */
  const dlgAuth = $("#auth");
  let modoAuth = "crear";

  function fijarModoAuth(modo) {
    modoAuth = modo;
    const crear = modo === "crear";
    $("#recuperar").hidden = true;
    $("#formAuth").hidden = false;
    $(".auth-tabs").hidden = false;
    $("#olvideClave").hidden = crear;
    $("#authTitulo").textContent = crear ? "Crear cuenta" : "Iniciar sesión";
    $("#tabCrear").setAttribute("aria-selected", String(crear));
    $("#tabEntrar").setAttribute("aria-selected", String(!crear));
    $("#campoNombre").hidden = !crear;
    $("#authEnviar").textContent = crear ? "Crear cuenta" : "Entrar";
    $("#authClave").setAttribute("autocomplete", crear ? "new-password" : "current-password");
    $("#authClave").placeholder = crear ? "Mínimo 6 caracteres" : "Tu contraseña";
    const nube = EcoCuentas.modo === "supabase";
    $("#authNota").textContent = crear
      ? (nube ? "Podrás entrar con esta cuenta desde cualquier dispositivo. La sesión queda guardada en este." : "La cuenta y la sesión se guardan en este dispositivo.")
      : (nube ? "Usa el correo y la contraseña de tu cuenta de Eco Menú." : "Usa el correo y la contraseña con los que creaste tu cuenta en este dispositivo.");
    $("#authError").classList.remove("info");
    $("#authError").hidden = true;
    $$("#formAuth [aria-invalid]").forEach((i) => i.removeAttribute("aria-invalid"));
  }

  function abrirAuth(modo) {
    fijarModoAuth(modo);
    $("#authClave").value = "";
    dlgAuth.showModal();
    (modo === "crear" ? $("#authNombre") : $("#authCorreo")).focus();
  }

  document.addEventListener("click", (e) => {
    const b = e.target.closest("[data-auth]");
    if (b) abrirAuth(b.dataset.auth);
  });
  $$(".auth-tabs [data-modo]").forEach((t) => t.addEventListener("click", () => fijarModoAuth(t.dataset.modo)));
  $("#cerrarAuth").addEventListener("click", () => dlgAuth.close());

  /* ---------------- Recuperar contraseña: correo → código → nueva contraseña ---------------- */
  const rec = { paso: 1, correo: "", completado: false, espera: 0, timer: null };

  function recEstado(msg = "", tipo = "error") {
    const el = $("#recEstado");
    el.textContent = msg;
    el.className = `form-status ${tipo}`;
    el.hidden = !msg;
  }

  function irRec(n) {
    rec.paso = n;
    $$("#recuperar [data-rec-paso]").forEach((f) => { f.hidden = Number(f.dataset.recPaso) !== n; });
    $$(".recover-steps li").forEach((li) => {
      const k = Number(li.dataset.rec);
      if (k === n) li.setAttribute("aria-current", "step"); else li.removeAttribute("aria-current");
      li.classList.toggle("hecho", k < n);
    });
    $$("#recuperar [aria-invalid]").forEach((i) => i.removeAttribute("aria-invalid"));
    recEstado("");
    const foco = { 1: "#recCorreo", 2: "#recCodigo", 3: "#recClave" }[n];
    setTimeout(() => $(foco)?.focus(), 50);
  }

  function abrirRecuperacion(paso = 1) {
    $("#formAuth").hidden = true;
    $(".auth-tabs").hidden = true;
    $("#recuperar").hidden = false;
    $("#authTitulo").textContent = "Recuperar contraseña";
    rec.completado = false;
    if (paso === 1) $("#recCorreo").value = rec.correo || $("#authCorreo").value.trim();
    irRec(paso);
  }

  function marcarInvalido(sel, msg, tipo) {
    recEstado(msg, tipo);
    if (sel && tipo !== "info") { $(sel).setAttribute("aria-invalid", "true"); $(sel).focus(); }
  }

  /** Cuenta regresiva para "Reenviar código" (Supabase permite un correo por minuto). */
  function esperarReenvio(seg = 60) {
    clearInterval(rec.timer);
    rec.espera = seg;
    const btn = $("#recReenviar");
    const pintar = () => {
      btn.disabled = rec.espera > 0;
      btn.textContent = rec.espera > 0 ? `Reenviar código en ${rec.espera} s` : "Reenviar código";
    };
    pintar();
    rec.timer = setInterval(() => { rec.espera -= 1; pintar(); if (rec.espera <= 0) clearInterval(rec.timer); }, 1000);
  }

  async function enviarCodigo(boton) {
    const correo = $("#recCorreo").value.trim();
    const texto = boton.textContent;
    boton.disabled = true; boton.textContent = "Enviando…";
    try {
      await EcoCuentas.preparar();
      await EcoCuentas.enviarCodigo(correo);
      rec.correo = correo.toLowerCase();
      $("#recCorreoTxt").textContent = rec.correo;
      $("#recCodigo").value = "";
      $("#recCodigo").classList.remove("ok");
      irRec(2);
      recEstado("Código enviado. Puede tardar un minuto en llegar.", "info");
      esperarReenvio(60);
    } catch (ex) {
      if (rec.paso === 1) marcarInvalido(ex.campo === "correo" ? "#recCorreo" : null, ex.message, ex.tipo);
      else recEstado(ex.message, ex.tipo === "info" ? "info" : "error");
    } finally {
      boton.disabled = boton.id === "recReenviar" ? rec.espera > 0 : false;
      if (boton.id !== "recReenviar") boton.textContent = texto;
    }
  }

  // Al escribir, se quita la marca de error del campo y el aviso.
  $("#recuperar").addEventListener("input", (e) => {
    if (e.target.matches("input")) { e.target.removeAttribute("aria-invalid"); if (!$("#recEstado").classList.contains("info")) recEstado(""); }
  });
  $("#olvideClave").addEventListener("click", () => abrirRecuperacion(1));
  $("#recVolver").addEventListener("click", () => { fijarModoAuth("entrar"); if (rec.correo) $("#authCorreo").value = rec.correo; $("#authClave").focus(); });
  $("#recOtroCorreo").addEventListener("click", () => irRec(1));
  $("#formRecCorreo").addEventListener("submit", (e) => { e.preventDefault(); enviarCodigo($("#recEnviar")); });
  $("#recReenviar").addEventListener("click", (e) => enviarCodigo(e.currentTarget));

  const soloDigitos = (t) => String(t || "").replace(/\D/g, "").slice(0, 10);

  async function verificarCodigo() {
    const codigo = soloDigitos($("#recCodigo").value);
    const btn = $("#recVerificar");
    btn.disabled = true; btn.textContent = "Verificando…";
    try {
      await EcoCuentas.verificarCodigo(rec.correo, codigo);
      $("#recCodigo").classList.add("ok");
      irRec(3);
    } catch (ex) {
      marcarInvalido("#recCodigo", ex.message, ex.tipo);
    } finally {
      btn.disabled = false; btn.textContent = "Verificar código";
    }
  }

  $("#formRecCodigo").addEventListener("submit", (e) => { e.preventDefault(); verificarCodigo(); });
  $("#recCodigo").addEventListener("input", (e) => {
    const limpio = soloDigitos(e.target.value);
    if (e.target.value !== limpio) e.target.value = limpio;
    e.target.removeAttribute("aria-invalid");
  });
  // Pegar con Cmd/Ctrl+V o "Pegar" del teclado del celular: se limpian espacios y se verifica solo.
  $("#recCodigo").addEventListener("paste", (e) => {
    const t = soloDigitos(e.clipboardData?.getData("text"));
    if (t.length >= 6) { e.preventDefault(); $("#recCodigo").value = t; verificarCodigo(); }
  });
  $("#pegarCodigo").addEventListener("click", async () => {
    try {
      const t = soloDigitos(await navigator.clipboard.readText());
      if (t.length < 6) { recEstado("No encontramos un código en lo que copiaste. Copia los números del correo.", "info"); return; }
      $("#recCodigo").value = t;
      verificarCodigo();
    } catch {
      $("#recCodigo").focus();
      recEstado("Tu navegador no deja pegar con el botón. Mantén presionado el recuadro y elige «Pegar».", "info");
    }
  });

  function fuerzaClave(c) {
    let p = 0;
    if (c.length >= 6) p++;
    if (c.length >= 10) p++;
    if (/[a-z]/i.test(c) && /\d/.test(c)) p++;
    if (/[^a-z0-9]/i.test(c) || (/[a-z]/.test(c) && /[A-Z]/.test(c))) p++;
    return p;
  }
  $("#recClave").addEventListener("input", (e) => {
    const c = e.target.value, p = fuerzaClave(c);
    const niveles = [
      ["8%", "var(--danger)", "Muy corta: usa al menos 6 caracteres."],
      ["30%", "var(--danger)", "Débil: agrega números o hazla más larga."],
      ["55%", "var(--warn)", "Aceptable."],
      ["80%", "var(--ok)", "Buena."],
      ["100%", "var(--ok)", "Muy buena."]
    ];
    const [ancho, color, txt] = c ? niveles[p] : ["0", "transparent", "Usa al menos 6 caracteres. Mejor si mezclas letras y números."];
    const bar = $("#recFuerza"); bar.style.width = ancho; bar.style.background = color;
    $("#recFuerzaTxt").textContent = txt;
  });
  $("#recVerClave").addEventListener("click", () => {
    const ver = $("#recClave").type === "password";
    ["#recClave", "#recClave2"].forEach((s2) => { $(s2).type = ver ? "text" : "password"; });
    $("#recVerClave").textContent = ver ? "Ocultar" : "Mostrar";
  });

  $("#formRecClave").addEventListener("submit", async (e) => {
    e.preventDefault();
    const c1 = $("#recClave").value, c2 = $("#recClave2").value;
    if (c1.length < 6) return marcarInvalido("#recClave", "La contraseña debe tener al menos 6 caracteres.");
    if (c1 !== c2) return marcarInvalido("#recClave2", "Las dos contraseñas no coinciden.");
    const btn = $("#recGuardar");
    btn.disabled = true; btn.textContent = "Guardando…";
    try {
      const u = await EcoCuentas.nuevaClave(c1);
      rec.completado = true;
      btn.textContent = "Cargando tus menús…";
      await EcoCuentas.sincronizar();
      dlgAuth.close();
      ["#recClave", "#recClave2", "#recCodigo"].forEach((s2) => { $(s2).value = ""; });
      entrarComo(u);
      toast(`Contraseña actualizada. Hola de nuevo, ${u.nombre.split(" ")[0]}.`);
      $("#planificador").scrollIntoView({ behavior: "smooth", block: "start" });
    } catch (ex) {
      marcarInvalido(ex.campo === "clave" ? "#recClave" : null, ex.message, ex.tipo);
    } finally {
      btn.disabled = false; btn.textContent = "Guardar contraseña y entrar";
    }
  });

  // Si cierra la ventana con el código verificado pero sin guardar la contraseña, se cierra esa sesión temporal.
  dlgAuth.addEventListener("close", () => {
    clearInterval(rec.timer);
    if (rec.paso === 3 && !rec.completado && !$("#recuperar").hidden && !state.usuario) EcoCuentas.salir().catch(() => {});
  });

  // Si llega desde el enlace de un correo de recuperación (plantilla con enlace), se pide la nueva contraseña.
  EcoCuentas.onRecuperacion((u) => {
    rec.correo = u?.correo || "";
    if (!dlgAuth.open) dlgAuth.showModal();
    abrirRecuperacion(3);
  });
  $("#verClave").addEventListener("click", () => {
    const ver = $("#authClave").type === "password";
    $("#authClave").type = ver ? "text" : "password";
    $("#verClave").textContent = ver ? "Ocultar" : "Mostrar";
  });

  $("#formAuth").addEventListener("submit", async (e) => {
    e.preventDefault();
    const err = $("#authError"), btn = $("#authEnviar");
    err.hidden = true;
    $$("#formAuth [aria-invalid]").forEach((i) => i.removeAttribute("aria-invalid"));
    btn.disabled = true;
    try {
      await EcoCuentas.preparar();
      const datos = { nombre: $("#authNombre").value, correo: $("#authCorreo").value, clave: $("#authClave").value };
      const u = modoAuth === "crear" ? await EcoCuentas.crear(datos) : await EcoCuentas.entrar(datos);
      btn.textContent = "Cargando tus menús…";
      await EcoCuentas.sincronizar();
      dlgAuth.close();
      $("#authClave").value = "";
      entrarComo(u);
      toast(modoAuth === "crear" ? `Bienvenido, ${u.nombre}. Tu cuenta está lista.` : `Hola de nuevo, ${u.nombre}`);
      $("#planificador").scrollIntoView({ behavior: "smooth", block: "start" });
    } catch (ex) {
      const esInfo = ex.tipo === "info";
      if (esInfo && modoAuth === "crear") fijarModoAuth("entrar");
      err.textContent = ex.message || "No se pudo completar. Vuelve a intentarlo.";
      err.classList.toggle("info", esInfo);
      err.hidden = false;
      const campo = { nombre: "#authNombre", correo: "#authCorreo", clave: "#authClave" }[ex.campo];
      if (campo && !esInfo) { $(campo).setAttribute("aria-invalid", "true"); $(campo).focus(); }
    } finally {
      btn.disabled = false;
      btn.textContent = modoAuth === "crear" ? "Crear cuenta" : "Entrar";
    }
  });

  const inicial = (nombre) => (nombre || "?").trim().charAt(0).toUpperCase() || "?";

  /** Muestra la portada (sin sesión) o el planificador (con sesión). */
  function mostrarVista() {
    const conSesion = !!state.usuario;
    $("#inicio").hidden = conSesion;
    $("#comoFunciona").hidden = conSesion;
    $("#planificador").hidden = !conSesion;
    $("#accionesInvitado").hidden = conSesion;
    $("#accionesUsuario").hidden = !conSesion;
    if (!conSesion) $("#resultados").hidden = true;
  }

  function entrarComo(u) {
    state.usuario = u;
    state.us = EcoCuentas.almacen(u.id);
    state.plan = null; state.menuId = null;
    cargarDatosUsuario();
    const primer = u.nombre.split(" ")[0];
    $("#saludo").textContent = `Hola, ${primer}`;
    $("#avatarTop").textContent = inicial(u.nombre);
    $("#avatarMenu").textContent = inicial(u.nombre);
    $("#menuNombre").textContent = u.nombre;
    $("#menuCorreo").textContent = u.correo;
    selMoneda.value = state.datos.moneda;
    $("#notas").value = state.datos.notas || "";
    sincronizarPresupuesto(state.datos.presupuesto);
    renderSemana(); renderComidas();
    renderGrupo("gustos"); renderGrupo("alergias");
    state.maxPaso = 1; irAPaso(1, { foco: false });
    mostrarVista();
    actualizarConexion();
    const actual = state.us.get("actual");
    if (!(actual && abrirMenu(actual))) $("#resultados").hidden = true;
    renderMisMenus(); actualizarFacts();
  }

  /** Vuelve a la portada. `remoto` = la sesión se cerró en otra pestaña o expiró. */
  function salirDeLaVista(nombre, remoto = false) {
    if (dlgMenu.open) dlgMenu.close();
    state.usuario = null; state.us = null; state.plan = null; state.menuId = null;
    state.datos = datosIniciales();
    mostrarVista();
    window.scrollTo({ top: 0, behavior: "smooth" });
    toast(remoto ? "Tu sesión se cerró. Vuelve a iniciar sesión." : nombre ? `Hasta pronto, ${nombre}. Cerraste sesión.` : "Cerraste sesión.");
  }

  async function cerrarSesion() {
    const btn = $("#btnSalir");
    btn.disabled = true;
    const nombre = state.usuario?.nombre?.split(" ")[0];
    try { await EcoCuentas.salir(); } finally { btn.disabled = false; }
    salirDeLaVista(nombre);
  }
  EcoCuentas.onSalida(() => { if (state.usuario) salirDeLaVista(null, true); });

  /** Estado de la nube en el menú lateral. */
  const TEXTO_NUBE = {
    local: "Cuenta guardada en este dispositivo",
    guardando: "Guardando en la nube…",
    sincronizado: "Sincronizado en la nube",
    "sin-conexion": "Sin conexión: se guardará al volver internet"
  };
  function pintarNube(estado) {
    const el = $("#estadoNube"); if (!el) return;
    const e = EcoCuentas.modo === "supabase" ? estado || "sincronizado" : "local";
    el.textContent = TEXTO_NUBE[e];
    el.dataset.estado = e;
  }
  EcoCuentas.onEstado(pintarNube);

  $("#btnSalir").addEventListener("click", cerrarSesion);

  /* ================================================================== */
  /* Menú lateral y Mis menús                                            */
  /* ================================================================== */
  const dlgMenu = $("#menuLateral");
  $("#btnMenu").addEventListener("click", () => { renderMisMenus(); dlgMenu.showModal(); });
  $("#cerrarMenu").addEventListener("click", () => dlgMenu.close());
  dlgMenu.addEventListener("click", (e) => { if (e.target === dlgMenu) dlgMenu.close(); });
  $("#navNuevo").addEventListener("click", () => { dlgMenu.close(); nuevoMenu(); });
  $("#navActual").addEventListener("click", () => {
    dlgMenu.close();
    $("#resultados").scrollIntoView({ behavior: "smooth", block: "start" });
  });
  $("#logo").addEventListener("click", (e) => { e.preventDefault(); window.scrollTo({ top: 0, behavior: "smooth" }); });

  function actualizarFacts() {
    const el = $("#factMenus");
    if (el) el.textContent = leerMenus().length;
  }

  const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

  /** Agrupa: "Esta semana", "Semana pasada" y luego por mes. */
  function grupoFecha(ts) {
    const d = new Date(ts), hoy = new Date();
    const lunes = new Date(hoy); lunes.setHours(0, 0, 0, 0); lunes.setDate(lunes.getDate() - ((lunes.getDay() + 6) % 7));
    if (d >= lunes) return "Esta semana";
    const lunesPasado = new Date(lunes); lunesPasado.setDate(lunes.getDate() - 7);
    if (d >= lunesPasado) return "Semana pasada";
    return `${MESES[d.getMonth()].replace(/^./, (x) => x.toUpperCase())} ${d.getFullYear()}`;
  }

  let pendienteBorrar = null, borrarTimer = null;

  function renderMisMenus() {
    const cont = $("#misMenus"); if (!cont) return;
    const menus = leerMenus();
    $("#misMenusCount").textContent = menus.length;
    $("#navActual").hidden = !state.plan;
    if (!menus.length) {
      cont.innerHTML = `<p class="drawer-empty">Aún no tienes menús guardados. Cada menú que generes aparecerá aquí.</p>`;
      return;
    }
    const grupos = new Map();
    menus.forEach((m) => {
      const g = grupoFecha(m.creado || m.actualizado || Date.now());
      if (!grupos.has(g)) grupos.set(g, []);
      grupos.get(g).push(m);
    });
    cont.innerHTML = [...grupos].map(([titulo, lista]) => `
      <p class="drawer-sub">${esc(titulo)}</p>
      <ul class="menu-list">
        ${lista.map((m) => {
          const d = m.plan.datos, mon = d.moneda;
          const total = round2(m.plan.dias.reduce((s2, x) => s2 + x.costo_dia, 0));
          const dias = textoDias(d.diasSemana || m.plan.dias.map((_, i) => i));
          const comidas = listaNatural(d.comidas.map((c) => ETIQUETA[c].toLowerCase()));
          const platos = m.plan.dias.flatMap((x) => x.comidas.map((c) => c.platillo));
          const fecha = new Date(m.creado || Date.now()).toLocaleDateString("es", { day: "numeric", month: "short" });
          const activo = m.id === state.menuId;
          const confirmar = pendienteBorrar === m.id;
          return `<li class="menu-item ${activo ? "activo" : ""}">
            <button type="button" class="menu-open" data-abrir="${m.id}" ${activo ? 'aria-current="true"' : ""}>
              <span class="menu-title">${esc(dias)}</span>
              <span class="menu-meta">${esc(comidas)} · ${d.personas} pers. · ${esc(fecha)}</span>
              <span class="menu-dishes">${esc(platos.slice(0, 3).join(" · "))}${platos.length > 3 ? ` +${platos.length - 3}` : ""}</span>
              <span class="menu-money"><b>${esc(dinero(total, mon))}</b> de ${esc(dinero(d.presupuesto, mon))}</span>
            </button>
            <button type="button" class="menu-del ${confirmar ? "confirmar" : ""}" data-borrar="${m.id}" aria-label="${confirmar ? "Confirmar: eliminar" : "Eliminar"} el menú ${esc(dias)}">${confirmar ? "¿Eliminar?" : "×"}</button>
          </li>`;
        }).join("")}
      </ul>`).join("");
  }

  $("#misMenus").addEventListener("click", (e) => {
    const abrir = e.target.closest("[data-abrir]");
    if (abrir) {
      dlgMenu.close();
      abrirMenu(abrir.dataset.abrir, true);
      return;
    }
    const borrar = e.target.closest("[data-borrar]");
    if (!borrar) return;
    const id = borrar.dataset.borrar;
    clearTimeout(borrarTimer);
    if (pendienteBorrar === id) { pendienteBorrar = null; eliminarMenu(id); return; }
    pendienteBorrar = id; renderMisMenus();
    $(`[data-borrar="${id}"]`)?.focus();
    borrarTimer = setTimeout(() => { pendienteBorrar = null; renderMisMenus(); }, 3500);
  });

  /* ================================================================== */
  /* Inicio                                                              */
  /* ================================================================== */
  async function iniciar() {
    const fp = $("#factPrecios");
    if (fp) fp.textContent = Object.values(PRECIOS_REFERENCIA).reduce((s2, g) => s2 + Object.keys(g).length, 0);
    ["eco.plan", "eco.plan2", "eco.datos"].forEach((k) => store.del(k)); // formatos anteriores, sin cuentas
    await EcoCuentas.preparar();
    if (EcoCuentas.modo === "supabase") {
      $("#notaSesion").textContent = "Tu cuenta funciona en todos tus dispositivos y la sesión queda guardada en este.";
    }
    pintarNube();
    const u = await EcoCuentas.restaurar();
    if (!u) { mostrarVista(); return; }
    entrarComo(u);                         // muestra al instante lo guardado en el dispositivo
    if (EcoCuentas.modo === "supabase") {  // y luego trae lo último de la nube
      await EcoCuentas.sincronizar();
      if (state.usuario?.id !== u.id) return;
      if (!state.generando && state.paso === 1) entrarComo(u); // no interrumpe si ya empezó el asistente
      else { renderMisMenus(); actualizarFacts(); }
    }
  }
  iniciar();
})();
