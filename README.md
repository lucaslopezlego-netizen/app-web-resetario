# Eco Menú

Planificador de comidas por presupuesto. Después de crear una cuenta, un asistente de 5 pasos pregunta cuánto quieres gastar, qué días (no tienen que ser seguidos) y para cuántas personas, qué comidas planificar (desayuno, almuerzo y/o cena), qué te gusta y qué no puedes comer. Luego **Gemini (Google AI Studio)** arma una receta por cada comida de cada día, con ingredientes, precios y pasos, sin pasarse del presupuesto.

HTML, CSS y JavaScript sin dependencias ni paso de compilación.

## Qué puedes hacer

- **Cuentas:** portada con "Cómo usarlo", crear cuenta (nombre, correo y contraseña) o iniciar sesión (correo y contraseña). La app te saluda por tu nombre.
- **Sesión en el dispositivo:** la sesión queda guardada hasta que pulses **Cerrar sesión** en el menú.
- **Menú lateral:** Nuevo menú, **Mis menús** (cada menú generado se guarda solo, agrupado por semana y mes, con sus días, platos y costo; se puede abrir o eliminar), Ajustes de la IA y Cerrar sesión.
- **Días sueltos:** elige cualquier combinación de días, por ejemplo lunes, miércoles y viernes.

- **Asistente paso a paso:** presupuesto con deslizador y montos rápidos, un indicador de cuánto toca por plato, semana interactiva, personas, elección de desayuno, almuerzo y cena (una, dos o las tres), gustos con fotos de platos reales y alérgenos.
- **Resultados:** anillo de presupuesto usado, barras de costo por día divididas por comida, una tarjeta por día y un selector Desayuno / Almuerzo / Cena con la receta completa de cada uno.
- **"Ya lo tengo en casa":** marca ingredientes y el costo se descuenta en vivo.
- **Cambiar receta:** pide a la IA otro desayuno, almuerzo o cena para ese día con el dinero que queda.
- **Modo cocina:** pasos a pantalla completa, temporizador con sonido cuando un paso indica minutos, y la pantalla no se apaga.
- **Lista de compras por pasillo:** verduras, carnes y legumbres, lácteos, granos y despensa, con cantidades sumadas (6 × 200 g de arroz = 1,2 kg). El botón **Copiar** genera un texto ordenado para WhatsApp o Notas, con totales por pasillo, lo que ya tienes en casa y el menú de cada día.
- El plan y el formulario se guardan en el navegador al recargar.

## Ejecutar en tu computadora

1. Copia `js/config.example.js` como `js/config.local.js` y pega tu clave de https://aistudio.google.com/app/apikey (este archivo está en `.gitignore` y no se sube a GitHub).
2. Sirve la carpeta:
   ```bash
   python3 -m http.server 8080
   ```
3. Abre http://localhost:8080

También puedes pegar la clave en **Ajustes** (botón arriba a la derecha) en vez de usar el archivo. Sin clave, la app muestra recetas de ejemplo.

## Publicar en Vercel (clave protegida)

1. Importa el repositorio en Vercel (no necesita build).
2. En **Settings → Environment Variables** agrega `GEMINI_API_KEY` con tu clave. Opcional: `GEMINI_MODEL` para forzar un modelo.
3. Vuelve a desplegar.

La página llama a `/api/generar` (`api/generar.js`), que usa la clave desde el servidor. Así los visitantes nunca la ven.

## Modelos

Por defecto prueba en orden `gemini-3.5-flash`, `gemini-3.1-flash-lite` y `gemini-flash-lite-latest`. Si uno está saturado o no existe, pasa al siguiente. Puedes fijar uno en Ajustes.

## Sobre las cuentas

Las cuentas, la sesión y los menús guardados viven en el navegador de cada dispositivo (localStorage). No hay servidor de usuarios: una cuenta creada en el celular no existe en la computadora, y borrar los datos del navegador borra las cuentas. La contraseña nunca se guarda: se guarda un hash PBKDF2-SHA256 con sal aleatoria. Para cuentas compartidas entre dispositivos haría falta un servicio de autenticación (por ejemplo Supabase o Firebase).

## Estructura

```
index.html              Interfaz
css/styles.css          Estilos
js/precios.js           PRECIOS_REFERENCIA (precios base en USD)
js/ecomenu-core.js      Prompts, esquema JSON y llamada a Gemini (navegador y servidor)
js/fotos.js             Fotos de Unsplash según el tipo de plato
js/compras.js           Lista de compras: pasillos, suma de cantidades y texto para copiar
js/cuentas.js           Cuentas locales, sesión y datos por usuario
js/demo.js              Recetas de ejemplo sin IA
js/app.js               Lógica de la interfaz
js/config.example.js    Plantilla de configuración local
api/generar.js          Función de Vercel que guarda la clave
```

Fotos: [Unsplash](https://unsplash.com).
