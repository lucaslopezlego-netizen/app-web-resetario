/**
 * Eco Menú — Fotos reales de platos (Unsplash, licencia libre).
 * Más de 55 fotos en 12 tipos de plato. Cada receta recibe una foto de su tipo y, dentro de un mismo menú,
 * ninguna foto se repite: si las de ese tipo ya se usaron, se toma una de un tipo parecido o una genérica.
 */
const FOTOS = {
  huevo: [
    "1585975754487-25489eabf36a", // huevo con verduras
    "1787761460205-8ff8c81b7558", // huevos revueltos
    "1684248182367-714ccd089235", // dos huevos con tomate
    "1755364254450-00a7efd8ac45", // tostadas, huevos y verduras
    "1771285119294-96a87cd118ab"  // omelette con ensalada
  ],
  desayunoDulce: [
    "1787559793297-8494fb140c9f", // mesa de desayuno con huevos y pan
    "1786423033368-3e4406d3570b", // desayunos con fruta
    "1700223173683-abe503e2a1ad", // desayunos con fruta
    "1630661298130-cc2f63458016"  // pan integral en plato
  ],
  sopa: [
    "1658661521707-56d8955f6c19", // sopa de tomate
    "1673436977889-334fcab20436", // sopa con albóndigas y verduras
    "1537272828324-57540f47113f", // sopa con verduras
    "1648455320791-a667c8aab7e4"  // sopa con verduras
  ],
  guiso: [
    "1716089559655-ec0861f1c795", // guiso con limón
    "1714062105876-1756a22c4caf", // bol de arroz, frijoles y verduras
    "1691501946468-efcbbe037648", // bol de arroz, frijoles y verduras
    "1551889579-8acb3f14a917"     // comida casera en bol
  ],
  curry: [
    "1786114621205-f749474d9f2c"  // curry en olla de barro
  ],
  polloArroz: [
    "1708184528306-f75a0a5118ee", // pollo con arroz
    "1783196736260-dd788dff4132", // bol de arroz con pollo y verduras
    "1772693471187-6e7d364f99ee", // pollo a la plancha con arroz y verduras
    "1757715376249-b2a3e943cdf5", // pollo con arroz y ensalada
    "1579112965143-9139ed2a522a"  // arroz frito con pollo
  ],
  arrozSalteado: [
    "1772729440931-e8efd3adc748", // arroz salteado con pollo y verduras
    "1772729440867-a99e03ede945", // arroz frito con verduras
    "1605704931020-ba62cdb2ba9b", // arroz con zanahoria y verduras
    "1606250593181-5a81736038ed", // arroz con verduras
    "1705658372340-578384811f0b"  // fideos salteados con verduras
  ],
  pasta: [
    "1551892374-ecf8754cf8b0",    // pasta en bol
    "1516100882582-96c3a05fe590", // pasta con salsa de tomate
    "1713561058969-793049b01712", // espagueti con tomate y perejil
    "1598866594230-a7c12756260f", // pasta con salsa roja
    "1711539137930-3fa2ae6cec60", // espagueti en mesa de madera
    "1599345621547-37d2e2ff5aea", // espagueti
    "1674456720401-1557c76bf72c"  // espagueti con albóndigas
  ],
  tacos: [
    "1644085128237-9ba593123ac3", // dos tacos con limón
    "1464219222984-216ebffaaf85", // taco
    "1690874684451-92358e91b14c", // tres tacos con limón y cilantro
    "1731090390038-d3bd37bd1775"  // dos tacos
  ],
  verduras: [
    "1791208843014-69ab842736d0", // judías verdes en bol
    "1512621776951-a57141f2eefd", // bol de ensalada de verduras
    "1599789197514-47270cd526b4", // ensalada de verduras
    "1599789197271-8f29a4b9fa4d", // ensalada de verduras
    "1773901344720-41c3f4e3aefc"  // judías verdes
  ],
  carne: [
    "1765774011646-5169f3d39050", // carne con champiñones
    "1758157835975-1cb4947750df", // bistec con papas y ensalada
    "1783375175952-705a0600e05c", // carne con brócoli y arroz
    "1546964124-0cce460f38ef"     // carne a la parrilla
  ],
  paella: [
    "1783685739826-335e8133a197"
  ],
  casero: [
    "1563321442-a7f77abda173",    // comida cocinada
    "1660180750968-4fbc84789a96", // plato de comida
    "1780821526333-4fa6a6e9753c", // cuencos de tapas
    "1637909490319-95f2cd3ac3e3", // mesa de madera con platos
    "1718396969457-e7d95de78d16", // plato completo
    "1694813646627-9a5e39647ae6"  // comida en plato
  ]
};

