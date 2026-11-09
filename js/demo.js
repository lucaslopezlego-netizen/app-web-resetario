/**
 * EcoMenú IA — Modo demo.
 * Genera un plan sin llamar a la IA, usando recetas de ejemplo y
 * PRECIOS_REFERENCIA. Útil para probar la interfaz sin API Key.
 * Devuelve exactamente el mismo formato que se pide a Gemini.
 */
const RECETAS_DEMO = [
  {
    platillo: "Arroz con pollo casero",
    descripcion: "Clásico casero, rendidor y económico.",
    tiempo: 45,
    alergenos: [],
    tags: ["casera", "proteica"],
    // cantidad: texto para 2 personas | ref: [categoria, clave] | factor: fracción de la unidad de precio para 2 personas
    ingredientes: [
      ["400 g de pollo", ["proteinas", "pollo_kg"], 0.4],
      ["250 g de arroz", ["carbohidratos", "arroz_kg"], 0.25],
      ["1 cebolla mediana", ["vegetales_frutas", "cebolla_kg"], 0.15],
      ["1 zanahoria", ["vegetales_frutas", "zanahoria_kg"], 0.12],
      ["2 dientes de ajo", ["vegetales_frutas", "ajo_cabeza"], 0.2],
      ["2 cdas de aceite", ["lacteos_otros", "aceite_litro"], 0.03]
    ],
    pasos: [
      "Corta el pollo en trozos y salpimienta.",
      "Dora el pollo en una olla con el aceite y reserva.",
      "Sofríe cebolla, ajo y zanahoria picados durante 5 minutos.",
      "Agrega el arroz, mezcla 1 minuto y añade el doble de agua caliente.",
      "Incorpora el pollo, tapa y cocina a fuego bajo 18–20 minutos."
    ]
  },
  {
    platillo: "Pasta al pomodoro",
    descripcion: "Pasta italiana sencilla con salsa de tomate fresca.",
    tiempo: 25,
    alergenos: ["gluten"],
    tags: ["italiana", "vegetariana", "rápida"],
    ingredientes: [
      ["250 g de pasta", ["carbohidratos", "pasta_kg"], 0.25],
      ["500 g de tomate", ["vegetales_frutas", "tomate_kg"], 0.5],
      ["1/2 cebolla", ["vegetales_frutas", "cebolla_kg"], 0.08],
      ["2 dientes de ajo", ["vegetales_frutas", "ajo_cabeza"], 0.2],
      ["2 cdas de aceite", ["lacteos_otros", "aceite_litro"], 0.03],
      ["Orégano y sal", ["lacteos_otros", "especias_sobre"], 0.5]
    ],
    pasos: [
      "Hierve agua con sal y cocina la pasta según el paquete.",
      "Pica tomate, cebolla y ajo.",
      "Sofríe cebolla y ajo en aceite, añade el tomate y cocina 10 minutos.",
      "Sazona con orégano y sal; mezcla con la pasta escurrida."
    ]
  },
  {
    platillo: "Tortilla de papas",
    descripcion: "Tortilla jugosa de papa y cebolla.",
    tiempo: 35,
    alergenos: ["huevo"],
    tags: ["casera", "vegetariana"],
    ingredientes: [
      ["4 huevos", ["proteinas", "huevos_docena"], 0.33],
      ["500 g de papas", ["carbohidratos", "papas_kg"], 0.5],
      ["1 cebolla", ["vegetales_frutas", "cebolla_kg"], 0.15],
      ["Ensalada de lechuga", ["vegetales_frutas", "lechuga_unidad"], 0.5],
      ["4 cdas de aceite", ["lacteos_otros", "aceite_litro"], 0.06]
    ],
    pasos: [
      "Pela y corta las papas en láminas finas; pica la cebolla.",
      "Fríe papa y cebolla a fuego medio hasta que estén tiernas.",
      "Bate los huevos con sal y mezcla con las papas escurridas.",
      "Cuaja en sartén 4 minutos por lado. Sirve con la ensalada."
    ]
  },
  {
    platillo: "Lentejas guisadas con verduras",
    descripcion: "Guiso nutritivo, alto en fibra y proteína vegetal.",
    tiempo: 40,
    alergenos: [],
    tags: ["casera", "vegetariana", "saludable", "proteica"],
    ingredientes: [
      ["250 g de lentejas", ["proteinas", "lentejas_kg"], 0.25],
      ["1 zanahoria", ["vegetales_frutas", "zanahoria_kg"], 0.12],
      ["1 tomate", ["vegetales_frutas", "tomate_kg"], 0.15],
      ["1/2 pimiento", ["vegetales_frutas", "pimiento_kg"], 0.1],
      ["1 papa", ["carbohidratos", "papas_kg"], 0.2],
      ["Comino, pimentón y sal", ["lacteos_otros", "especias_sobre"], 0.5]
    ],
    pasos: [
      "Lava las lentejas (remójalas 1 h si no son de cocción rápida).",
      "Sofríe pimiento, tomate y zanahoria picados.",
      "Añade lentejas, papa en cubos, especias y agua hasta cubrir.",
      "Cocina tapado 25–30 minutos hasta que estén tiernas."
    ]
  },
  {
    platillo: "Tacos de carne molida",
    descripcion: "Tacos mexicanos rápidos con pico de gallo.",
    tiempo: 25,
    alergenos: [],
    tags: ["mexicana", "rápida", "picante"],
    ingredientes: [
      ["300 g de carne molida", ["proteinas", "carne_molida_kg"], 0.3],
      ["1 paquete de tortillas de maíz", ["carbohidratos", "tortillas_paquete"], 0.6],
      ["2 tomates", ["vegetales_frutas", "tomate_kg"], 0.3],
      ["1/2 cebolla", ["vegetales_frutas", "cebolla_kg"], 0.08],
      ["1 limón", ["vegetales_frutas", "limon_kg"], 0.1],
      ["Comino, chile y sal", ["lacteos_otros", "especias_sobre"], 0.5]
    ],
    pasos: [
      "Cocina la carne con la mitad de la cebolla y las especias.",
      "Prepara pico de gallo con tomate, cebolla y limón.",
      "Calienta las tortillas en sartén.",
      "Arma los tacos con carne y pico de gallo."
    ]
  },
  {
    platillo: "Ensalada tibia de atún y papa",
    descripcion: "Fresca, rápida y sin cocción complicada.",
    tiempo: 20,
    alergenos: ["mariscos", "pescado"],
    tags: ["rápida", "saludable", "proteica"],
    ingredientes: [
      ["2 latas de atún", ["proteinas", "atun_lata"], 2],
      ["400 g de papas", ["carbohidratos", "papas_kg"], 0.4],
      ["1 lechuga", ["vegetales_frutas", "lechuga_unidad"], 1],
      ["1 tomate", ["vegetales_frutas", "tomate_kg"], 0.15],
      ["1 limón", ["vegetales_frutas", "limon_kg"], 0.1],
      ["2 cdas de aceite", ["lacteos_otros", "aceite_litro"], 0.03]
    ],
    pasos: [
      "Hierve las papas en cubos 12 minutos y escúrrelas.",
      "Lava y corta lechuga y tomate.",
      "Mezcla todo con el atún escurrido.",
      "Aliña con limón, aceite y sal."
    ]
  },
  {
    platillo: "Garbanzos salteados con espinaca",
    descripcion: "Plato vegetal rápido y lleno de sabor.",
    tiempo: 20,
    alergenos: [],
    tags: ["vegetariana", "rápida", "saludable"],
    ingredientes: [
      ["300 g de garbanzos cocidos", ["proteinas", "garbanzos_kg"], 0.3],
      ["1 manojo de espinaca", ["vegetales_frutas", "espinaca_manojo"], 1],
      ["150 g de arroz", ["carbohidratos", "arroz_kg"], 0.15],
      ["2 dientes de ajo", ["vegetales_frutas", "ajo_cabeza"], 0.2],
      ["Pimentón y sal", ["lacteos_otros", "especias_sobre"], 0.5],
      ["2 cdas de aceite", ["lacteos_otros", "aceite_litro"], 0.03]
    ],
    pasos: [
      "Cocina el arroz blanco.",
      "Dora el ajo en aceite y agrega los garbanzos con pimentón.",
      "Añade la espinaca y saltea 2–3 minutos.",
      "Sirve sobre el arroz."
    ]
  },
  {
    platillo: "Calabacines gratinados con queso",
    descripcion: "Horneado sencillo con queso fundido.",
    tiempo: 30,
    alergenos: ["lactosa"],
    tags: ["vegetariana", "italiana", "casera"],
    ingredientes: [
      ["2 calabacines", ["vegetales_frutas", "calabacin_kg"], 0.5],
      ["150 g de queso", ["lacteos_otros", "queso_kg"], 0.15],
      ["1 tomate", ["vegetales_frutas", "tomate_kg"], 0.15],
      ["2 panes", ["carbohidratos", "pan_unidad"], 2],
      ["Orégano y sal", ["lacteos_otros", "especias_sobre"], 0.5]
    ],
    pasos: [
      "Corta los calabacines en rodajas y colócalos en una fuente.",
      "Cubre con tomate en rodajas, orégano y sal.",
      "Añade el queso por encima.",
      "Hornea a 200 °C 15–20 minutos. Acompaña con pan."
    ]
  }
];

