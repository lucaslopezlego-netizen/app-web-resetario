/**
 * EcoMenú IA — Fotos reales de platos (Unsplash, licencia libre).
 * Se elige una foto según palabras clave del nombre del platillo y sus ingredientes.
 */
const FOTOS_ID = {
  mesa: "1637909490319-95f2cd3ac3e3",       // mesa de madera con platos
  tapas: "1780821526333-4fa6a6e9753c",      // cuencos de tapas sobre madera
  polloArroz: "1708184528306-f75a0a5118ee", // plato de pollo con arroz
  arrozSalteado: "1772729440931-e8efd3adc748",
  pasta: "1551892374-ecf8754cf8b0",
  tacos: "1644085128237-9ba593123ac3",
  guiso: "1716089559655-ec0861f1c795",      // guiso con limón
  curry: "1786114621205-f749474d9f2c",      // curry en olla de barro
  sopa: "1658661521707-56d8955f6c19",       // sopa de tomate y albahaca
  huevo: "1585975754487-25489eabf36a",      // huevo con verduras
  desayuno: "1787559793297-8494fb140c9f",   // desayuno con huevos y pan
  verduras: "1791208843014-69ab842736d0",   // judías verdes en bol
  carne: "1765774011646-5169f3d39050",      // carne con champiñones
  paella: "1783685739826-335e8133a197",
  casero: "1563321442-a7f77abda173",        // comida cocinada
  plato: "1660180750968-4fbc84789a96"
};

/** Reglas en orden: la primera que coincide gana. */
const REGLAS_FOTO = [
  [/tortilla de papa|tortilla española|omelet|revuelto|huevo|shakshuka|frittata/, "huevo"],
  [/avena|panqueque|tostada|desayuno|arepa/, "desayuno"],
  [/taco|burrito|quesadilla|enchilada|fajita|tortilla/, "tacos"],
  [/pasta|espagueti|spaghetti|macarr|fideo|tallar|lasaña|ñoqui|penne/, "pasta"],
  [/paella/, "paella"],
  [/curry|masala/, "curry"],
  [/sopa|crema de|caldo|consomé|pozole/, "sopa"],
  [/lenteja|garbanzo|frijol|poroto|guiso|estofado|guisado|potaje|menestra|chili/, "guiso"],
  [/arroz frito|salteado|wok|chaufa|stir/, "arrozSalteado"],
  [/pollo|arroz/, "polloArroz"],
  [/carne|res|bistec|filete|cerdo|albóndiga|hamburguesa/, "carne"],
  [/ensalada|verdura|vegetal|calabac|espinaca|brócoli|judía|ejote/, "verduras"]
];

const ROTACION = ["casero", "plato", "tapas", "mesa"];

function urlFoto(clave, ancho = 900) {
  const id = FOTOS_ID[clave] || FOTOS_ID.casero;
  return `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=${ancho}&q=70`;
}

function fotoParaPlato(dia, indice = 0, ancho = 900) {
  const texto = `${dia.platillo || ""}`.toLowerCase();
  const ingredientes = (dia.ingredientes || []).map((i) => i.nombre).join(" ").toLowerCase();
  for (const [re, clave] of REGLAS_FOTO) if (re.test(texto)) return urlFoto(clave, ancho);
  for (const [re, clave] of REGLAS_FOTO) if (re.test(ingredientes)) return urlFoto(clave, ancho);
  return urlFoto(ROTACION[indice % ROTACION.length], ancho);
}
