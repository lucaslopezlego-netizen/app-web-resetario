/**
 * EcoMenú IA — Base de datos local de precios de referencia (USD).
 * La IA recibe este objeto dentro del prompt del sistema para calcular costos.
 * Puedes ampliarlo o ajustarlo a los precios de tu zona.
 */
const PRECIOS_REFERENCIA = {
  proteinas: {
    pollo_kg: 4.0,
    carne_molida_kg: 5.5,
    huevos_docena: 2.5,
    atun_lata: 1.2,
    lentejas_kg: 2.0,
    frijoles_kg: 1.8,
    garbanzos_kg: 2.2,
    tofu_kg: 4.5
  },
  carbohidratos: {
    arroz_kg: 1.5,
    pasta_kg: 1.3,
    papas_kg: 1.2,
    pan_unidad: 0.5,
    tortillas_paquete: 1.5,
    avena_kg: 2.0,
    harina_kg: 1.1
  },
  vegetales_frutas: {
    tomate_kg: 1.5,
    cebolla_kg: 1.2,
    zanahoria_kg: 1.0,
    platanos_kg: 1.0,
    ajo_cabeza: 0.4,
    pimiento_kg: 2.5,
    calabacin_kg: 1.8,
    espinaca_manojo: 1.2,
    limon_kg: 1.5,
    lechuga_unidad: 1.0
  },
  lacteos_otros: {
    leche_litro: 1.8,
    queso_kg: 6.0,
    aceite_litro: 3.0,
    mantequilla_250g: 2.2,
    yogur_litro: 2.5,
    salsa_tomate_lata: 1.0,
    especias_sobre: 0.5,
    sal_kg: 0.6
  }
};
