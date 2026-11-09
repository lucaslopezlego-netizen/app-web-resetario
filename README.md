# 🥗 EcoMenú IA

Aplicación web de **cocina inteligente por presupuesto**. Ingresas tu presupuesto, los días a planificar, tus gustos y tus alergias, y la IA de **Gemini (Google AI Studio)** genera una receta por día que se ajusta a ese presupuesto.

HTML5, CSS3 y JavaScript ES6+ puros, sin dependencias ni paso de compilación.

## 🚀 Cómo ejecutarla

1. Abre `index.html` en el navegador (doble clic), o sírvela en local:
   ```bash
   python3 -m http.server 8080
   ```
   y entra a http://localhost:8080
2. Pulsa **⚙️ API**, pega tu API Key de Gemini (gratis en https://aistudio.google.com/app/apikey) y guarda.
3. Completa el formulario y pulsa **✨ Generar Menú con IA**.

> Sin API Key, la app funciona en **modo demo** con recetas locales de ejemplo.

## ✨ Funciones

- **Formulario:** presupuesto + moneda, días (1–7), personas, comida del día, gustos y alergias como *chips* o texto libre (Enter o coma para agregar).
- **Resultados:** resumen de presupuesto usado frente al ingresado (con barra de progreso), tarjetas desplegables por día con platillo, tiempo, ingredientes con precio estimado y pasos, y una **lista de compras consolidada**.
- **Control del presupuesto:** el costo se recalcula en el cliente sumando los ingredientes (sin confiar en la suma de la IA). Si el plan se pasa del presupuesto, se le pide **automáticamente** a la IA que lo ajuste una vez.
- **Seguridad alimentaria:** reglas estrictas de alérgenos en el prompt y una revisión adicional de los nombres de los ingredientes que muestra un aviso si detecta coincidencias.
- **Salida JSON estructurada** (`responseSchema` de Gemini), así la respuesta siempre tiene el mismo formato.
- Diseño mobile-first, alto contraste, modo oscuro automático, accesible por teclado y con estilos para imprimir.

## 📁 Estructura

```
index.html        Interfaz
css/styles.css    Estilos
js/precios.js     PRECIOS_REFERENCIA (base local de precios en USD)
js/demo.js        Generador del modo demo
js/app.js         Lógica, prompt y llamada a Gemini
```

Para ajustar los precios a tu zona, edita `js/precios.js`: la IA recibe ese objeto completo en el prompt del sistema.

## ⚠️ Sobre la API Key

La llamada se hace directamente desde el navegador, con la cabecera `x-goog-api-key`. La clave solo se guarda en `localStorage` si marcas "Recordar". Esto sirve para uso personal; si publicas la app, pon un pequeño backend o proxy que guarde la clave en el servidor.