/** Mapeo flexible de restricciones escritas por el usuario a alérgenos. */
const MAPA_ALERGENOS = {
  gluten: ["gluten", "trigo", "celiac", "celíac"],
  lactosa: ["lact", "leche", "queso", "lácteo", "lacteo"],
  huevo: ["huevo"],
  mariscos: ["marisco", "pescado", "atún", "atun"],
  pescado: ["pescado", "atún", "atun"],
  carne: ["vegetarian", "vegan"]
};

function generarPlanDemo({ presupuesto, dias, personas, gustos, alergias, moneda }, extra = {}) {
  const evitar = (extra.evitar || []).map((x) => x.toLowerCase());
  const diaNumero = extra.diaNumero || 0;
  if (diaNumero) dias = 1;
  const restricciones = alergias.map((a) => a.toLowerCase());
  const esVeg = restricciones.some((r) => r.includes("vegetarian") || r.includes("vegan")) ||
    gustos.some((g) => g.toLowerCase().includes("vegetarian"));

  const proh = new Set();
  for (const [alergeno, claves] of Object.entries(MAPA_ALERGENOS)) {
    if (restricciones.some((r) => claves.some((c) => r.includes(c)))) proh.add(alergeno);
  }

  let candidatas = RECETAS_DEMO.filter((r) => !r.alergenos.some((a) => proh.has(a)));
  if (esVeg) {
    candidatas = candidatas.filter((r) =>
      !r.ingredientes.some(([, [, k]]) => /pollo|carne|atun/.test(k)));
  }
  if (!candidatas.length) candidatas = RECETAS_DEMO.filter((r) => r.alergenos.length === 0);

  // Prioriza las que coinciden con los gustos.
  const gustosLc = gustos.map((g) => g.toLowerCase());
  const puntuar = (r) => r.tags.filter((t) => gustosLc.some((g) => g.includes(t))).length;
  candidatas = [...candidatas].sort((a, b) => puntuar(b) - puntuar(a));
  if (diaNumero) {
    const libres = candidatas.filter((r) => !evitar.includes(r.platillo.toLowerCase()));
    if (libres.length) candidatas = libres;
    const k = Math.floor(Math.random() * candidatas.length);
    candidatas = [candidatas[k]];
  }

  const escala = personas / 2;
  const plan = [];
  for (let i = 0; i < dias; i++) {
    const r = candidatas[i % candidatas.length];
    const ingredientes = r.ingredientes.map(([cantidad, [cat, clave], factor]) => ({
      nombre: cantidad.replace(/^[\d/.,\s]+(g|kg|cdas?|latas?|paquetes?)?\s*(de\s+)?/i, "").trim() || cantidad,
      cantidad: escala === 1 ? cantidad : `${cantidad} ×${escala.toFixed(1).replace(".0", "")}`,
      precio_estimado: +(PRECIOS_REFERENCIA[cat][clave] * factor * escala).toFixed(2)
    }));
    const costo = +ingredientes.reduce((s, x) => s + x.precio_estimado, 0).toFixed(2);
    plan.push({
      dia: diaNumero || i + 1,
      platillo: r.platillo,
      descripcion: r.descripcion,
      tiempo_preparacion_min: r.tiempo,
      porciones: personas,
      costo_dia: costo,
      ingredientes,
      pasos: r.pasos,
      consejo_ahorro: "Compra a granel los básicos (arroz, legumbres, aceite) para reducir el costo por porción."
    });
  }

  const total = +plan.reduce((s, d) => s + d.costo_dia, 0).toFixed(2);
  return {
    resumen: {
      presupuesto_total: presupuesto,
      costo_total: total,
      moneda,
      comentario: `Plan de demostración generado localmente (precios de referencia en USD${moneda !== "USD" ? ", sin conversión" : ""}). Activa la IA para un menú personalizado.`
    },
    dias: plan
  };
}
