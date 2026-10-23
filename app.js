/* Easy Car — lógica de la página
 * Datos en Supabase: tabla "autos", tabla "config" (fila id=1) y bucket de fotos.
 * Ver supabase/schema.sql y README.md.
 */
(() => {
"use strict";

const CFG = window.CATALOGO_CONFIG || {};
const BUCKET = CFG.BUCKET_FOTOS || "fotos";
const MAX_FOTOS = 12;
const DIAS_VENDIDO_VISIBLE = 14; // los vendidos se muestran al público estos días
const USD_A_PYG = 7300;          // solo para ordenar por precio cuando hay monedas mezcladas
const EUR_A_USD = 1.08;          // solo para ordenar por precio cuando hay monedas mezcladas
  
const $ = s => document.querySelector(s);
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

const state = {
  cars: [], config: {}, isAdmin: false, adminView: true,
  filters: { combustible: "", transmision: "" }, marca: "", q: "", sort: "new"
};

/* ---------- Conexión ---------- */
const configured = CFG.SUPABASE_URL && !CFG.SUPABASE_URL.includes("TU-PROYECTO") && CFG.SUPABASE_ANON_KEY && !CFG.SUPABASE_ANON_KEY.includes("PEGÁ");
const sb = window.EC?.sb || (configured && window.supabase ? window.supabase.createClient(CFG.SUPABASE_URL, CFG.SUPABASE_ANON_KEY) : null);
const fotoUrl = path => /^https?:|^data:|^blob:/.test(path) ? path : sb.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;

/* ---------- Formatos ---------- */
const fmtNum = n => Number(n).toLocaleString("es-ES", { useGrouping: "always" });
const fmtPrice = c => {
  const n = fmtNum(Number(c.precio) || 0);
  if (c.moneda === "EUR") return n + " €";
  return (c.moneda === "PYG" ? "Gs. " : "US$ ") + n;
};
const fmtKm = k => (k === "" || k == null) ? "" : fmtNum(k) + " km";
const ESTADOS = { disponible: "Disponible", reservado: "Reservado", vendido: "Vendido" };

function toast(t) {
  const el = document.createElement("div");
  el.className = "toast"; el.textContent = t; el.setAttribute("role", "status");
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 2800);
}

/* ---------- Datos ---------- */
async function loadCars() {
  const { data, error } = await sb.from("autos").select("*").order("creado", { ascending: false });
  if (error) throw error;
  // Los vehículos cargados antes con "Nafta" se muestran como "Gasolina"
  state.cars = (data || []).map(c => c.combustible === "Nafta" ? { ...c, combustible: "Gasolina" } : c);
}
async function loadConfig() {
  const { data } = await sb.from("config").select("*").eq("id", 1).maybeSingle();
  state.config = data || {};
  renderConfig();
}
async function refresh() {
  try { await loadCars(); render(); }
  catch (e) { console.error(e); showGridMessage("No se pudo cargar el catálogo", "Revisa tu conexión y recarga la página."); }
}

/* ---------- Filtros y orden ---------- */
const rank = c => c.estado === "vendido" ? 2 : c.estado === "reservado" ? 1 : 0;
const usd = c => {
  const p = Number(c.precio) || 0;
  if (c.moneda === "PYG") return p / USD_A_PYG;
  if (c.moneda === "EUR") return p * EUR_A_USD;
  return p;
};
const soldOld = c => c.vendido_en && (Date.now() - new Date(c.vendido_en).getTime()) > DIAS_VENDIDO_VISIBLE * 864e5;
const adminMode = () => state.isAdmin && state.adminView;

function visible() {
  const q = state.q.trim().toLowerCase();
  const list = state.cars.filter(c => {
    if (!adminMode() && c.estado === "vendido" && soldOld(c)) return false;
    if (state.marca && c.marca !== state.marca) return false;
    for (const k of ["combustible", "transmision"]) if (state.filters[k] && c[k] !== state.filters[k]) return false;
    if (q && !`${c.marca} ${c.modelo} ${c.anio} ${c.color || ""}`.toLowerCase().includes(q)) return false;
    return true;
  });
  const by = {
    new: (a, b) => new Date(b.creado) - new Date(a.creado),
    pa: (a, b) => usd(a) - usd(b),
    pd: (a, b) => usd(b) - usd(a),
    ya: (a, b) => (b.anio || 0) - (a.anio || 0),
    km: (a, b) => (a.km ?? 1e12) - (b.km ?? 1e12)
  }[state.sort];
  return list.sort((a, b) => rank(a) - rank(b) || by(a, b));
}

/* ---------- Render ---------- */
function showGridMessage(title, text, extra = "") {
  $("#grid").innerHTML = `<div class="empty"><h2>${esc(title)}</h2><p>${esc(text)}</p>${extra}</div>`;
}

function render() {
  const admin = adminMode();
  $("#adminBar").hidden = !admin;
  const disp = state.cars.filter(c => c.estado !== "vendido").length;
  $("#count").textContent = `${disp} disponible${disp === 1 ? "" : "s"}`;

  const marcas = [...new Set(state.cars.map(c => c.marca).filter(Boolean))].sort((a, b) => a.localeCompare(b, "es"));
  const sel = $("#fMarca");
  sel.innerHTML = '<option value="">Todas las marcas</option>' + marcas.map(m => `<option${m === state.marca ? " selected" : ""}>${esc(m)}</option>`).join("");
  $("#marcasList").innerHTML = marcas.map(m => `<option value="${esc(m)}">`).join("");

  if (!state.cars.length) {
    return admin
      ? showGridMessage("Todavía no hay vehículos cargados", "Añade el primero con sus fotos, precio y especificaciones. Antes, configura el número de WhatsApp en “Datos del negocio”.", `<button class="btn primary" data-act="new">+ Cargar primer vehículo</button>`)
      : showGridMessage("Muy pronto verás aquí los vehículos", "Estamos actualizando el stock. Vuelve dentro de un rato.");
  }
  const list = visible();
  if (!list.length) return showGridMessage("Ningún vehículo coincide", "Prueba con otra marca o quita algún filtro.");

  $("#grid").innerHTML = list.map(c => {
    const tag = c.estado === "vendido" ? `<span class="tag vendido">Vendido</span>`
      : c.estado === "reservado" ? `<span class="tag reservado">Reservado</span>`
      : c.cero ? `<span class="tag nuevo">0 km</span>` : "";
    const portada = c.fotos?.[0];
    const specs = [c.anio, c.cero ? "0 km" : fmtKm(c.km), c.transmision, c.combustible].filter(Boolean).map(s => `<span>${esc(s)}</span>`).join("");
    return `<article class="card${c.estado === "vendido" ? " sold" : ""}" data-id="${esc(c.id)}" tabindex="0" role="button" aria-label="${esc(`${c.marca} ${c.modelo} ${c.anio}`)}">
      <div class="ph">${portada ? `<img class="bg" src="${esc(fotoUrl(portada))}" alt="" aria-hidden="true" loading="lazy" decoding="async"><img class="fg" src="${esc(fotoUrl(portada))}" alt="" loading="lazy" decoding="async">` : `<div class="noimg">SIN FOTO</div>`}${tag}<span class="price">${esc(fmtPrice(c))}</span></div>
      <div class="cbody"><h3>${esc(c.marca)} ${esc(c.modelo)}<small>${esc([c.carroceria, c.motor, c.color].filter(Boolean).join(" · "))}</small></h3><div class="specs">${specs}</div></div>
      ${admin ? `<div class="adminrow">
        <button class="btn" data-act="edit">Editar</button>
        <select class="btn" data-act="estado" aria-label="Estado">${Object.entries(ESTADOS).map(([v, t]) => `<option value="${v}"${c.estado === v ? " selected" : ""}>${t}</option>`).join("")}</select>
        <button class="btn danger" data-act="del">Eliminar</button></div>` : ""}
    </article>`;
  }).join("");
}

function renderConfig() {
  // El menú, el pie y los botones de WhatsApp los completa common.js
}

/* ---------- Detalle ---------- */
function openDetail(id) {
  const c = state.cars.find(x => String(x.id) === String(id));
  if (!c) return;
  const title = `${c.marca} ${c.modelo} ${c.anio}`;
  $("#dTitle").textContent = title;
  $("#dPrice").textContent = fmtPrice(c);
  const rows = [
    ["Año", c.anio], ["Kilometraje", c.cero ? "0 km" : fmtKm(c.km)], ["Combustible", c.combustible],
    ["Transmisión", c.transmision], ["Motor", c.motor], ["Tracción", c.traccion], ["Carrocería", c.carroceria],
    ["Color", c.color], ["Puertas", c.puertas], ["Equipamiento", c.extras], ["Estado", ESTADOS[c.estado]]
  ];
  $("#dSheet").innerHTML = rows.filter(r => r[1] !== "" && r[1] != null).map(([k, v]) => `<tr><th>${k}</th><td>${esc(v)}</td></tr>`).join("");
  $("#dDesc").textContent = c.descripcion || "";
  $("#dDesc").hidden = !c.descripcion;

  const wa = (state.config.whatsapp || "").replace(/\D/g, "");
  const link = `${location.origin}${location.pathname}#auto-${c.id}`;
  const msg = `Hola${state.config.nombre ? " " + state.config.nombre : ""}! Me interesa comprar el ${title} publicado a ${fmtPrice(c)}. ¿Sigue disponible?\n${link}`;
  const share = `<button type="button" class="btn ghost" id="btnShare">Copiar enlace de este vehículo</button>`;
  const con = $("#dContact");
  if (c.estado === "vendido") {
    con.innerHTML = `<button class="btn wa" disabled>Vehículo vendido</button><small>Echa un vistazo a los demás vehículos disponibles.</small>`;
  } else if (!wa) {
    con.innerHTML = `<button class="btn wa" disabled>Comprar por WhatsApp</button><small>El vendedor todavía no configuró su número de WhatsApp.</small>${share}`;
  } else {
    con.innerHTML = `<a class="btn wa" href="https://wa.me/${wa}?text=${encodeURIComponent(msg)}" target="_blank" rel="noopener">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2Zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4.2-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.7 11.8 11.8 0 0 0 4.5 4c1.7.7 2.3.8 3.2.6.5-.1 1.5-.6 1.7-1.2.2-.6.2-1.1.2-1.2-.1-.1-.3-.2-.5-.3Z"/></svg>
      ${c.estado === "reservado" ? "Consultar por WhatsApp" : "Comprar por WhatsApp"}</a>
      <small>Te lleva a WhatsApp con un mensaje listo para el vendedor. También puedes escribir al +${esc(wa)}.</small>${share}`;
  }
  const sh = $("#btnShare");
  if (sh) sh.onclick = async () => {
    try { await navigator.clipboard.writeText(link); toast("Enlace copiado"); }
    catch { prompt("Copia el enlace:", link); }
  };

  const fotos = (c.fotos || []).map(fotoUrl);
  const main = $("#gMain"), th = $("#gThumbs");
  const show = i => {
    main.innerHTML = `<img class="bg" src="${esc(fotos[i])}" alt="" aria-hidden="true"><img class="fg" src="${esc(fotos[i])}" alt="${esc(title)} — foto ${i + 1}">`;
    th.querySelectorAll("button").forEach((b, j) => b.setAttribute("aria-current", j === i));
  };
  th.innerHTML = fotos.length > 1 ? fotos.map((f, i) => `<button type="button" aria-label="Foto ${i + 1}"><img src="${esc(f)}" alt="" loading="lazy"></button>`).join("") : "";
  th.querySelectorAll("button").forEach((b, i) => b.onclick = () => show(i));
  if (fotos.length) show(0); else main.textContent = "Sin fotos";

  history.replaceState(null, "", `#auto-${c.id}`);
  if (!$("#dDetail").open) $("#dDetail").showModal();
}
$("#dDetail").addEventListener("close", () => {
  if (location.hash.startsWith("#auto-")) history.replaceState(null, "", location.pathname + location.search);
});

/* ---------- Fotos: compresión antes de subir ---------- */
function loadImg(src) {
  return new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = rej; im.src = src; });
}
function toJpeg(im, max = 1600, q = 0.82) {
  const s = Math.min(1, max / Math.max(im.naturalWidth, im.naturalHeight));
  const cv = document.createElement("canvas");
  cv.width = Math.round(im.naturalWidth * s); cv.height = Math.round(im.naturalHeight * s);
  cv.getContext("2d").drawImage(im, 0, 0, cv.width, cv.height);
  return new Promise(r => cv.toBlob(r, "image/jpeg", q));
}

