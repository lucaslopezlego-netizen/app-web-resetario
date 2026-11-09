/**
 * Eco Menú — Modo demo.
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

/** Recetas de desayuno para el modo de ejemplo (mismo formato que RECETAS_DEMO). */
const RECETAS_DESAYUNO = [
  {
    platillo: "Avena cocida con plátano y canela",
    descripcion: "Desayuno tibio, barato y que llena.",
    tiempo: 10, alergenos: ["lactosa"], tags: ["casera", "saludable", "rápida", "vegetariana"],
    ingredientes: [
      ["120 g de avena", ["carbohidratos", "avena_kg"], 0.12],
      ["400 ml de leche", ["lacteos_otros", "leche_litro"], 0.4],
      ["2 plátanos", ["vegetales_frutas", "platanos_kg"], 0.35],
      ["Canela", ["lacteos_otros", "especias_sobre"], 0.3]
    ],
    pasos: ["Calienta la leche con la avena a fuego medio.", "Cocina 5 minutos removiendo hasta que espese.", "Sirve con el plátano en rodajas y canela por encima."]
  },
  {
    platillo: "Huevos revueltos con tomate y pan",
    descripcion: "Clásico rápido con proteína para empezar el día.",
    tiempo: 12, alergenos: ["huevo", "gluten"], tags: ["casera", "rápida", "proteica", "vegetariana"],
    ingredientes: [
      ["4 huevos", ["proteinas", "huevos_docena"], 0.33],
      ["1 tomate", ["vegetales_frutas", "tomate_kg"], 0.15],
      ["2 panes", ["carbohidratos", "pan_unidad"], 2],
      ["1 cda de aceite", ["lacteos_otros", "aceite_litro"], 0.015]
    ],
    pasos: ["Pica el tomate y sofríelo 2 minutos en el aceite.", "Agrega los huevos batidos con sal y remueve 3 minutos.", "Sirve con el pan tostado."]
  },
  {
    platillo: "Tostadas con tomate y aceite",
    descripcion: "Pan crujiente con tomate rallado, al estilo mediterráneo.",
    tiempo: 8, alergenos: ["gluten"], tags: ["rápida", "vegetariana", "saludable"],
    ingredientes: [
      ["4 panes", ["carbohidratos", "pan_unidad"], 4],
      ["2 tomates", ["vegetales_frutas", "tomate_kg"], 0.3],
      ["1 diente de ajo", ["vegetales_frutas", "ajo_cabeza"], 0.1],
      ["2 cdas de aceite", ["lacteos_otros", "aceite_litro"], 0.03]
    ],
    pasos: ["Tuesta el pan.", "Frota el ajo sobre el pan y ralla el tomate encima.", "Termina con un chorrito de aceite y sal."]
  },
  {
    platillo: "Arroz con huevo y plátano",
    descripcion: "Desayuno contundente sin gluten ni lácteos.",
    tiempo: 15, alergenos: ["huevo"], tags: ["casera", "proteica"],
    ingredientes: [
      ["150 g de arroz", ["carbohidratos", "arroz_kg"], 0.15],
      ["2 huevos", ["proteinas", "huevos_docena"], 0.17],
      ["1 plátano", ["vegetales_frutas", "platanos_kg"], 0.2],
      ["1 cda de aceite", ["lacteos_otros", "aceite_litro"], 0.015]
    ],
    pasos: ["Cocina el arroz (o usa arroz del día anterior).", "Fríe los huevos y el plátano en rodajas 4 minutos.", "Sirve todo junto."]
  },
  {
    platillo: "Papas salteadas con espinaca",
    descripcion: "Desayuno salado sin gluten, lácteos ni huevo.",
    tiempo: 20, alergenos: [], tags: ["casera", "vegetariana", "saludable"],
    ingredientes: [
      ["400 g de papas", ["carbohidratos", "papas_kg"], 0.4],
      ["1 manojo de espinaca", ["vegetales_frutas", "espinaca_manojo"], 0.5],
      ["1/2 cebolla", ["vegetales_frutas", "cebolla_kg"], 0.08],
      ["2 cdas de aceite", ["lacteos_otros", "aceite_litro"], 0.03]
    ],
    pasos: ["Corta las papas en cubos pequeños y saltéalas 12 minutos.", "Añade la cebolla y la espinaca y cocina 3 minutos.", "Sazona con sal y pimienta."]
  }
];

