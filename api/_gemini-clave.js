/**
 * Clave de Gemini (Google AI Studio) guardada en el código por decisión del dueño del proyecto.
 * Archivo solo del servidor: Vercel no lo publica como ruta (empieza con "_") y no se envía al navegador.
 * Atención: el repositorio es público, así que la clave es visible en GitHub; si Google la desactiva,
 * crea una nueva en https://aistudio.google.com/app/apikey y reemplázala aquí.
 * Si existe la variable de entorno GEMINI_API_KEY en Vercel, tiene prioridad sobre esta.
 */
const CLAVE_GEMINI = ""; // pendiente: GitHub bloquea publicar la clave en un repositorio público

module.exports = () => process.env.GEMINI_API_KEY || CLAVE_GEMINI;
