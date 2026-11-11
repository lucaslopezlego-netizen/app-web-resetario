/**
 * Eco Menú — Precios reales de supermercado por país (moneda local).
 * Fuente: Numbeo, sección "Food Prices" (promedios de precios aportados por usuarios), consultada el 11 nov 2026.
 * Unidades: leche por litro, pan por 500 g, huevos por docena, lechuga por unidad, el resto por kilo.
 * Clave: código del país. "moneda" es la moneda en que Numbeo publica los precios (Venezuela: dólares).
 * La IA usa estos precios como base principal para el país elegido; para otros ingredientes estima en proporción.
 * Para actualizarlos, vuelve a consultar la página de cada país (campo url) y reemplaza los valores.
 */
const PRECIOS_PAIS = {
  "AR": {
    "pais": "Argentina",
    "url": "https://www.numbeo.com/food-prices/country_result.jsp?country=Argentina",
    "precios": {
      "leche_litro": 2088,
      "pan_500g": 3567,
      "arroz_kg": 2635,
      "huevos_docena": 4004,
      "queso_kg": 15973,
      "pollo_filete_kg": 13075,
      "carne_res_kg": 18303,
      "manzana_kg": 3771,
      "platano_kg": 3234,
      "naranja_kg": 2098,
      "tomate_kg": 3480,
      "papa_kg": 1712,
      "cebolla_kg": 1534,
      "lechuga_unidad": 2247
    },
    "moneda": "ARS"
  },
  "BO": {
    "pais": "Bolivia",
    "url": "https://www.numbeo.com/food-prices/country_result.jsp?country=Bolivia",
    "precios": {
      "leche_litro": 8.28,
      "pan_500g": 9.92,
      "arroz_kg": 11.24,
      "huevos_docena": 13.43,
      "queso_kg": 37.41,
      "pollo_filete_kg": 30.23,
      "carne_res_kg": 53.99,
      "manzana_kg": 19.95,
      "platano_kg": 8.07,
      "naranja_kg": 8.09,
      "tomate_kg": 9.79,
      "papa_kg": 7.89,
      "cebolla_kg": 7.03,
      "lechuga_unidad": 6.54
    },
    "moneda": "BOB"
  },
  "CL": {
    "pais": "Chile",
    "url": "https://www.numbeo.com/food-prices/country_result.jsp?country=Chile",
    "precios": {
      "leche_litro": 1142,
      "pan_500g": 1543,
      "arroz_kg": 1518,
      "huevos_docena": 3426,
      "queso_kg": 10054,
      "pollo_filete_kg": 5839,
      "carne_res_kg": 10662,
      "manzana_kg": 1779,
      "platano_kg": 1618,
      "naranja_kg": 1612,
      "tomate_kg": 1590,
      "papa_kg": 1130,
      "cebolla_kg": 1345,
      "lechuga_unidad": 1178
    },
    "moneda": "CLP"
  },
  "CO": {
    "pais": "Colombia",
    "url": "https://www.numbeo.com/food-prices/country_result.jsp?country=Colombia",
    "precios": {
      "leche_litro": 4957,
      "pan_500g": 6640,
      "arroz_kg": 5611,
      "huevos_docena": 9816,
      "queso_kg": 25191,
      "pollo_filete_kg": 27572,
      "carne_res_kg": 36157,
      "manzana_kg": 11928,
      "platano_kg": 4436,
      "naranja_kg": 5364,
      "tomate_kg": 6228,
      "papa_kg": 4901,
      "cebolla_kg": 4806,
      "lechuga_unidad": 3424
    },
    "moneda": "COP"
  },
  "ES": {
    "pais": "España",
    "url": "https://www.numbeo.com/food-prices/country_result.jsp?country=Spain",
    "precios": {
      "leche_litro": 1.06,
      "pan_500g": 1.34,
      "arroz_kg": 1.48,
      "huevos_docena": 3.03,
      "queso_kg": 12.68,
      "pollo_filete_kg": 7.5,
      "carne_res_kg": 14.64,
      "manzana_kg": 2.25,
      "platano_kg": 1.81,
      "naranja_kg": 1.85,
      "tomate_kg": 2.27,
      "papa_kg": 1.63,
      "cebolla_kg": 1.76,
      "lechuga_unidad": 1.2
    },
    "moneda": "EUR"
  },
  "US": {
    "pais": "Estados Unidos",
    "url": "https://www.numbeo.com/food-prices/country_result.jsp?country=United+States",
    "precios": {
      "leche_litro": 1.06,
      "pan_500g": 3.66,
      "arroz_kg": 4.59,
      "huevos_docena": 4.28,
      "queso_kg": 12.99,
      "pollo_filete_kg": 12.41,
      "carne_res_kg": 17.35,
      "manzana_kg": 5.29,
      "platano_kg": 1.68,
      "naranja_kg": 4.43,
      "tomate_kg": 4.94,
      "papa_kg": 2.89,
      "cebolla_kg": 3.06,
      "lechuga_unidad": 2.27
    },
    "moneda": "USD"
  },
  "GT": {
    "pais": "Guatemala",
    "url": "https://www.numbeo.com/food-prices/country_result.jsp?country=Guatemala",
    "precios": {
      "leche_litro": 15.76,
      "pan_500g": 25.66,
      "arroz_kg": 15.65,
      "huevos_docena": 18.78,
      "queso_kg": 47.05,
      "pollo_filete_kg": 74.76,
      "carne_res_kg": 93.67,
      "manzana_kg": 31.0,
      "platano_kg": 15.3,
      "naranja_kg": 33.29,
      "tomate_kg": 12.92,
      "papa_kg": 14.4,
      "cebolla_kg": 16.73,
      "lechuga_unidad": 5.93
    },
    "moneda": "GTQ"
  },
  "MX": {
    "pais": "México",
    "url": "https://www.numbeo.com/food-prices/country_result.jsp?country=Mexico",
    "precios": {
      "leche_litro": 29.92,
      "pan_500g": 50.73,
      "arroz_kg": 31.9,
      "huevos_docena": 45.78,
      "queso_kg": 167,
      "pollo_filete_kg": 152,
      "carne_res_kg": 216,
      "manzana_kg": 52.87,
      "platano_kg": 29.21,
      "naranja_kg": 37.28,
      "tomate_kg": 35.91,
      "papa_kg": 37.06,
      "cebolla_kg": 36.93,
      "lechuga_unidad": 25.89
    },
    "moneda": "MXN"
  },
  "PE": {
    "pais": "Perú",
    "url": "https://www.numbeo.com/food-prices/country_result.jsp?country=Peru",
    "precios": {
      "leche_litro": 5.11,
      "pan_500g": 8.08,
      "arroz_kg": 4.65,
      "huevos_docena": 9.22,
      "queso_kg": 27.95,
      "pollo_filete_kg": 19.44,
      "carne_res_kg": 31.24,
      "manzana_kg": 6.17,
      "platano_kg": 3.66,
      "naranja_kg": 4.3,
      "tomate_kg": 4.28,
      "papa_kg": 3.13,
      "cebolla_kg": 3.04,
      "lechuga_unidad": 2.67
    },
    "moneda": "PEN"
  },
  "DO": {
    "pais": "República Dominicana",
    "url": "https://www.numbeo.com/food-prices/country_result.jsp?country=Dominican+Republic",
    "precios": {
      "leche_litro": 79.34,
      "pan_500g": 109,
      "arroz_kg": 90.41,
      "huevos_docena": 107,
      "queso_kg": 457,
      "pollo_filete_kg": 354,
      "carne_res_kg": 412,
      "manzana_kg": 191,
      "platano_kg": 54.61,
      "naranja_kg": 165,
      "tomate_kg": 103,
      "papa_kg": 128,
      "cebolla_kg": 130,
      "lechuga_unidad": 57.87
    },
    "moneda": "DOP"
  },
  "UY": {
    "pais": "Uruguay",
    "url": "https://www.numbeo.com/food-prices/country_result.jsp?country=Uruguay",
    "precios": {
      "leche_litro": 48.74,
      "pan_500g": 107,
      "arroz_kg": 66.54,
      "huevos_docena": 170,
      "queso_kg": 534,
      "pollo_filete_kg": 424,
      "carne_res_kg": 456,
      "manzana_kg": 108,
      "platano_kg": 101,
      "naranja_kg": 61.33,
      "tomate_kg": 125,
      "papa_kg": 74.82,
      "cebolla_kg": 84.06,
      "lechuga_unidad": 52.77
    },
    "moneda": "UYU"
  },
  "VE": {
    "pais": "Venezuela",
    "url": "https://www.numbeo.com/food-prices/country_result.jsp?country=Venezuela",
    "precios": {
      "leche_litro": 2.33,
      "pan_500g": 1.94,
      "arroz_kg": 1.54,
      "huevos_docena": 3.11,
      "queso_kg": 6.99,
      "pollo_filete_kg": 7.67,
      "carne_res_kg": 8.93,
      "manzana_kg": 5.69,
      "platano_kg": 1.65,
      "naranja_kg": 1.87,
      "tomate_kg": 2.07,
      "papa_kg": 1.87,
      "cebolla_kg": 1.9,
      "lechuga_unidad": 1.4
    },
    "moneda": "USD"
  }
};
const PRECIOS_PAIS_FECHA = "noviembre de 2026";

if (typeof module !== "undefined" && module.exports) module.exports = { PRECIOS_PAIS, PRECIOS_PAIS_FECHA };
