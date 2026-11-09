/**
 * Eco Menú — Lista de compras.
 * Agrupa los ingredientes de todo el plan por pasillo del mercado,
 * suma las cantidades cuando la unidad coincide y arma el texto para copiar.
 */
const EcoCompras = (() => {
  "use strict";

  /** Pasillos en el orden en que suelen recorrerse. El primero que coincide gana. */
  const PASILLOS = [
    { id: "despensa", nombre: "Despensa y condimentos", re: /aceite|salsa|caldo|consom|especia|\bsal\b|pimienta|comino|or[eé]gano|az[uú]car|vinagre|canela|piment[oó]n|mayonesa|mostaza|laurel|curry|c[uú]rcuma|ketchup|miel|levadura|polvo de hornear|cacao|caf[eé]|\bt[eé]\b/ },
    { id: "lacteos", nombre: "Lácteos", re: /leche|queso|yogur|mantequilla|crema|nata|reques[oó]n/ },
    { id: "proteinas", nombre: "Carnes, huevos y legumbres", re: /pollo|carne|\bres\b|cerdo|pavo|pescado|at[uú]n|sardina|huevo|lenteja|frijol|poroto|garbanzo|tofu|soja|soya|jam[oó]n|chorizo|salchicha|camar[oó]n|alb[oó]ndiga|habas?\b|arvejas? secas/ },
    { id: "verduras", nombre: "Verduras y frutas", re: /tomate|cebolla|zanahoria|\bajos?\b|pimiento|chile|aj[ií]\b|calabac|zapallo|espinaca|lechuga|lim[oó]n|lima\b|pl[aá]tano|banana|manzana|naranja|br[oó]coli|repollo|\bcol\b|pepino|apio|cilantro|perejil|aguacate|palta|champi|hongo|seta|berenjena|fruta|verdura|choclo|elote|ejote|jud[ií]a|camote|batata|yuca|mango|fresa|pera|uva|arveja|guisante|r[aá]bano|remolacha|betabel|albahaca|hierbabuena|jengibre/ },
    { id: "granos", nombre: "Granos, pan y harinas", re: /arroz|pasta|fideo|espagueti|spaghetti|macarr|tallar|\bpan(es)?\b|tortilla|avena|harina|papa|patata|ma[ií]z|quinoa|quinua|arepa|galleta|cereal|tostada|polenta|s[eé]mola|cusc[uú]s/ },
    { id: "otros", nombre: "Otros", re: /.*/ }
  ];

  /** Orden de recorrido en el mercado (distinto del orden de detección). */
  const ORDEN_MERCADO = ["verduras", "proteinas", "lacteos", "granos", "despensa", "otros"];

  const pasilloDe = (nombre) => {
    const n = nombre.toLowerCase();
    return PASILLOS.find((p) => p.re.test(n)) || PASILLOS[PASILLOS.length - 1];
  };

  /* ---------------- Cantidades ---------------- */
  const UNIDADES = [
    [/^(kg|kilos?|kilogramos?)$/, "g", 1000],
    [/^(g|gr|grs|gramos?)$/, "g", 1],
    [/^(l|lt|lts|litros?)$/, "ml", 1000],
    [/^(ml|mililitros?)$/, "ml", 1],
    [/^(cdas?|cucharadas?)$/, "cda", 1],
    [/^(cdtas?|cditas?|cucharaditas?)$/, "cdta", 1],
    [/^(tazas?)$/, "taza", 1],
    [/^(latas?)$/, "lata", 1],
    [/^(paquetes?|bolsas?)$/, "paquete", 1],
    [/^(dientes?)$/, "diente", 1],
    [/^(manojos?|atados?)$/, "manojo", 1],
    [/^(unidad(es)?|u|uds?\.?|piezas?)$/, "u", 1]
  ];

  /** "250 g de arroz" → { valor: 250, unidad: "g" }. "2 tomates" → { valor: 2, unidad: "u" }. */
  function parsearCantidad(texto) {
    const t = String(texto || "").trim().toLowerCase();
    const m = t.match(/^(\d+\s+\d+\/\d+|\d+\/\d+|\d+(?:[.,]\d+)?)\s*([a-záéíóúñ.]+)?/);
    if (!m) return null;
    let valor;
    if (m[1].includes("/")) {
      const partes = m[1].split(/\s+/);
      valor = partes.reduce((s, p) => { const [a, b] = p.split("/"); return s + (b ? Number(a) / Number(b) : Number(a)); }, 0);
    } else valor = Number(m[1].replace(",", "."));
    if (!Number.isFinite(valor) || valor <= 0) return null;
    const palabra = m[2] || "";
    for (const [re, unidad, factor] of UNIDADES) if (re.test(palabra)) return { valor: valor * factor, unidad };
    if (/^(pizcas?|al gusto|chorrito)/.test(palabra)) return null;
    return { valor, unidad: "u" }; // "2 tomates", "1 cebolla mediana"
  }

  const fmtNum = (n) => {
    const r = n >= 10 ? Math.round(n) : Math.round(n * 10) / 10;
    return String(r).replace(".", ",");
  };

  function formatearUnidad(valor, unidad) {
    if (unidad === "g") return valor >= 1000 ? `${fmtNum(valor / 1000)} kg` : `${fmtNum(valor)} g`;
    if (unidad === "ml") return valor >= 1000 ? `${fmtNum(valor / 1000)} l` : `${fmtNum(valor)} ml`;
    const plural = valor > 1;
    const nombres = { u: plural ? "unidades" : "unidad", cda: plural ? "cdas" : "cda", cdta: plural ? "cdtas" : "cdta", taza: plural ? "tazas" : "taza", lata: plural ? "latas" : "lata", paquete: plural ? "paquetes" : "paquete", diente: plural ? "dientes" : "diente", manojo: plural ? "manojos" : "manojo" };
    return `${fmtNum(valor)} ${nombres[unidad] || unidad}`;
  }

  /** Suma una lista de cantidades en texto. Las que no se pueden leer se dejan tal cual. */
  function sumarCantidades(textos) {
    const porUnidad = new Map(), sueltas = [];
    textos.forEach((t) => {
      const q = parsearCantidad(t);
      if (q) porUnidad.set(q.unidad, (porUnidad.get(q.unidad) || 0) + q.valor);
      else if (t && !sueltas.includes(t)) sueltas.push(t);
    });
    return [...[...porUnidad].map(([u, v]) => formatearUnidad(v, u)), ...sueltas].join(" + ");
  }

  /* ---------------- Lista ---------------- */
  const clave = (nombre) => nombre.toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/\(.*?\)/g, "").replace(/\s+/g, " ").trim()
    .replace(/([lnrd])es$/, "$1").replace(/s$/, "");

  /**
   * @param plan  { dias: [{ comidas: [{ ingredientes: [...] }] }] }
   * @param tengo Set con claves "d.c.i" de ingredientes que ya están en casa
   * @returns [{ id, nombre, items: [{ nombre, cantidad, total, enCasa, usos }] , total }]
   */
  function construir(plan, tengo = new Set()) {
    const mapa = new Map();
    plan.dias.forEach((d, di) => d.comidas.forEach((c, ci) => c.ingredientes.forEach((ing, ii) => {
      const k = clave(ing.nombre);
      const it = mapa.get(k) || { nombre: ing.nombre, cantidades: [], total: 0, totalEnCasa: 0, usos: 0, partesEnCasa: 0 };
      it.cantidades.push(ing.cantidad);
      it.total += ing.precio_estimado;
      it.usos += 1;
      if (tengo.has(`${di}.${ci}.${ii}`)) { it.partesEnCasa += 1; it.totalEnCasa += ing.precio_estimado; }
      mapa.set(k, it);
    })));

    const grupos = new Map(ORDEN_MERCADO.map((id) => {
      const p = PASILLOS.find((x) => x.id === id);
      return [id, { id, nombre: p.nombre, items: [], total: 0 }];
    }));
    mapa.forEach((it) => {
      const g = grupos.get(pasilloDe(it.nombre).id);
      const item = {
        nombre: it.nombre,
        cantidad: sumarCantidades(it.cantidades),
        total: Math.round(it.total * 100) / 100,
        aComprar: Math.round((it.total - it.totalEnCasa) * 100) / 100,
        enCasa: it.partesEnCasa === it.usos,
        usos: it.usos
      };
      g.items.push(item);
      g.total += item.aComprar;
    });
    return [...grupos.values()]
      .filter((g) => g.items.length)
      .map((g) => ({ ...g, total: Math.round(g.total * 100) / 100, items: g.items.sort((a, b) => a.enCasa - b.enCasa || b.total - a.total) }));
  }

  /**
   * Texto ordenado para pegar en WhatsApp, Notas o un correo.
   * @param ctx { plan, grupos, dinero(v), diasSemana[] (nombre de cada día del plan), rango (texto de los días),
   *              etiquetasComida{}, totalComprar }
   */
  function aTexto({ plan, grupos, dinero, diasSemana, rango, etiquetasComida, totalComprar }) {
    const d = plan.datos;
    const linea = "──────────────────────";
    const n = plan.dias.length;
    rango = rango || (n === 1 ? diasSemana[0] : `${diasSemana[0]} a ${diasSemana[n - 1]}`);
    const comidas = d.comidas.map((c) => etiquetasComida[c].toLowerCase());
    const comidasTxt = comidas.length > 1 ? `${comidas.slice(0, -1).join(", ")} y ${comidas[comidas.length - 1]}` : comidas[0];
    const resto = d.presupuesto - totalComprar;
    const out = [
      "🛒 LISTA DE COMPRAS · Eco Menú",
      `${rango} · ${d.personas} ${d.personas === 1 ? "persona" : "personas"} · ${comidasTxt}`,
      linea
    ];

    const enCasa = [];
    grupos.forEach((g) => {
      const pendientes = g.items.filter((it) => !it.enCasa);
      g.items.filter((it) => it.enCasa).forEach((it) => enCasa.push(it.nombre));
      if (!pendientes.length) return;
      out.push("", `${g.nombre.toUpperCase()} (${dinero(g.total)})`);
      pendientes.forEach((it) => out.push(`☐ ${it.nombre} — ${it.cantidad || "al gusto"} · ${dinero(it.aComprar)}`));
    });

    out.push("", linea,
      `TOTAL A COMPRAR: ${dinero(totalComprar)}`,
      `Presupuesto: ${dinero(d.presupuesto)} · ${resto >= 0 ? "Te sobran" : "Te faltan"} ${dinero(Math.abs(resto))}`);

    if (enCasa.length) out.push("", "YA TIENES EN CASA", `✓ ${enCasa.join(", ")}`);

    out.push("", linea, "📅 MENÚ");
    plan.dias.forEach((dia, i) => {
      out.push("", `${diasSemana[i].toUpperCase()} (${dinero(dia.costo_dia)})`);
      dia.comidas.forEach((c) => out.push(`• ${etiquetasComida[c.tipo]}: ${c.platillo} (${c.tiempo_preparacion_min} min)`));
    });
    return out.join("\n");
  }

  return { PASILLOS, pasilloDe, parsearCantidad, sumarCantidades, construir, aTexto };
})();

if (typeof module !== "undefined" && module.exports) module.exports = EcoCompras;
