/**
 * Eco Menú — Cuentas locales.
 * Las cuentas, la sesión y los menús guardados viven en el navegador de este
 * dispositivo (localStorage). No hay servidor de usuarios: una cuenta creada en
 * el celular no existe en la computadora.
 * La contraseña nunca se guarda: se guarda un hash PBKDF2-SHA256 con sal aleatoria.
 */
const EcoCuentas = (() => {
  "use strict";

  const K_USUARIOS = "eco.usuarios";
  const K_SESION = "eco.sesion";
  const ITERACIONES = 120000;

  const leer = (k, d) => { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } };
  const escribir = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch { return false; } };
  const borrar = (k) => { try { localStorage.removeItem(k); } catch { /* sin almacenamiento */ } };

  const hex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
  const aleatorio = (n) => {
    const a = new Uint8Array(n);
    (globalThis.crypto || {}).getRandomValues ? crypto.getRandomValues(a) : a.forEach((_, i) => { a[i] = Math.floor(Math.random() * 256); });
    return hex(a);
  };

  /** Hash de la contraseña. Usa Web Crypto (PBKDF2); si el navegador no lo ofrece, un hash iterado de respaldo. */
  async function hashClave(clave, sal) {
    const subtle = globalThis.crypto && globalThis.crypto.subtle;
    if (subtle) {
      const enc = new TextEncoder();
      const base = await subtle.importKey("raw", enc.encode(clave), "PBKDF2", false, ["deriveBits"]);
      const bits = await subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: enc.encode(sal), iterations: ITERACIONES }, base, 256);
      return `pbkdf2$${hex(bits)}`;
    }
    let h = 2166136261 >>> 0, s = `${sal}:${clave}`;
    for (let r = 0; r < 20000; r++) {
      for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
      s = h.toString(16) + s.slice(0, 64);
    }
    return `fnv$${h.toString(16)}`;
  }

  const normCorreo = (c) => String(c || "").trim().toLowerCase();
  const correoValido = (c) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(c);

  class ErrorCuenta extends Error {
    constructor(message, campo) { super(message); this.campo = campo; }
  }

  const usuarios = () => leer(K_USUARIOS, {});
  const publico = (u) => u && { id: u.id, nombre: u.nombre, correo: u.correo, creado: u.creado };

  async function crear({ nombre, correo, clave }) {
    nombre = String(nombre || "").replace(/\s+/g, " ").trim().slice(0, 40);
    correo = normCorreo(correo);
    if (!nombre) throw new ErrorCuenta("Escribe tu nombre.", "nombre");
    if (!correoValido(correo)) throw new ErrorCuenta("Escribe un correo válido, por ejemplo ana@correo.com.", "correo");
    if (String(clave || "").length < 6) throw new ErrorCuenta("La contraseña debe tener al menos 6 caracteres.", "clave");
    const todos = usuarios();
    if (todos[correo]) throw new ErrorCuenta("Ya existe una cuenta con ese correo en este dispositivo. Inicia sesión.", "correo");
    const sal = aleatorio(16);
    const u = { id: `u_${aleatorio(8)}`, nombre, correo, sal, hash: await hashClave(clave, sal), creado: Date.now() };
    todos[correo] = u;
    if (!escribir(K_USUARIOS, todos)) throw new ErrorCuenta("Este navegador no permite guardar datos (¿modo privado?).");
    escribir(K_SESION, { id: u.id, correo });
    return publico(u);
  }

  async function entrar({ correo, clave }) {
    correo = normCorreo(correo);
    if (!correoValido(correo)) throw new ErrorCuenta("Escribe un correo válido.", "correo");
    if (!clave) throw new ErrorCuenta("Escribe tu contraseña.", "clave");
    const u = usuarios()[correo];
    if (!u) throw new ErrorCuenta("No hay una cuenta con ese correo en este dispositivo. Crea una nueva.", "correo");
    if ((await hashClave(clave, u.sal)) !== u.hash) throw new ErrorCuenta("La contraseña no es correcta.", "clave");
    escribir(K_SESION, { id: u.id, correo });
    return publico(u);
  }

  function actual() {
    const s = leer(K_SESION, null);
    if (!s) return null;
    const u = usuarios()[s.correo];
    return u && u.id === s.id ? publico(u) : null;
  }

  function salir() { borrar(K_SESION); }

  /** Almacén con espacio propio para cada usuario. */
  function almacen(id) {
    const pre = `eco.u.${id}.`;
    return {
      get: (k, d = null) => leer(pre + k, d),
      set: (k, v) => escribir(pre + k, v),
      del: (k) => borrar(pre + k)
    };
  }

  return { crear, entrar, salir, actual, almacen, ErrorCuenta };
})();