/** Multiplica la cantidad inicial del texto ("400 g de pollo", "1/2 cebolla") por la escala. */
function escalarCantidad(texto, escala) {
  if (escala === 1) return texto;
  const m = texto.match(/^(\d+)(?:\/(\d+))?(?:[.,](\d+))?\s*/);
  if (!m) return texto;
  const base = m[2] ? Number(m[1]) / Number(m[2]) : Number(`${m[1]}.${m[3] || 0}`);
  const v = base * escala;
  const bonito = v >= 10 ? String(Math.round(v)) : String(Math.round(v * 10) / 10).replace(".", ",");
  return `${bonito} ${texto.slice(m[0].length)}`;
}

/** Nombre del ingrediente sin la cantidad: "400 g de pollo" → "Pollo". */
function nombreIngrediente(texto) {
  const n = texto.replace(/^[\d/.,\s]+(g|kg|ml|cdas?|latas?|paquetes?|dientes?|manojos?)?\s*(de\s+)?/i, "").trim() || texto;
  return n.charAt(0).toUpperCase() + n.slice(1);
}

function generarPlanDemo(datos, extra = {}) {
  const { presupuesto, personas, gustos = [], alergias = [], moneda } = datos;
  const comidas = extra.comidaTipo ? [extra.comidaTipo]
    : (Array.isArray(datos.comidas) && datos.comidas.length ? datos.comidas : [datos.comida || "almuerzo"]);
  const diaNumero = extra.diaNumero || 0;
  const dias = diaNumero ? 1 : datos.dias;
  const evitar = new Set((extra.evitar || []).map((x) => x.toLowerCase()));

  const restricciones = alergias.map((a) => a.toLowerCase());
  const esVeg = restricciones.some((r) => r.includes("vegetarian") || r.includes("vegan")) ||
    gustos.some((g) => g.toLowerCase().includes("vegetarian"));
  const proh = new Set();
  for (const [alergeno, claves] of Object.entries(MAPA_ALERGENOS)) {
    if (restricciones.some((r) => claves.some((c) => r.includes(c)))) proh.add(alergeno);
  }
  const gustosLc = gustos.map((g) => g.toLowerCase());
  const puntuar = (r) => r.tags.filter((t) => gustosLc.some((g) => g.includes(t))).length;

  function pool(lista) {
    let c = lista.filter((r) => !r.alergenos.some((a) => proh.has(a)));
    if (esVeg) c = c.filter((r) => !r.ingredientes.some(([, [, k]]) => /pollo|carne|atun/.test(k)));
    if (!c.length) c = lista.filter((r) => r.alergenos.length === 0);
    if (!c.length) c = lista;
    return [...c].sort((a, b) => puntuar(b) - puntuar(a));
  }
  const pools = { desayuno: pool(RECETAS_DESAYUNO), almuerzo: pool(RECETAS_DEMO), cena: pool([...RECETAS_DEMO].reverse()) };

  const usados = new Set(evitar);
  function elegir(tipo, i) {
    const lista = pools[tipo];
    const libres = lista.filter((r) => !usados.has(r.platillo.toLowerCase()));
    const fuente = libres.length ? libres : lista;
    const r = diaNumero ? fuente[Math.floor(Math.random() * fuente.length)] : fuente[0] || lista[i % lista.length];
    usados.add(r.platillo.toLowerCase());
    return r;
  }

  const escala = personas / 2;
  const plan = [];
  for (let i = 0; i < dias; i++) {
    const recetas = comidas.map((tipo) => {
      const r = elegir(tipo, i);
      const ingredientes = r.ingredientes.map(([cantidad, [cat, clave], factor]) => ({
        nombre: nombreIngrediente(cantidad),
        cantidad: escalarCantidad(cantidad, escala),
        precio_estimado: +(PRECIOS_REFERENCIA[cat][clave] * factor * escala).toFixed(2)
      }));
      return {
        tipo,
        platillo: r.platillo,
        descripcion: r.descripcion,
        tiempo_preparacion_min: r.tiempo,
        porciones: personas,
        costo: +ingredientes.reduce((s, x) => s + x.precio_estimado, 0).toFixed(2),
        ingredientes,
        pasos: r.pasos,
        consejo_ahorro: "Compra a granel los básicos (arroz, legumbres, aceite) para bajar el costo por porción."
      };
    });
    plan.push({ dia: diaNumero || i + 1, costo_dia: +recetas.reduce((s, r) => s + r.costo, 0).toFixed(2), comidas: recetas });
  }

  return {
    resumen: {
      presupuesto_total: presupuesto,
      costo_total: +plan.reduce((s, d) => s + d.costo_dia, 0).toFixed(2),
      moneda,
      comentario: `Plan de ejemplo generado sin IA con precios de referencia en USD${moneda !== "USD" ? " (sin convertir a tu moneda)" : ""}.`
    },
    dias: plan
  };
}