/* ---------- Formulario de vehículo ---------- */
let editing = null;
let pics = []; // { path } para fotos ya subidas, { blob, preview } para nuevas
const FIELDS = ["marca", "modelo", "anio", "km", "precio", "moneda", "combustible", "transmision", "motor", "traccion", "color", "puertas", "carroceria", "estado", "extras"];

function openForm(id) {
  editing = id ? state.cars.find(c => String(c.id) === String(id)) : null;
  $("#fTitle").textContent = editing ? "Editar vehículo" : "Cargar vehículo";
  $("#fMsg").textContent = "";
  $("#carForm").reset();
  pics = [];
  if (editing) {
    for (const k of FIELDS) if (editing[k] != null) $("#i_" + k).value = editing[k];
    $("#i_desc").value = editing.descripcion || "";
    $("#i_cero").checked = !!editing.cero;
    pics = (editing.fotos || []).map(path => ({ path }));
  }
  drawPics();
  $("#dForm").showModal();
}

function drawPics() {
  $("#pics").innerHTML = pics.map((p, i) => `<div class="pic"><img src="${esc(p.preview || fotoUrl(p.path))}" alt="">
    <button type="button" class="rm" data-i="${i}" aria-label="Quitar foto">×</button>
    ${i === 0 ? '<span class="cover">Portada</span>' : `<button type="button" class="mk" data-i="${i}">Portada</button>`}</div>`).join("");
}
$("#pics").addEventListener("click", e => {
  const i = Number(e.target.dataset.i);
  if (Number.isNaN(i)) return;
  if (e.target.classList.contains("rm")) { const [p] = pics.splice(i, 1); if (p.preview) URL.revokeObjectURL(p.preview); }
  else if (e.target.classList.contains("mk")) pics.unshift(...pics.splice(i, 1));
  drawPics();
});

