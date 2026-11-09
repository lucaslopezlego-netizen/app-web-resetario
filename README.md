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

## Cuentas en todos tus dispositivos (Supabase)

Sin configurar nada, las cuentas se guardan solo en el navegador de cada dispositivo. Para que funcionen en el celular y en la computadora a la vez, conecta un proyecto gratuito de Supabase:

1. Crea un proyecto en https://supabase.com (plan gratuito).
2. En **SQL Editor → New query**, pega el contenido de `supabase/schema.sql` y pulsa **Run**. Crea las tablas `preferencias` y `menus` con seguridad por filas (cada persona solo ve lo suyo).
3. Dale a la app la URL y la clave pública (anon / publishable) de una de estas dos formas:
   - **Con Vercel (recomendado):** conecta Supabase a tu proyecto de Vercel con la integración oficial. Crea solas las variables `SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY`, y la app las lee desde `/api/config` (`api/config.js`), que nunca entrega la clave `service_role`. Después de conectar, vuelve a desplegar.
   - **Sin Vercel:** pega **Project URL** y la clave **anon public** en `js/supabase-config.js`. Son valores públicos por diseño; nunca uses la clave `service_role`.
4. En **Authentication → URL Configuration**, pon en **Site URL** la dirección donde publiques la app (por ejemplo la de Vercel), para que funcione el enlace del correo de confirmación.
5. Para entrar sin verificar el correo al registrarse, desactiva **Authentication → Providers → Email → Confirm email**.
6. **Recuperar contraseña con código:** en **Authentication → Emails → Templates → Reset Password**, pon como asunto *Tu código para restablecer la contraseña de Eco Menú* y pega el contenido de `supabase/email-recuperar-contrasena.html`. El correo muestra el código (`{{ .Token }}`). En la app: **Iniciar sesión → ¿Olvidaste tu contraseña?** → correo → pegar el código → nueva contraseña.

Con Supabase activo:
- La sesión la guarda Supabase en el navegador y se renueva sola; queda abierta hasta pulsar **Cerrar sesión**.
- Preferencias del asistente y **Mis menús** se guardan primero en el dispositivo (la app responde al instante) y se suben a la nube en segundo plano. El menú lateral muestra si está sincronizado, guardando o sin conexión; lo creado sin internet se sube al volver.
- La librería de Supabase va incluida en `js/vendor/` (licencia MIT), sin depender de un CDN.

Sin Supabase, la contraseña nunca se guarda: se guarda un hash PBKDF2-SHA256 con sal aleatoria.

## Estructura

```
index.html              Interfaz
css/styles.css          Estilos
js/precios.js           PRECIOS_REFERENCIA (precios base en USD)
js/ecomenu-core.js      Prompts, esquema JSON y llamada a Gemini (navegador y servidor)
js/fotos.js             Fotos de Unsplash según el tipo de plato
js/compras.js           Lista de compras: pasillos, suma de cantidades y texto para copiar
js/cuentas.js           Cuentas (Supabase o locales), sesión y sincronización de datos
js/supabase-config.js   URL y clave pública de tu proyecto de Supabase
js/vendor/              Librería oficial supabase-js 2.45.4 (MIT)
supabase/schema.sql     Tablas y reglas de seguridad para Supabase
supabase/email-recuperar-contrasena.html  Plantilla del correo con el código de recuperación
js/demo.js              Recetas de ejemplo sin IA
js/app.js               Lógica de la interfaz
js/config.example.js    Plantilla de configuración local
api/generar.js          Función de Vercel que guarda la clave de Gemini
api/config.js           Función de Vercel que entrega la URL y la clave pública de Supabase
```

Fotos: [Unsplash](https://unsplash.com).
