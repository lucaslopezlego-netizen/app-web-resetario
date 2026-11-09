/**
 * Eco Menú — Cuentas.
 *
 * Dos modos, elegidos automáticamente:
 *  - "supabase": si js/supabase-config.js tiene url y anonKey. Las cuentas funcionan en
 *    todos los dispositivos; la sesión la guarda Supabase en este navegador; preferencias
 *    y "Mis menús" se sincronizan con las tablas de supabase/schema.sql.
 *  - "local": sin configuración. Cuentas, sesión y menús viven solo en este navegador.
 *    La contraseña se guarda como hash PBKDF2-SHA256 con sal, nunca en claro.
 *
 * En ambos modos la app lee y escribe en una copia local (almacen), así responde al
 * instante y funciona sin conexión; en modo supabase esa copia se sube en segundo plano.
 */
const EcoCuentas = (() => {
  "use strict";

  /* ---------------- Utilidades ---------------- */
  const leer = (k, d) => { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } };
  const escribir = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch { return false; } };
  const borrar = (k) => { try { localStorage.removeItem(k); } catch { /* sin almacenamiento */ } };
  const hex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
  const aleatorio = (n) => {
    const a = new Uint8Array(n);
    if (globalThis.crypto?.getRandomValues) crypto.getRandomValues(a); else a.forEach((_, i) => { a[i] = Math.floor(Math.random() * 256); });
    return hex(a);
  };
  const normCorreo = (c) => String(c || "").trim().toLowerCase();
  const correoValido = (c) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(c);
  const limpiarNombre = (n) => String(n || "").replace(/\s+/g, " ").trim().slice(0, 40);

  class ErrorCuenta extends Error {
    /** tipo "info" se muestra como aviso, no como error (p. ej. "revisa tu correo"). */
    constructor(message, campo, tipo = "error") { super(message); this.campo = campo; this.tipo = tipo; }
  }

  function validar({ nombre, correo, clave }, crear) {
    if (crear && !limpiarNombre(nombre)) throw new ErrorCuenta("Escribe tu nombre.", "nombre");
    if (!correoValido(normCorreo(correo))) throw new ErrorCuenta("Escribe un correo válido, por ejemplo ana@correo.com.", "correo");
    if (crear && String(clave || "").length < 6) throw new ErrorCuenta("La contraseña debe tener al menos 6 caracteres.", "clave");
    if (!crear && !clave) throw new ErrorCuenta("Escribe tu contraseña.", "clave");
  }

  /* ---------------- Copia local por usuario ---------------- */
  const listeners = { estado: [], salida: [] };
  const emitir = (tipo, v) => listeners[tipo].forEach((f) => { try { f(v); } catch (e) { console.error(e); } });

  function almacenLocal(id, alCambiar) {
    const pre = `eco.u.${id}.`;
    return {
      get: (k, d = null) => leer(pre + k, d),
      set: (k, v) => { escribir(pre + k, v); if (alCambiar) alCambiar(k); },
      del: (k) => { borrar(pre + k); if (alCambiar) alCambiar(k); }
    };
  }

  /* ================================================================== */
  /* Modo local                                                          */
  /* ================================================================== */
  const K_USUARIOS = "eco.usuarios", K_SESION = "eco.sesion";

  async function hashClave(clave, sal) {
    const subtle = globalThis.crypto && globalThis.crypto.subtle;
    if (subtle) {
      const enc = new TextEncoder();
      const base = await subtle.importKey("raw", enc.encode(clave), "PBKDF2", false, ["deriveBits"]);
      const bits = await subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: enc.encode(sal), iterations: 120000 }, base, 256);
      return `pbkdf2$${hex(bits)}`;
    }
    let h = 2166136261 >>> 0, s = `${sal}:${clave}`;
    for (let r = 0; r < 20000; r++) {
      for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
      s = h.toString(16) + s.slice(0, 64);
    }
    return `fnv$${h.toString(16)}`;
  }

  const local = {
    usuarios: () => leer(K_USUARIOS, {}),
    publico: (u) => u && { id: u.id, nombre: u.nombre, correo: u.correo },

    async crear(d) {
      validar(d, true);
      const correo = normCorreo(d.correo), todos = local.usuarios();
      if (todos[correo]) throw new ErrorCuenta("Ya existe una cuenta con ese correo en este dispositivo. Inicia sesión.", "correo");
      const sal = aleatorio(16);
      const u = { id: `u_${aleatorio(8)}`, nombre: limpiarNombre(d.nombre), correo, sal, hash: await hashClave(d.clave, sal), creado: Date.now() };
      todos[correo] = u;
      if (!escribir(K_USUARIOS, todos)) throw new ErrorCuenta("Este navegador no permite guardar datos (¿modo privado?).");
      escribir(K_SESION, { id: u.id, correo });
      return local.publico(u);
    },

    async entrar(d) {
      validar(d, false);
      const correo = normCorreo(d.correo), u = local.usuarios()[correo];
      if (!u) throw new ErrorCuenta("No hay una cuenta con ese correo en este dispositivo. Crea una nueva.", "correo");
      if ((await hashClave(d.clave, u.sal)) !== u.hash) throw new ErrorCuenta("La contraseña no es correcta.", "clave");
      escribir(K_SESION, { id: u.id, correo });
      return local.publico(u);
    },

    async restaurar() {
      const s = leer(K_SESION, null); if (!s) return null;
      const u = local.usuarios()[s.correo];
      return u && u.id === s.id ? local.publico(u) : null;
    },

    async salir() { borrar(K_SESION); },
    async sincronizar() { /* nada que sincronizar */ },
    almacen: (id) => almacenLocal(id)
  };

  /* ================================================================== */
  /* Modo Supabase                                                       */
  /* ================================================================== */
  const cfg = { ...((typeof window !== "undefined" && window.ECOMENU_SUPABASE) || {}) };
  let sb = null, usuarioSb = null;

  /** Traduce los errores de Supabase Auth a mensajes claros. */
  function traducir(err) {
    const m = String(err?.message || err || "").toLowerCase();
    if (m.includes("invalid login credentials")) return new ErrorCuenta("Correo o contraseña incorrectos.", "clave");
    if (m.includes("already registered") || m.includes("already been registered") || m.includes("user_already_exists"))
      return new ErrorCuenta("Ya existe una cuenta con ese correo. Inicia sesión.", "correo");
    if (m.includes("email not confirmed")) return new ErrorCuenta("Todavía no confirmaste tu correo. Abre el enlace que te enviamos y vuelve a intentarlo.", "correo", "info");
    if (m.includes("password should be") || m.includes("weak password")) return new ErrorCuenta("La contraseña es muy débil. Usa al menos 6 caracteres, mezclando letras y números.", "clave");
    if (m.includes("invalid email") || m.includes("unable to validate email")) return new ErrorCuenta("Ese correo no es válido.", "correo");
    if (m.includes("rate limit") || m.includes("too many")) return new ErrorCuenta("Demasiados intentos. Espera un minuto y vuelve a intentarlo.");
    if (m.includes("failed to fetch") || m.includes("network")) return new ErrorCuenta("No hay conexión con el servidor de cuentas. Revisa tu internet.");
    return new ErrorCuenta(err?.message || "No se pudo completar. Vuelve a intentarlo.");
  }

  const desdeSb = (u) => u && {
    id: u.id,
    nombre: limpiarNombre(u.user_metadata?.nombre) || (u.email || "").split("@")[0],
    correo: u.email || ""
  };

  /* ---- Sincronización: la copia local se sube con un pequeño retraso ---- */
  const sync = { pendientes: new Set(), timer: null, subidos: new Map(), ocupado: false };
  /** Menús que ya llegaron a la nube (id → actualizado). Se guarda para distinguir "creado sin conexión" de "borrado en otro dispositivo". */
  const guardarSubidos = () => { if (usuarioSb) escribir(`eco.u.${usuarioSb.id}.subidos`, [...sync.subidos]); };

  function programarSubida(clave) {
    if (!usuarioSb || !["datos", "actual", "menus"].includes(clave)) return;
    sync.pendientes.add(clave === "menus" ? "menus" : "preferencias");
    emitir("estado", "guardando");
    clearTimeout(sync.timer);
    sync.timer = setTimeout(subir, 700);
  }

  async function subir() {
    sync.timer = null;
    if (!usuarioSb || sync.ocupado) return;
    sync.ocupado = true;
    const que = new Set(sync.pendientes); sync.pendientes.clear();
    const cache = almacenLocal(usuarioSb.id);
    try {
      if (que.has("preferencias")) {
        const { error } = await sb.from("preferencias").upsert({
          user_id: usuarioSb.id, datos: cache.get("datos", {}) || {}, menu_actual: cache.get("actual", null), actualizado: new Date().toISOString()
        });
        if (error) throw error;
      }
      if (que.has("menus")) {
        const menus = cache.get("menus", []) || [];
        const cambiados = menus.filter((m) => sync.subidos.get(m.id) !== m.actualizado);
        if (cambiados.length) {
          const { error } = await sb.from("menus").upsert(cambiados.map((m) => ({
            user_id: usuarioSb.id, id: m.id, datos: m,
            creado: new Date(m.creado || Date.now()).toISOString(),
            actualizado: new Date(m.actualizado || Date.now()).toISOString()
          })));
          if (error) throw error;
          cambiados.forEach((m) => sync.subidos.set(m.id, m.actualizado));
          guardarSubidos();
        }
        const vigentes = new Set(menus.map((m) => m.id));
        const borrados = [...sync.subidos.keys()].filter((id) => !vigentes.has(id));
        if (borrados.length) {
          const { error } = await sb.from("menus").delete().eq("user_id", usuarioSb.id).in("id", borrados);
          if (error) throw error;
          borrados.forEach((id) => sync.subidos.delete(id));
          guardarSubidos();
        }
      }
      emitir("estado", sync.pendientes.size ? "guardando" : "sincronizado");
    } catch (err) {
      console.warn("Eco Menú: no se pudo sincronizar", err);
      que.forEach((q) => sync.pendientes.add(q));
      emitir("estado", "sin-conexion");
      clearTimeout(sync.timer);
      sync.timer = setTimeout(subir, 15000);
    } finally {
      sync.ocupado = false;
      if (sync.pendientes.size && !sync.timer) sync.timer = setTimeout(subir, 700);
    }
  }

  /** Baja preferencias y menús de la nube a la copia local. Los menús creados sin conexión se conservan y se suben. */
  async function bajar() {
    if (!usuarioSb) return;
    const cache = almacenLocal(usuarioSb.id);
    emitir("estado", "guardando");
    try {
      const [pref, menus] = await Promise.all([
        sb.from("preferencias").select("datos, menu_actual").eq("user_id", usuarioSb.id).maybeSingle(),
        sb.from("menus").select("id, datos").eq("user_id", usuarioSb.id).order("creado", { ascending: false }).limit(30)
      ]);
      if (pref.error) throw pref.error;
      if (menus.error) throw menus.error;

      if (pref.data) {
        if (pref.data.datos && Object.keys(pref.data.datos).length) escribir(`eco.u.${usuarioSb.id}.datos`, pref.data.datos);
        if (pref.data.menu_actual) escribir(`eco.u.${usuarioSb.id}.actual`, pref.data.menu_actual);
      }
      const remotos = (menus.data || []).map((r) => ({ ...r.datos, id: r.id }));
      const yaSubidos = new Map(cache.get("subidos", []) || []);
      const idsRemotos = new Set(remotos.map((m) => m.id));
      // Locales que nunca llegaron a la nube: se conservan y se suben. Si ya se habían subido y no están, se borraron en otro dispositivo.
      const soloLocales = (cache.get("menus", []) || []).filter((m) => !idsRemotos.has(m.id) && !yaSubidos.has(m.id));
      sync.subidos = new Map(remotos.map((m) => [m.id, m.actualizado]));
      guardarSubidos();
      const todos = [...soloLocales, ...remotos].sort((a, b) => (b.creado || 0) - (a.creado || 0)).slice(0, 30);
      escribir(`eco.u.${usuarioSb.id}.menus`, todos);
      if (soloLocales.length) programarSubida("menus");
      if (!pref.data) programarSubida("datos");
      emitir("estado", soloLocales.length || !pref.data ? "guardando" : "sincronizado");
    } catch (err) {
      console.warn("Eco Menú: no se pudieron bajar los datos", err);
      emitir("estado", "sin-conexion");
    }
  }

  const nube = {
    cliente() {
      if (!sb) {
        sb = window.supabase.createClient(cfg.url, cfg.anonKey, {
          auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, storageKey: "eco.supabase.auth" }
        });
        sb.auth.onAuthStateChange((evento, sesion) => {
          if (evento === "SIGNED_OUT" && usuarioSb) { usuarioSb = null; emitir("salida"); }
          if (sesion?.user && usuarioSb && sesion.user.id === usuarioSb.id) usuarioSb = sesion.user;
        });
      }
      return sb;
    },

    async crear(d) {
      validar(d, true);
      const { data, error } = await nube.cliente().auth.signUp({
        email: normCorreo(d.correo), password: d.clave,
        options: { data: { nombre: limpiarNombre(d.nombre) }, emailRedirectTo: location.origin + location.pathname }
      });
      if (error) throw traducir(error);
      // Supabase no avisa si el correo ya existía cuando la confirmación está activa: devuelve un usuario sin identidades.
      if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0)
        throw new ErrorCuenta("Ya existe una cuenta con ese correo. Inicia sesión.", "correo");
      if (!data.session)
        throw new ErrorCuenta(`Te enviamos un correo a ${normCorreo(d.correo)}. Abre el enlace para confirmar tu cuenta y luego inicia sesión.`, null, "info");
      usuarioSb = data.user;
      return desdeSb(data.user);
    },

    async entrar(d) {
      validar(d, false);
      const { data, error } = await nube.cliente().auth.signInWithPassword({ email: normCorreo(d.correo), password: d.clave });
      if (error) throw traducir(error);
      usuarioSb = data.user;
      return desdeSb(data.user);
    },

    async restaurar() {
      try {
        const { data } = await nube.cliente().auth.getSession();
        usuarioSb = data?.session?.user || null;
        return desdeSb(usuarioSb);
      } catch { return null; }
    },

    async salir() {
      const id = usuarioSb?.id;
      clearTimeout(sync.timer);
      if (sync.pendientes.size) { try { await subir(); } catch { /* se intenta y se sigue */ } }
      usuarioSb = null; sync.subidos = new Map(); sync.pendientes.clear();
      try { await nube.cliente().auth.signOut(); } catch { /* sin conexión: la sesión local se borra igual */ }
      if (id) ["datos", "actual", "menus", "subidos"].forEach((k) => borrar(`eco.u.${id}.${k}`));
    },

    sincronizar: bajar,
    almacen: (id) => almacenLocal(id, programarSubida)
  };

  let motor = local, modo = "local", preparado = null;

  /**
   * Decide el modo antes de usar las cuentas. Usa js/supabase-config.js; si falta la URL o la clave
   * y la app está publicada, las pide a /api/config (variables que la integración Supabase ↔ Vercel crea).
   */
  function preparar() {
    if (preparado) return preparado;
    preparado = (async () => {
      const web = typeof location !== "undefined" && /^https?:$/.test(location.protocol);
      if ((!cfg.url || !cfg.anonKey) && web) {
        try {
          const ctrl = new AbortController();
          const t = setTimeout(() => ctrl.abort(), 4000);
          const res = await fetch("api/config", { signal: ctrl.signal, headers: { Accept: "application/json" } });
          clearTimeout(t);
          if (res.ok && (res.headers.get("content-type") || "").includes("json")) {
            const data = await res.json();
            if (data.supabase?.url && (!cfg.url || cfg.url === data.supabase.url)) {
              cfg.url = data.supabase.url;
              cfg.anonKey = cfg.anonKey || data.supabase.anonKey;
            }
            servidor.gemini = !!data.gemini;
          }
        } catch { /* sin /api/config: se sigue con lo que haya */ }
      }
      if (cfg.url && cfg.anonKey && typeof window !== "undefined" && window.supabase?.createClient) {
        motor = nube; modo = "supabase";
      }
      return modo;
    })();
    return preparado;
  }
  const servidor = { gemini: null };

  return {
    preparar,
    get modo() { return modo; },
    /** true/false si /api/config dijo si hay clave de Gemini en el servidor; null si no se sabe. */
    get geminiEnServidor() { return servidor.gemini; },
    crear: (d) => motor.crear(d),
    entrar: (d) => motor.entrar(d),
    restaurar: () => motor.restaurar(),
    salir: () => motor.salir(),
    /** Baja los datos de la nube (en modo local no hace nada). */
    sincronizar: () => motor.sincronizar(),
    almacen: (id) => motor.almacen(id),
    /** estado: "guardando" | "sincronizado" | "sin-conexion" */
    onEstado: (f) => listeners.estado.push(f),
    /** Se llama si la sesión se cierra desde otra pestaña o expira. */
    onSalida: (f) => listeners.salida.push(f),
    ErrorCuenta
  };
})();