async function addFiles(files) {
  $("#fMsg").textContent = "";
  for (const f of [...files].filter(f => f.type.startsWith("image/"))) {
    if (pics.length >= MAX_FOTOS) { $("#fMsg").textContent = `Máximo ${MAX_FOTOS} fotos por vehículo.`; break; }
    const tmp = URL.createObjectURL(f);
    try {
      const blob = await toJpeg(await loadImg(tmp));
      pics.push({ blob, preview: URL.createObjectURL(blob) });
    } catch { $("#fMsg").textContent = `No se pudo leer ${f.name}. Prueba con una foto JPG o PNG.`; }
    finally { URL.revokeObjectURL(tmp); }
  }
  drawPics();
}
const drop = $("#drop");
drop.addEventListener("click", () => $("#i_files").click());
drop.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); $("#i_files").click(); } });
$("#i_files").addEventListener("click", e => e.stopPropagation());
$("#i_files").addEventListener("change", e => { addFiles(e.target.files); e.target.value = ""; });
drop.addEventListener("dragover", e => { e.preventDefault(); drop.classList.add("over"); });
drop.addEventListener("dragleave", () => drop.classList.remove("over"));
drop.addEventListener("drop", e => { e.preventDefault(); drop.classList.remove("over"); addFiles(e.dataTransfer.files); });

