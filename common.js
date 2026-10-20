/* Easy Car — código común a todas las páginas
 * - Menú desplegable en el celular
 * - Botones de WhatsApp y dirección con los "Datos del negocio" guardados en Supabase
 * - En Inicio: últimos vehículos cargados
 */
(() => {
"use strict";

const CFG = window.CATALOGO_CONFIG || {};
const configured = CFG.SUPABASE_URL && !CFG.SUPABASE_URL.includes("TU-PROYECTO") && CFG.SUPABASE_ANON_KEY && !CFG.SUPABASE_ANON_KEY.includes("PEGÁ");
const sb = configured && window.supabase ? window.supabase.createClient(CFG.SUPABASE_URL, CFG.SUPABASE_ANON_KEY) : null;
const BUCKET = CFG.BUCKET_FOTOS || "fotos";
const WA_DEFAULT = "34686416404";

const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const fmtNum = n => Number(n).toLocaleString("es-ES", { useGrouping: "always" });
const fmtPrice = c => {
  const n = fmtNum(Number(c.precio) || 0);
  if (c.moneda === "EUR") return n + " €";
  return (c.moneda === "PYG" ? "Gs. " : "US$ ") + n;
};
const fotoUrl = path => /^https?:|^data:|^blob:/.test(path) ? path : sb.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;

// Compartido con app.js (catálogo) para usar una sola conexión
window.EC = { sb, esc, fmtNum, fmtPrice, fotoUrl };

/* ---------- Menú del celular ---------- */
const toggle = document.querySelector(".nav-toggle");
const menu = document.getElementById("menu");
if (toggle && menu) {
  const set = open => {
    toggle.setAttribute("aria-expanded", String(open));
    toggle.setAttribute("aria-label", open ? "Cerrar menú" : "Abrir menú");
    document.body.classList.toggle("menu-open", open);
  };
  toggle.addEventListener("click", () => set(toggle.getAttribute("aria-expanded") !== "true"));
  menu.addEventListener("click", e => { if (e.target.closest("a")) set(false); });
  document.addEventListener("keydown", e => { if (e.key === "Escape") set(false); });
  window.matchMedia("(min-width: 901px)").addEventListener("change", e => { if (e.matches) set(false); });
}

/* ---------- Año del pie ---------- */
document.querySelectorAll("[data-year]").forEach(el => { el.textContent = new Date().getFullYear(); });

/* ---------- WhatsApp y dirección ---------- */
function applyContact(cfg) {
  const wa = String(cfg.whatsapp || WA_DEFAULT).replace(/\D/g, "") || WA_DEFAULT;
  document.querySelectorAll("[data-wa]").forEach(a => {
    const msg = a.getAttribute("data-wa");
    a.href = `https://wa.me/${wa}` + (msg ? `?text=${encodeURIComponent(msg)}` : "");
  });
  if (cfg.direccion) {
    const maps = "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent(cfg.direccion);
    document.querySelectorAll("a[data-address]").forEach(a => {
      a.href = maps;
      if (!a.querySelector("[data-address-text]")) a.textContent = cfg.direccion;
    });
    document.querySelectorAll("[data-address-text]").forEach(el => { el.textContent = cfg.direccion; });
  }
}
applyContact({});

/* ---------- Últimos vehículos (Inicio) ---------- */
function renderUltimos(cars) {
  const box = document.getElementById("ultimos");
  const grid = document.getElementById("ultimosGrid");
  if (!box || !grid || !cars.length) return;
  grid.innerHTML = cars.map(c => {
    const portada = c.fotos?.[0];
    const tag = c.estado === "reservado" ? `<span class="tag reservado">Reservado</span>` : c.cero ? `<span class="tag nuevo">0 km</span>` : "";
    const km = c.cero ? "0 km" : (c.km == null ? "" : fmtNum(c.km) + " km");
    const comb = c.combustible === "Nafta" ? "Gasolina" : c.combustible;
    const specs = [c.anio, km, c.transmision, comb].filter(Boolean).map(s => `<span>${esc(s)}</span>`).join("");
    return `<a class="card" href="/vehiculos#auto-${esc(c.id)}">
      <div class="ph">${portada ? `<img src="${esc(fotoUrl(portada))}" alt="" loading="lazy" decoding="async">` : `<div class="noimg">SIN FOTO</div>`}${tag}<span class="price">${esc(fmtPrice(c))}</span></div>
      <div class="cbody"><h3>${esc(c.marca)} ${esc(c.modelo)}<small>${esc([c.carroceria, c.motor, c.color].filter(Boolean).join(" · "))}</small></h3><div class="specs">${specs}</div></div>
    </a>`;
  }).join("");
  box.hidden = false;
}

(async () => {
  if (!sb) return;
  try {
    const { data } = await sb.from("config").select("*").eq("id", 1).maybeSingle();
    if (data) applyContact(data);
  } catch (e) { console.warn(e); }
  if (document.getElementById("ultimosGrid")) {
    try {
      const { data } = await sb.from("autos").select("*").neq("estado", "vendido").order("creado", { ascending: false }).limit(6);
      renderUltimos(data || []);
    } catch (e) { console.warn(e); }
  }
})();
})();