/** Reglas en orden: la primera que coincide gana. */
const REGLAS_FOTO = [
  [/tortilla de papa|tortilla de patata|tortilla española|omelet|revuelto|huevo|shakshuka|frittata/, "huevo"],
  [/avena|panqueque|hotcake|tostada|pan |pan$|fruta|plátano|platano|banana|yogur|granola|arepa|desayuno/, "desayunoDulce"],
  [/taco|burrito|quesadilla|enchilada|fajita|tortilla/, "tacos"],
  [/pasta|espagueti|spaghetti|macarr|fideo|tallar|lasaña|ñoqui|penne/, "pasta"],
  [/paella/, "paella"],
  [/curry|masala/, "curry"],
  [/sopa|crema de|caldo|consomé|pozole|cazuela/, "sopa"],
  [/lenteja|garbanzo|frijol|poroto|guiso|estofado|guisado|potaje|menestra|chili/, "guiso"],
  [/arroz frito|salteado|wok|chaufa|stir/, "arrozSalteado"],
  [/pollo|arroz/, "polloArroz"],
  [/carne|res\b|bistec|filete|cerdo|albóndiga|hamburguesa/, "carne"],
  [/ensalada|verdura|vegetal|calabac|espinaca|brócoli|judía|ejote/, "verduras"]
];

/** Tipos parecidos para cuando las fotos de un tipo ya se usaron en el menú. */
const PARECIDOS = {
  huevo: ["desayunoDulce", "verduras"], desayunoDulce: ["huevo"], sopa: ["guiso", "verduras"],
  guiso: ["sopa", "curry", "polloArroz"], curry: ["guiso", "sopa"], polloArroz: ["arrozSalteado", "carne"],
  arrozSalteado: ["polloArroz", "verduras"], pasta: ["arrozSalteado"], tacos: ["carne", "polloArroz"],
  verduras: ["arrozSalteado", "sopa"], carne: ["polloArroz", "tacos"], paella: ["polloArroz", "arrozSalteado"], casero: []
};

function urlFoto(id, ancho = 900) {
  return `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=${ancho}&q=70`;
}

function tipoDeFoto(receta) {
  const nombre = `${receta.platillo || ""}`.toLowerCase();
  const ingredientes = (receta.ingredientes || []).map((i) => i.nombre).join(" ").toLowerCase();
  for (const [re, clave] of REGLAS_FOTO) if (re.test(nombre)) return clave;
  for (const [re, clave] of REGLAS_FOTO) if (re.test(ingredientes)) return clave;
  return receta.tipo === "desayuno" ? "desayunoDulce" : "casero";
}

/** Número estable a partir del nombre del plato: el mismo plato recibe siempre la misma foto. */
function semilla(texto) {
  let h = 2166136261;
  for (const c of String(texto)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619) >>> 0; }
  return h;
}

/**
 * Asigna una foto distinta a cada receta del plan.
 * @returns Map "dia.comida" → id de foto
 */
function asignarFotos(plan) {
  const usadas = new Set(), mapa = new Map();
  (plan?.dias || []).forEach((d, di) => (d.comidas || []).forEach((r, ci) => {
    const tipo = tipoDeFoto(r);
    const candidatos = [tipo, ...(PARECIDOS[tipo] || []), "casero"];
    let elegida = null;
    for (const t of candidatos) {
      const lista = FOTOS[t] || [];
      const inicio = semilla(r.platillo) % (lista.length || 1);
      for (let k = 0; k < lista.length && !elegida; k++) {
        const id = lista[(inicio + k) % lista.length];
        if (!usadas.has(id)) elegida = id;
      }
      if (elegida) break;
    }
    if (!elegida) { const lista = FOTOS[tipo]; elegida = lista[semilla(r.platillo) % lista.length]; } // menú muy largo: se permite repetir
    usadas.add(elegida);
    mapa.set(`${di}.${ci}`, elegida);
  }));
  return mapa;
}

/** Foto de una receta concreta del plan (sin repetir dentro del menú). */
function fotoDeReceta(plan, di, ci, ancho = 900) {
  const id = asignarFotos(plan).get(`${di}.${ci}`);
  return id ? urlFoto(id, ancho) : urlFoto(FOTOS.casero[0], ancho);
}

/** Compatibilidad: foto para una receta suelta, sin considerar el resto del menú. */
function fotoParaPlato(receta, indice = 0, ancho = 900) {
  const lista = FOTOS[tipoDeFoto(receta)];
  return urlFoto(lista[(semilla(receta.platillo) + indice) % lista.length], ancho);
}