$("#carForm").addEventListener("submit", async e => {
  e.preventDefault();
  const v = k => $("#i_" + k).value.trim();
  if (!v("marca") || !v("modelo") || !v("anio") || !v("precio")) { $("#fMsg").textContent = "Completa marca, modelo, año y precio."; return; }
  const btn = $("#btnSave");
  btn.disabled = true; btn.textContent = "Guardando…"; $("#fMsg").textContent = "";
  const estado = v("estado");
  const row = {
    marca: v("marca"), modelo: v("modelo"), anio: Number(v("anio")),
    km: v("km") === "" ? null : Number(v("km")),
    precio: Number(v("precio")), moneda: v("moneda"),
    combustible: v("combustible"), transmision: v("transmision"), motor: v("motor") || null,
    traccion: v("traccion"), color: v("color") || null,
    puertas: v("puertas") === "" ? null : Number(v("puertas")),
    carroceria: v("carroceria"), estado, extras: v("extras") || null,
    descripcion: $("#i_desc").value.trim() || null, cero: $("#i_cero").checked,
    vendido_en: estado === "vendido" ? (editing?.vendido_en || new Date().toISOString()) : null,
    actualizado: new Date().toISOString()
  };
  // La sesión puede haber caducado si la página lleva mucho rato abierta
  const { data: { session } } = await sb.auth.getSession();
  if (!session) {
    btn.disabled = false; btn.textContent = "Guardar vehículo";
    $("#fMsg").textContent = "Tu sesión ha caducado. Vuelve a entrar con «Acceso vendedor» (abajo del todo) y guarda de nuevo.";
    return;
  }
  let step = "ficha", createdId = null; const uploaded = [];
  try {
    // 1. Guardar la ficha para tener el id
    let id = editing?.id;
    if (id) {
      const { error } = await sb.from("autos").update(row).eq("id", id);
      if (error) throw error;
    } else {
      const { data, error } = await sb.from("autos").insert({ ...row, fotos: [] }).select("id").single();
      if (error) throw error;
      id = createdId = data.id;
    }
    // 2. Subir fotos nuevas en orden
    step = "fotos";
    const paths = [];
    for (let i = 0; i < pics.length; i++) {
      const p = pics[i];
      if (p.path) { paths.push(p.path); continue; }
      btn.textContent = `Subiendo foto ${i + 1} de ${pics.length}…`;
      const path = `${id}/${Date.now()}-${i}.jpg`;
      const { error } = await sb.storage.from(BUCKET).upload(path, p.blob, { contentType: "image/jpeg", cacheControl: "31536000" });
      if (error) throw error;
      uploaded.push(path); paths.push(path);
    }
    // 3. Guardar el orden de fotos y borrar las que se quitaron
    step = "orden";
    const { error: e2 } = await sb.from("autos").update({ fotos: paths }).eq("id", id);
    if (e2) throw e2;
    const removed = (editing?.fotos || []).filter(p => !paths.includes(p));
    if (removed.length) await sb.storage.from(BUCKET).remove(removed);

    $("#dForm").close();
    toast(editing ? "Vehículo actualizado" : "Vehículo publicado en el catálogo");
    await refresh();
  } catch (err) {
    console.error("Error al guardar (" + step + "):", err);
    // Deshacer lo guardado a medias para no dejar autos sin fotos ni duplicados
    try {
      if (uploaded.length) await sb.storage.from(BUCKET).remove(uploaded);
      if (createdId) await sb.from("autos").delete().eq("id", createdId);
    } catch (e) { console.warn(e); }
    const detail = String(err?.message || err?.error || err || "").slice(0, 160);
    const perm = /row-level security|permission|not authorized|unauthorized|403/i.test(detail);
    let msg;
    if (/JWT|expired|token/i.test(detail)) msg = "Tu sesión ha caducado. Vuelve a entrar con «Acceso vendedor» y guarda de nuevo.";
    else if (perm && step === "fotos") msg = "Supabase no deja subir las fotos (permiso del almacén de fotos).";
    else if (perm) msg = "Supabase no reconoce tu usuario como administrador.";
    else if (step === "fotos") msg = "No se ha podido subir una de las fotos. Prueba con menos fotos o revisa tu conexión.";
    else msg = "No se ha podido guardar. Revisa tu conexión e inténtalo de nuevo.";
    $("#fMsg").textContent = msg + (detail ? " Detalle: " + detail : "");
  } finally {
    btn.disabled = false; btn.textContent = "Guardar vehículo";
  }
});

/* ---------- Datos del negocio ---------- */
function openSettings() {
  $("#s_nombre").value = state.config.nombre || "";
  $("#s_wa").value = state.config.whatsapp || "";
  $("#s_dir").value = state.config.direccion || "";
  $("#sMsg").textContent = "";
  $("#dSettings").showModal();
}
$("#setForm").addEventListener("submit", async e => {
  e.preventDefault();
  const wa = $("#s_wa").value.replace(/\D/g, "");
  if (wa.length < 10) { $("#sMsg").textContent = "Escribe el número con el prefijo de país, por ejemplo 34686416404."; return; }
  const { error } = await sb.from("config").upsert({ id: 1, nombre: $("#s_nombre").value.trim(), whatsapp: wa, direccion: $("#s_dir").value.trim() });
  if (error) { console.error(error); $("#sMsg").textContent = "No se ha podido guardar. Inténtalo de nuevo."; return; }
  $("#dSettings").close();
  toast("Datos guardados");
  loadConfig();
});

/* ---------- Ingreso del vendedor ---------- */
async function checkAdmin() {
  const { data: { session } } = await sb.auth.getSession();
  if (!session) { state.isAdmin = false; }
  else {
    const { data, error } = await sb.rpc("is_admin");
    state.isAdmin = !error && data === true;
  }
  $("#btnLogin").hidden = !!session;
  $("#btnLogout").hidden = !session;
  $("#adminToggle").hidden = !state.isAdmin;
  $("#adminToggle").textContent = state.adminView ? "Ver como cliente" : "Modo administrador";
  return { session };
}
$("#btnLogin").addEventListener("click", () => { $("#lMsg").textContent = ""; $("#dLogin").showModal(); });
$("#loginForm").addEventListener("submit", async e => {
  e.preventDefault();
  const btn = $("#btnDoLogin"); btn.disabled = true;
  const { error } = await sb.auth.signInWithPassword({ email: $("#l_email").value.trim(), password: $("#l_pass").value });
  btn.disabled = false;
  if (error) { $("#lMsg").textContent = "Email o contraseña incorrectos."; return; }
  const { session } = await checkAdmin();
  $("#dLogin").close();
  if (session && !state.isAdmin) toast("Has entrado, pero tu usuario no es administrador");
  else toast("Bienvenido");
  render();
});
$("#btnLogout").addEventListener("click", async () => {
  await sb.auth.signOut();
  await checkAdmin();
  render();
  toast("Sesión cerrada");
});
$("#adminToggle").addEventListener("click", () => {
  state.adminView = !state.adminView;
  $("#adminToggle").textContent = state.adminView ? "Ver como cliente" : "Modo administrador";
  render();
});

/* ---------- Acciones en la grilla ---------- */
let pendingDel = null;
$("#grid").addEventListener("click", async e => {
  const actEl = e.target.closest("[data-act]");
  const card = e.target.closest(".card");
  if (actEl) {
    const act = actEl.dataset.act;
    if (act === "new") return openForm();
    if (!card || act === "estado") return;
    const id = card.dataset.id;
    if (act === "edit") return openForm(id);
    if (act === "del") {
      if (pendingDel !== id) {
        pendingDel = id; actEl.textContent = "¿Seguro? Toca otra vez";
        setTimeout(() => { if (pendingDel === id) { pendingDel = null; render(); } }, 4000);
        return;
      }
      pendingDel = null;
      const c = state.cars.find(x => String(x.id) === id);
      const { error } = await sb.from("autos").delete().eq("id", id);
      if (error) return toast("No se pudo eliminar");
      if (c?.fotos?.length) await sb.storage.from(BUCKET).remove(c.fotos);
      toast("Vehículo eliminado");
      return refresh();
    }
    return;
  }
  if (card) openDetail(card.dataset.id);
});
$("#grid").addEventListener("change", async e => {
  if (e.target.dataset.act !== "estado") return;
  const id = e.target.closest(".card").dataset.id;
  const estado = e.target.value;
  const { error } = await sb.from("autos").update({ estado, vendido_en: estado === "vendido" ? new Date().toISOString() : null }).eq("id", id);
  if (error) { toast("No se pudo cambiar el estado"); return refresh(); }
  toast("Estado: " + ESTADOS[estado]);
  refresh();
});
$("#grid").addEventListener("keydown", e => {
  if ((e.key === "Enter" || e.key === " ") && e.target.classList.contains("card")) { e.preventDefault(); openDetail(e.target.dataset.id); }
});

/* ---------- Filtros ---------- */
$("#q").addEventListener("input", e => { state.q = e.target.value; render(); });
$("#fMarca").addEventListener("change", e => { state.marca = e.target.value; render(); });
$("#sort").addEventListener("change", e => { state.sort = e.target.value; render(); });
document.querySelectorAll(".chip").forEach(ch => ch.addEventListener("click", () => {
  const f = ch.dataset.f, on = state.filters[f] !== ch.dataset.v;
  state.filters[f] = on ? ch.dataset.v : "";
  document.querySelectorAll(`.chip[data-f="${f}"]`).forEach(o => o.setAttribute("aria-pressed", String(on && o === ch)));
  render();
}));
$("#btnNew").addEventListener("click", () => openForm());
$("#btnSettings").addEventListener("click", openSettings);

/* ---------- Diálogos ---------- */
document.querySelectorAll("[data-close]").forEach(b => b.addEventListener("click", () => b.closest("dialog").close()));
document.querySelectorAll("dialog").forEach(d => d.addEventListener("click", e => { if (e.target === d) d.close(); }));

/* ---------- Arranque ---------- */
(async () => {
  if (!sb) {
    showGridMessage("Falta conectar la base de datos",
      "Completa config.js con la URL y la anon key de tu proyecto de Supabase. Los pasos están en el README.");
    $("#btnLogin").hidden = true;
    return;
  }
  await Promise.all([checkAdmin(), loadConfig(), refresh()]);
  if (location.hash.startsWith("#auto-")) openDetail(location.hash.slice(6));
  if (location.hash === "#acceso" && !state.isAdmin) {
    history.replaceState(null, "", location.pathname);
    $("#lMsg").textContent = ""; $("#dLogin").showModal();
  }
  sb.auth.onAuthStateChange((ev) => { if (ev === "SIGNED_OUT" || ev === "TOKEN_REFRESHED") checkAdmin().then(render); });
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") refresh(); });
})();
})();
